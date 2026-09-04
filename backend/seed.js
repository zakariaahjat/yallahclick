/* ============================================================
   YallahClick — Seed generator
   Reads the browser seed modules (data/*.js), then writes each
   section to its OWN JSON file under /data so the per-section
   JSON DB ships with the repo and is reloadable anywhere.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const db = require('./db');

(async () => {
  await db.init();
  db.dropAll().then(() => {
    for (const name of db.collections()){
      const file = path.join(db.DATA_DIR, db.COLLECTION_FILES[name]);
      const payload = JSON.stringify({
        _meta: { version: 1, generatedBy: 'yc-seed', at: new Date().toISOString(), collection: name },
        data: db.getAll(name)
      }, null, 2) + '\n';
      fs.writeFileSync(file, payload, 'utf8');
      console.log('Seeded ' + path.basename(file) + '  (' + db.getAll(name).length + ' records)');
    }
    const s = db.stats();
    console.log('  total records: ' + s.total);
  }).catch((e) => {
    console.error('Seed failed: ' + e.message);
    process.exit(1);
  });
})();