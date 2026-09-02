/* ============================================================
   YallahClick — Seed generator
   Reads the browser seed modules (data/*.js) and writes
   data/db.json so the JSON database ships with the repo and is
   reloadable anywhere.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const db = require('./db');

// init() already seeds state from data/*.js if needed; force regenerate
db.dropAll().then(() => {
  fs.writeFileSync(db.DB_FILE, JSON.stringify({
    _meta: { version: 1, generatedBy: 'yc-seed', at: new Date().toISOString() },
    ...db.collections().reduce((acc, c) => { acc[c] = db.getAll(c); return acc; }, {})
  }, null, 2) + '\n', 'utf8');
  console.log('Seeded ' + db.DB_FILE);
  const s = db.stats();
  for (const [c, n] of Object.entries(s.collections)) console.log('  ' + c + ': ' + n);
  console.log('  total records: ' + s.total);
}).catch((e) => {
  console.error('Seed failed: ' + e.message);
  process.exit(1);
});