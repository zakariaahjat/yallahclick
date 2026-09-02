/* ============================================================
   YallahClick — Express application server
   - Serves the JAMstack front-end (html/css/js/images) from <root>
   - Exposes /api/* REST (CRUD + auth) backed by data/db.json
   - Provides /api/health and /api/meta/counts for the UI
   ============================================================ */
'use strict';

const path = require('path');
const express = require('express');
const cors = require('cors');

const db = require('./db');
const genericRouter = require('./routes/generic');
const authRouter = require('./routes/auth');
const { requireAuth, optionalAuth } = require('./routes/middleware');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 3000;

db.init();

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
  res.json({ status: 'ok', time: new Date().toISOString(), db: path.basename(db.DB_FILE), collections: db.collections() });
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

api.post('/auth/reset-public', (req, res, next) => {
  // Public reset endpoint used for the demo "restore sample data" button.
  try{
    db.dropAll();
    res.json({ data: { ok: true } });
  }catch(e){ next(e); }
});

// mount a generic CRUD router per collection
for (const name of db.collections()){
  api.use('/' + name, genericRouter(name));
}

api.use('/auth', authRouter);

app.use('/api', api);

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
  res.status(err && err.status || 500).json({ error: 'server_error', message: err && err.message });
});

if (require.main === module){
  app.listen(PORT, () => {
    console.log('YallahClick API + site running at http://localhost:' + PORT);
    console.log('  DB file: ' + db.DB_FILE);
    console.log('  Health:  http://localhost:' + PORT + '/api/health');
  });
}

module.exports = app;