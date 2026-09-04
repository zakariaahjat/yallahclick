/* ============================================================
   YallahClick — Express application server
   - Serves the JAMstack front-end (html/css/js/images) from <root>
   - Exposes /api/* REST (CRUD + auth) backed by data/db.json
   - Provides /api/health and /api/meta/counts for the UI
   ============================================================ */
'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');

const db = require('./db');
const genericRouter = require('./routes/generic');
const authRouter = require('./routes/auth');
const { requireAuth, optionalAuth } = require('./routes/middleware');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(ROOT, 'uploads');

const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '2mb' }));

/* ---- simple request log (off by default) ---- */
if (process.env.YC_LOG){
  app.use((req, res, next) => {
    console.log(req.method, req.originalUrl);
    next();
  });
}

/* ---- API ---- */
const api = express.Router();

api.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    db: 'data/*.json (per-section files)',
    kv: db.KV_ENABLED ? 'enabled' : 'disabled',
    collections: db.collections(),
    files: db.files()
  });
});

api.get('/meta/counts', (req, res) => {
  const s = db.stats();
  res.json({ data: s.collections, total: s.total });
});

api.post('/auth/reset', requireAuth, (req, res, next) => {
  try{
    db.dropAll();
    res.json({ data: { ok: true, message: 'Database reset to seed data.' } });
  }catch(e){ next(e); }
});

api.post('/auth/reset-public', requireAuth, (req, res, next) => {
  // Reset is now admin-only. The generic POST /auth/reset already covers
  // authenticated resets; this alias is kept for the dashboard reset button
  // but no longer exposed unauthenticated.
  try{
    db.dropAll();
    res.json({ data: { ok: true } });
  }catch(e){ next(e); }
});

// mount a generic CRUD router per collection, under both the collection
// name and its per-section file alias (kebab-case), e.g.
//   /api/psdTemplates   AND   /api/psd-templates
for (const name of db.collections()){
  const router = genericRouter(name);
  api.use('/' + name, router);
  const file = db.COLLECTION_FILES[name];
  const alias = String(file || '').replace(/\.json$/, '');
  if (alias && alias !== name) api.use('/' + alias, router);
}

/* ---------- file upload (multipart/form-data, single file) ---------- */
api.post('/upload', requireAuth, (req, res, next) => {
  try{
    const contentType = String(req.headers['content-type'] || '');
    const boundary = typeof req.headers['content-type'] === 'string'
      ? (contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i) || [])[1] || (contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i) || [])[2]
      : '';
    if (!boundary) return res.status(400).json({ error: 'missing_boundary' });

    let buf = Buffer.alloc(0);
    req.on('data', (c) => { buf = Buffer.concat([buf, c]); });

    req.on('end', () => {
      try{
        const parsed = parseMultipart(buf, boundary);
        if (!parsed || !parsed.file){
          return res.status(400).json({ error: 'no_file' });
        }
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        const safe = (s) => String(s || '').replace(/[^a-z0-9._-]/gi, '_');
        const ext = path.extname(parsed.file.filename || '').toLowerCase();
        const fileName = 'u_' + crypto.randomBytes(6).toString('hex') + ext;
        const sub = String(parsed.fields.folder === 'promotions' ? 'promotions'
          : parsed.fields.folder === 'files' ? 'files'
          : parsed.fields.folder || 'content');
        const dir = path.join(UPLOAD_DIR, safe(sub));
        fs.mkdirSync(dir, { recursive: true });
        const abs = path.join(dir, fileName);
        fs.writeFileSync(abs, parsed.file.data);
        const url = '/uploads/' + safe(sub) + '/' + fileName;
        res.status(201).json({ data: { url, filename: fileName, folder: safe(sub), size: parsed.file.data.length } });
      }catch(e){ next(e); }
    });
    req.on('error', next);
  }catch(e){ next(e); }
});

/* lightweight multipart/form-data parser (single file + fields):
   delimiter = "--boundary". The first part may start right after the
   opening "--boundary" (no leading CRLF); subsequent parts are separated
   by "\r\n--boundary". Each part body ends right before the next
   "--boundary", after stripping a single trailing CRLF. */
function parseMultipart(buffer, boundary){
  const delim = Buffer.from('--' + boundary);
  const parts = [];
  let search = 0;
  while (true){
    const start = buffer.indexOf(delim, search);
    if (start < 0) break;
    let partStart = start + delim.length;
    // closing boundary: "--boundary--"
    if (buffer.subarray(partStart, partStart + 2).toString() === '--') break;
    // skip leading CRLF that separates this part from the previous one
    if (buffer[partStart] === 0x0d) partStart += 2;
    const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), partStart);
    if (headerEnd < 0) break;
    const headerText = buffer.slice(partStart, headerEnd).toString('utf8');
    const bodyStart = headerEnd + 4;
    const bodyEnd = buffer.indexOf(delim, bodyStart);
    if (bodyEnd < 0) break;
    let bodyEndRaw = bodyEnd;
    if (bodyEnd >= 2 && buffer[bodyEnd - 2] === 0x0d && buffer[bodyEnd - 1] === 0x0a) bodyEndRaw = bodyEnd - 2;
    const body = buffer.slice(bodyStart, bodyEndRaw);
    const nameMatch = /name="([^"]*)"/.exec(headerText);
    const fileMatch = /filename="([^"]*)"/.exec(headerText);
    const name = nameMatch ? nameMatch[1] : '';
    parts.push({
      name,
      filename: fileMatch ? fileMatch[1] : null,
      contentType: (/Content-Type:\s*([^\r\n]+)/i.exec(headerText) || [])[1]?.trim() || '',
      data: fileMatch ? body : body.toString('utf8')
    });
    search = bodyEnd;
  }
  const fields = {};
  let file = null;
  parts.forEach((p) => {
    if (p.filename){ file = p; }
    else if (p.name) fields[p.name] = p.data;
  });
  return { fields, file };
}

api.use('/auth', authRouter);

app.use('/api', api);

/* uploaded files are served publicly so /uploads/... paths resolve */
app.use('/uploads', express.static(UPLOAD_DIR, { fallthrough: true }));

/* ---- static site (root = repo root so relative html/css/img resolve) ---- */
app.use(express.static(ROOT, {
  extensions: ['html'],
  index: false,
  setHeaders(res, filePath){
    if (filePath.endsWith('.html')){
      res.setHeader('Cache-Control', 'public, max-age=0');
    }
  }
}));

/* SPA-ish fallback: serve index.html for unknown HTML routes so
   direct links to /index.html, /ai-prompts.html etc. all work. */
app.use((req, res) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/') && !req.path.includes('.')){
    res.sendFile(path.join(ROOT, 'index.html'));
    return;
  }
  res.status(404).json({ error: 'not_found' });
});

/* central error handler */
app.use((err, req, res, next) => {
  console.error('[api]', err && err.message);
  const status = (err && err.status) || 500;
  const isValidation = err && err.status === 400;
  res.status(status).json(isValidation
    ? { error: 'validation_error', message: err.message }
    : { error: 'server_error', message: err && err.message });
});

if (require.main === module){
  db.init().then(() => {
    app.listen(PORT, () => {
      console.log('YallahClick API + site running at http://localhost:' + PORT);
      console.log('  DB file: ' + db.DB_FILE);
      console.log('  KV store: ' + (db.KV_ENABLED ? 'enabled' : 'disabled'));
      console.log('  Health:  http://localhost:' + PORT + '/api/health');
    });
  }).catch((e) => {
    console.error('Failed to init db:', e);
    process.exit(1);
  });
}

module.exports = app;