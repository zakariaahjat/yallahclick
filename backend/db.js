/* ============================================================
   YallahClick — JSON-file database (server-side)
   Each content section lives in its OWN JSON file under /data:

     data/bookings.json          data/customers.json
     data/prompts.json           data/templates.json
     data/video-templates.json   data/thumbnail-templates.json
     data/psd-templates.json     data/promotions.json
     data/settings.json          data/admins.json
     data/files.json             data/categories.json
     data/services.json

   Every file holds ONLY that section's data (an array) plus a
   small `_meta`. Writes are atomic (temp-file + rename) and the
   loader seeds from the browser modules in data/*.js the first
   time a section file is missing.

   On Vercel/KV (YC_KV_REST_URL + YC_KV_REST_TOKEN present) each
   section is persisted to its own KV key so the per-file split
   is preserved durably even on a serverless filesystem.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = process.env.YC_DATA_DIR || path.join(ROOT, 'data');
/* The browser seed modules (data/*.js) always live in the repo's real
   data dir; DATA_DIR (JSON files) may be redirected in tests. */
const SEED_DIR = process.env.YC_SEED_DIR || path.join(ROOT, 'data');

/* collection name -> JSON file (base name). Keeps API names in the
   existing camelCase where the front-end services expect them, while
   putting them in separate tidy files. */
const COLLECTION_FILES = {
  bookings: 'bookings.json',
  customers: 'customers.json',
  prompts: 'prompts.json',
  templates: 'templates.json',
  videoTemplates: 'video-templates.json',
  thumbnailTemplates: 'thumbnail-templates.json',
  psdTemplates: 'psd-templates.json',
  promotions: 'promotions.json',
  settings: 'settings.json',
  admins: 'admins.json',
  files: 'files.json',
  categories: 'categories.json',
  services: 'services.json'
};
const COLLECTIONS = Object.keys(COLLECTION_FILES);

function fileFor(name){
  return path.join(DATA_DIR, COLLECTION_FILES[name]);
}

/* Internal in-memory state: one array per collection. */
const state = {};

/* Per-collection write queues (serialized, lock-free). */
const writeQueues = {};

function queueFor(name){
  if (!writeQueues[name]) writeQueues[name] = Promise.resolve();
  return writeQueues[name];
}

/* --- optional durable remote store (Vercel/KV + Upstash REST) ---
   When YC_KV_REST_URL + YC_KV_REST_TOKEN are present, every section
   is mirrored to its own KV key (yc:db:<file>) so the per-section
   JSON files survive serverless cold starts / redeploys. Otherwise
   we use the local per-section JSON files. */
const KV_URL = process.env.YC_KV_REST_URL || '';
const KV_TOKEN = process.env.YC_KV_REST_TOKEN || '';
const KV_PREFIX = process.env.YC_KV_KEY || 'yc:db';
const KV_ENABLED = !!(KV_URL && KV_TOKEN);

function kvKeyFor(name){
  return KV_PREFIX + ':' + COLLECTION_FILES[name].replace(/\.json$/, '');
}

/* Raw-key variants for arbitrary (non-collection) values like the auth
   secret. The name is used AS the full key. */
async function kvRawGet(key){
  const url = KV_URL.replace(/\/+$/, '') + '/get/' + encodeURIComponent(key);
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++){
    try{
      const res = await fetch(url, {
        headers: { 'Authorization': 'Bearer ' + KV_TOKEN },
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok){ lastErr = new Error('kv get HTTP ' + res.status); }
      else{
        const json = await res.json();
        const raw = json && (json.result || (json.data && json.data.value));
        if (raw === null || raw === undefined || raw === '') return null;
        try{
          let parsed = JSON.parse(raw);
          if (typeof parsed === 'string'){
            try{ parsed = JSON.parse(parsed); }catch(_){ /* keep */ }
          }
          return parsed;
        }catch(pe){ lastErr = new Error('kv get malformed value'); }
      }
    }catch(e){ lastErr = e; }
    if (attempt < 2) await sleep(200 * (attempt + 1));
  }
  throw lastErr || new Error('kv get failed');
}

async function kvRawSet(key, value){
  const url = KV_URL.replace(/\/+$/, '') + '/set/' + encodeURIComponent(key);
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++){
    try{
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + KV_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
        signal: AbortSignal.timeout(8000)
      });
      if (res.ok) return true;
      lastErr = new Error('kv set HTTP ' + res.status);
    }catch(e){ lastErr = e; }
    if (attempt < 2) await sleep(200 * (attempt + 1));
  }
  throw lastErr || new Error('kv set failed');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Fetch a value from the durable store.
   Returns: the parsed value when the key EXISTS;
            null when the key is a true miss (HTTP 200, result null);
            THROWS on any transport/HTTP/parse error so callers can
            tell "absent" apart from "temporarily unreachable".
   Historical values were double-encoded by a buggy writer; decode
   them too so old KV data is still readable. */
async function kvGet(name){
  const url = KV_URL.replace(/\/+$/, '') + '/get/' + encodeURIComponent(kvKeyFor(name));
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++){
    try{
      const res = await fetch(url, {
        headers: { 'Authorization': 'Bearer ' + KV_TOKEN },
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok){ lastErr = new Error('kv get HTTP ' + res.status); }
      else{
        const json = await res.json();
        const raw = json && (json.result || (json.data && json.data.value));
        if (raw === null || raw === undefined || raw === '') return null;
        try{
          let parsed = JSON.parse(raw);
          // legacy: old writer double-encoded the payload; decode once more
          // ONLY when the second parse succeeds (a plain string value like
          // the auth secret must not be re-parsed).
          if (typeof parsed === 'string'){
            try{ parsed = JSON.parse(parsed); }catch(_){ /* keep string as-is */ }
          }
          return parsed;
        }
        catch(pe){ lastErr = new Error('kv get malformed value'); }
      }
    }catch(e){ lastErr = e; }
    if (attempt < 2) await sleep(200 * (attempt + 1));
  }
  throw lastErr || new Error('kv get failed');
}

/* Re-pull one collection from the durable store into the in-memory
   state. On serverless (Vercel) warm instances keep a snapshot in
   memory that can go stale; refreshing before each read/write keeps
   every instance consistent with the KV source of truth.
   Returns 'fresh' (pulled KV), 'missing' (key absent), 'error'
   (KV unreachable — callers may refuse to write), or 'off'. */
async function refresh(name){
  if (!KV_ENABLED || !(name in state)) return 'off';
  try{
    const remote = await kvGet(name);
    let arr = null;
    if (Array.isArray(remote)) arr = remote;
    else if (Array.isArray(remote && remote.data)) arr = remote.data;
    if (Array.isArray(arr)){ state[name] = arr; return 'fresh'; }
    return 'missing';
  }catch(e){
    return 'error';
  }
}

async function kvSet(name, arr){
  const url = KV_URL.replace(/\/+$/, '') + '/set/' + encodeURIComponent(kvKeyFor(name));
  const payload = JSON.stringify({ _meta: { version: 1, updatedAt: new Date().toISOString(), collection: name }, data: arr });
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++){
    try{
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + KV_TOKEN, 'Content-Type': 'application/json' },
        body: payload,
        signal: AbortSignal.timeout(8000)
      });
      if (res.ok) return true;
      lastErr = new Error('kv set HTTP ' + res.status);
    }catch(e){ lastErr = e; }
    if (attempt < 2) await sleep(200 * (attempt + 1));
  }
  throw lastErr || new Error('kv set failed');
}

/* --- atomic write for one section (temp file + rename) --- */
function writeFile(name, arr){
  const file = fileFor(name);
  const payload = JSON.stringify({ _meta: { version: 1, updatedAt: new Date().toISOString(), collection: name }, data: arr }, null, 2);
  const tmp = file + '.' + process.pid + '.tmp';
  return new Promise((resolve, reject) => {
    fs.writeFile(tmp, payload, 'utf8', (err) => {
      if (err) return reject(err);
      fs.rename(tmp, file, (err2) => err2 ? reject(err2) : resolve());
    });
  });
}

/* Persist one section (KV if enabled, else local file). Serialized
   per collection so concurrent writes never clobber each other. */
function persist(name){
  const arr = state[name];
  const q = queueFor(name).then(() => KV_ENABLED
    ? kvSet(name, arr).catch((e) => console.error('[db] kv persist failed (' + name + '): ' + e.message))
    : writeFile(name, arr).catch((e) => console.error('[db] file persist failed (' + name + '): ' + e.message)));
  writeQueues[name] = q.catch(() => {});
  return q;
}

/* --- load the browser seed modules and produce the initial data --- */
function loadSeeds(){
  const sandbox = {
    window: {},
    self: {},
    console,
    setTimeout,
    clearTimeout,
    Date,
  };
  sandbox.YC = sandbox.window.YC = {};
  vm.createContext(sandbox);

  const seedFileOrder = [
    'services.js', 'categories.js', 'bookings.js', 'customers.js',
    'aiPrompts.js', 'templates.js', 'videoTemplates.js',
    'thumbnailTemplates.js', 'psdTemplates.js', 'promotions.js',
    'settings.js', 'files.js', 'admins.js'
  ];

  for (const f of seedFileOrder){
    const p = path.join(SEED_DIR, f);
    if (!fs.existsSync(p)) continue;
    vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox, { filename: f });
  }

  const data = (sandbox.window.YC && sandbox.window.YC.data) || {};
  const KEY_MAP = {
    prompts: 'aiPrompts',
    videoTemplates: 'videoTemplates',
    thumbnailTemplates: 'thumbnailTemplates',
    psdTemplates: 'psdTemplates',
  };
  const out = {};
  for (const key of COLLECTIONS){
    const src = KEY_MAP[key] || key;
    out[key] = data[src] || [];
  }
  return out;
}

/* --- read one section file (or null if missing/corrupt) --- */
function readFile(name){
  const file = fileFor(name);
  if (!fs.existsSync(file)) return null;
  try{
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (parsed && Array.isArray(parsed.data)) return parsed.data;
    if (parsed && Array.isArray(parsed)) return parsed;
    return null;
  }catch(e){
    console.error('[db] corrupted ' + COLLECTION_FILES[name] + ', re-seeding: ' + e.message);
    return null;
  }
}

/* --- load one collection: remote > file > seed --- */
async function loadOne(name, seeds){
  if (KV_ENABLED){
    try{
      const remote = await kvGet(name);
      if (Array.isArray(remote)) { state[name] = remote; return { loaded: true }; }
      if (Array.isArray(remote && remote.data)) { state[name] = remote.data; return { loaded: true }; }
      // true miss (HTTP 200, key absent): fall through — first-run seeding allowed
    }catch(e){
      // KV read failed transiently at boot. Use whatever local data exists
      // for memory, but NEVER persist seeds into KV: a cold-start blip must
      // not clobber the durable store with stale bundled data.
      const file = readFile(name);
      if (Array.isArray(file)){ state[name] = file; return { loaded: true, kvError: true }; }
      state[name] = seeds[name] || [];
      return { loaded: false, seeded: false, kvError: true };
    }
  }
  const file = readFile(name);
  if (Array.isArray(file)) { state[name] = file; return { loaded: true }; }
  state[name] = seeds[name] || [];
  return { loaded: false, seeded: true };
}

/* --- boot: load every section (KV > file > seed), persist seeds --- */
async function init(){
  const seeds = loadSeeds();
  const jobs = [];
  for (const name of COLLECTIONS){
    jobs.push(loadOne(name, seeds).then((r) => {
      if (r.seeded) persist(name).catch((e) => console.error('[db] seed persist failed (' + name + '): ' + e.message));
    }));
  }
  await Promise.all(jobs);
  ready = Promise.resolve(true);
  return true;
}

let ready = Promise.resolve(true);
function isReady(){ return ready; }

/* --- generic collection helpers (API identical to before) --- */
function nextId(list){
  return list.reduce((acc, x) => {
    const n = parseInt(x.id, 10);
    return isNaN(n) ? acc : Math.max(acc, n);
  }, 0) + 1;
}

function collection(name){
  if (!(name in state)) throw new Error('unknown collection: ' + name);
  return state[name];
}

function getAll(name){
  return clone(collection(name));
}

function getById(name, id){
  const item = collection(name).find((x) => String(x.id) === String(id));
  return item ? clone(item) : null;
}

function create(name, record){
  const list = collection(name);
  const now = new Date().toISOString();
  const rec = Object.assign(
    { id: nextId(list), createdAt: now, updatedAt: now },
    clone(record || {})
  );
  list.unshift(rec);
  return clone(rec);
}

function update(name, id, patch){
  const list = collection(name);
  const i = list.findIndex((x) => String(x.id) === String(id));
  if (i < 0) return null;
  const clean = clone(patch || {});
  delete clean.id;
  delete clean.createdAt;
  list[i] = Object.assign({}, list[i], clean, { updatedAt: new Date().toISOString() });
  return clone(list[i]);
}

function remove(name, id){
  const list = collection(name);
  const before = list.length;
  state[name] = list.filter((x) => String(x.id) !== String(id));
  if (state[name].length !== before) return true;
  return false;
}

function exists(name){
  return name in state;
}

function collections(){
  return COLLECTIONS.slice();
}

function files(){
  return Object.keys(COLLECTION_FILES).reduce((acc, name) => {
    acc[name] = COLLECTION_FILES[name];
    return acc;
  }, {});
}

function dropAll(){
  const tasks = [];
  for (const name of COLLECTIONS){
    state[name] = loadSeeds()[name] || [];
    tasks.push(persist(name).catch((e) => console.error('[db] reset persist failed (' + name + '): ' + e.message)));
  }
  return Promise.all(tasks);
}

function stats(){
  const out = { collections: {}, total: 0 };
  for (const key of COLLECTIONS){
    out.collections[key] = state[key].length;
    out.total += state[key].length;
  }
  return out;
}

/* --- deep clone helper --- */
function clone(v){
  if (v === undefined || v === null) return v;
  return JSON.parse(JSON.stringify(v));
}

/* token helpers (simple HMAC-signed session token)
   Secret precedence: YC_AUTH_SECRET env -> fixed value persisted in
   the durable store -> one generated at boot. Persisting it in KV is
   what makes tokens verify on ANY serverless instance (each cold boot
   would otherwise draw its own random secret and reject tokens issued
   by sibling lambdas). */
const AUTH_SECRET_KEY = 'yc:auth-secret';
let TOKEN_SECRET = process.env.YC_AUTH_SECRET || null;
let tokenSecretPromise = null;

function loadTokenSecret(){
  if (TOKEN_SECRET) return Promise.resolve(TOKEN_SECRET);
  if (tokenSecretPromise) return tokenSecretPromise;
  tokenSecretPromise = (async () => {
    try{
      const v = await kvRawGet(AUTH_SECRET_KEY);
      if (typeof v === 'string' && v.length >= 16){
        TOKEN_SECRET = v;
        return TOKEN_SECRET;
      }
    }catch(e){ /* not readable yet; generate below */ }
    const fresh = crypto.randomBytes(32).toString('hex');
    TOKEN_SECRET = fresh;
    try{ await kvRawSet(AUTH_SECRET_KEY, fresh); }catch(e){ /* non-fatal */ }
    return TOKEN_SECRET;
  })();
  return tokenSecretPromise;
}

async function signToken(payload){
  const secret = await loadTokenSecret();
  const body = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64');
  return body + '.' + sig;
}

async function verifyToken(token){
  const secret = await loadTokenSecret();
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const expected = crypto.createHmac('sha256', secret).update(parts[0]).digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(parts[1]);
  if (a.length !== b.length) return null;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  if (diff !== 0) return null;
  try{
    return JSON.parse(Buffer.from(parts[0], 'base64').toString('utf8'));
  }catch(e){
    return null;
  }
}

function hashPassword(password){
  return crypto.createHash('sha256').update(String(password || '')).digest('hex');
}

module.exports = {
  DATA_DIR,
  SEED_DIR,
  COLLECTION_FILES,
  init,
  isReady,
  collections,
  files,
  exists,
  getAll,
  getById,
  create,
  update,
  remove,
  dropAll,
  stats,
  persist,
  refresh,
  nextId,
  signToken,
  verifyToken,
  hashPassword,
  clone,
  loadSeeds,
  KV_ENABLED,
  DB_FILE: COLLECTION_FILES.settings, // informational
};