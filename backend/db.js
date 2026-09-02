/* ============================================================
   YallahClick — JSON file database (server-side)
   Loads/seed data/db.json, persists atomically, and exposes
   typed CRUD helpers shared by every API route.

   The data/*.js seed files are browser modules (they build
   `window.YC.data.xxx`). We shim a minimal `window` and load
   them in a Node VM so the JSON DB seeds from the exact same
   dataset the static demo uses.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = process.env.YC_DB_FILE || path.join(ROOT, 'data', 'db.json');

const COLLECTIONS = [
  'bookings',
  'customers',
  'prompts',
  'templates',
  'videoTemplates',
  'thumbnailTemplates',
  'promotions',
  'settings',
  'admins',
  'files',
  'categories',
  'services'
];

/* Internal in-memory snapshot. Writes go to disk via a serialized queue. */
let state = {};

let writeQueue = Promise.resolve();

/* --- optional durable remote store (Vercel/KV + Upstash REST) ---
   When YC_KV_REST_URL + YC_KV_REST_TOKEN are present, the whole DB is
   persisted as one JSON blob under YC_KV_KEY (works on Vercel). Otherwise
   we use the local JSON file (works on any persistent Node host).    */
const KV_URL = process.env.YC_KV_REST_URL || '';
const KV_TOKEN = process.env.YC_KV_REST_TOKEN || '';
const KV_KEY = process.env.YC_KV_KEY || 'yc:db';
const KV_ENABLED = !!(KV_URL && KV_TOKEN);

async function kvGet(){
  const url = KV_URL.replace(/\/+$/, '') + '/get/' + encodeURIComponent(KV_KEY);
  const res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + KV_TOKEN } });
  if (!res.ok) return null;
  const json = await res.json();
  const raw = json && (json.result || (json.data && json.data.value));
  if (!raw) return null;
  try{ return JSON.parse(raw); }catch(e){ return null; }
}

async function kvSet(obj){
  const url = KV_URL.replace(/\/+$/, '') + '/set/' + encodeURIComponent(KV_KEY);
  await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + KV_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(JSON.stringify(obj)),
  });
}

/* --- atomic write with a lock-free queue (prevents lost updates) --- */
function persist(){
  const payload = JSON.stringify({ _meta: { version: 1, updatedAt: new Date().toISOString() }, ...state }, null, 2);
  writeQueue = writeQueue.then(() => KV_ENABLED
    ? kvSet(JSON.parse(payload))
      .catch((e) => console.error('[db] kv persist failed: ' + e.message))
    : new Promise((resolve, reject) => {
      const tmp = DB_FILE + '.' + process.pid + '.tmp';
      fs.writeFile(tmp, payload, 'utf8', (err) => {
        if (err) return reject(err);
        fs.rename(tmp, DB_FILE, (err2) => {
          if (err2) return reject(err2);
          resolve();
        });
      });
    }));
  return writeQueue;
}

/* Initiate an async load-and-apply from the remote store (Vercel only). */
async function hydrateFromRemote(){
  if (!KV_ENABLED) return false;
  try{
    const remote = await kvGet();
    if (!remote) return false;
    let changed = false;
    for (const key of COLLECTIONS){
      if (Array.isArray(remote[key])){
        state[key] = remote[key];
        changed = true;
      }
    }
    if (changed) return true;
    return false;
  }catch(e){
    console.error('[db] remote hydrate failed: ' + e.message);
    return false;
  }
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
  // Some seed files use bare `YC` (e.g. data/services.js), others use
  // `window.YC`. Point both at the same object.
  sandbox.YC = sandbox.window.YC = {};
  vm.createContext(sandbox);

  const seedFileOrder = [
    'services.js', 'categories.js', 'bookings.js', 'customers.js',
    'aiPrompts.js', 'templates.js', 'videoTemplates.js',
    'thumbnailTemplates.js', 'promotions.js', 'settings.js',
    'files.js', 'admins.js'
  ];

  for (const f of seedFileOrder){
    const p = path.join(DATA_DIR, f);
    if (!fs.existsSync(p)) continue;
    vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox, { filename: f });
  }

  const data = (sandbox.window.YC && sandbox.window.YC.data) || {};
  const out = {};
  // map collection name -> seed data key (they differ: 'prompts' <- 'aiPrompts')
  const KEY_MAP = {
    prompts: 'aiPrompts',
    videoTemplates: 'videoTemplates',
    thumbnailTemplates: 'thumbnailTemplates',
  };
  for (const key of COLLECTIONS){
    const src = KEY_MAP[key] || key;
    out[key] = data[src] || [];
  }
  return out;
}

/* --- deep clone helper (strips functions/symbols) --- */
function clone(v){
  if (v === undefined || v === null) return v;
  return JSON.parse(JSON.stringify(v));
}

/* --- boot: read existing db.json or seed fresh. Async so the
   durable remote store (Vercel KV) can be hydrated before serving. --- */
async function init(){
  let seeded = false;
  const hadFile = fs.existsSync(DB_FILE);
  if (hadFile){
    try{
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      state = {};
      for (const key of COLLECTIONS){
        state[key] = Array.isArray(parsed[key]) ? parsed[key] : [];
      }
    }catch(e){
      console.error('[db] corrupted db.json, re-seeding: ' + e.message);
      state = loadSeeds();
      seeded = true;
    }
  }else{
    state = loadSeeds();
    seeded = true;
  }

  // Backfill collections that are entirely absent from an older db.json
  // so newly-introduced collections (e.g. settings) appear automatically.
  // Note: only fills missing keys — never resurrects a deliberately
  // emptied collection, so deleting every booking stays deleted.
  if (hadFile && !seeded){
    const seeds = loadSeeds();
    for (const key of COLLECTIONS){
      if (!(key in state)){
        state[key] = seeds[key] || [];
        seeded = true;
      }
    }
  }

  // If a durable store is configured, prefer its snapshot (it wins over file).
  if (KV_ENABLED){
    const hydrated = await hydrateFromRemote();
    if (!hydrated && seeded){
      persist().catch((e) => console.error('[db] initial kv write failed: ' + e.message));
    }
  }else{
    persist().catch((e) => console.error('[db] initial write failed: ' + e.message));
  }
  ready = Promise.resolve(true);
  return true;
}

let ready = Promise.resolve(true);
function isReady(){ return ready; }

/* --- generic collection helpers --- */
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
  persist().catch((e) => console.error('[db] create persist failed: ' + e.message));
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
  persist().catch((e) => console.error('[db] update persist failed: ' + e.message));
  return clone(list[i]);
}

function remove(name, id){
  const list = collection(name);
  const before = list.length;
  state[name] = list.filter((x) => String(x.id) !== String(id));
  if (state[name].length !== before){
    persist().catch((e) => console.error('[db] remove persist failed: ' + e.message));
    return true;
  }
  return false;
}

function exists(name){
  return name in state;
}

function collections(){
  return COLLECTIONS.slice();
}

function dropAll(){
  state = loadSeeds();
  return persist().catch((e) => console.error('[db] reset persist failed: ' + e.message));
}

function stats(){
  const out = { collections: {}, total: 0 };
  for (const key of COLLECTIONS){
    out.collections[key] = state[key].length;
    out.total += state[key].length;
  }
  return out;
}

/* token helpers (simple HMAC-signed session token) */
const TOKEN_SECRET = process.env.YC_AUTH_SECRET || crypto.randomBytes(32).toString('hex');

function signToken(payload){
  const body = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(body).digest('base64');
  return body + '.' + sig;
}

function verifyToken(token){
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(parts[0]).digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(parts[1]);
  if (a.length !== b.length) return null;
  // constant-time compare
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
  DB_FILE,
  init,
  isReady,
  collections,
  exists,
  getAll,
  getById,
  create,
  update,
  remove,
  dropAll,
  stats,
  persist,
  nextId,
  signToken,
  verifyToken,
  hashPassword,
  clone,
  loadSeeds,
  KV_ENABLED,
};