/* ============================================================
   YallahClick — Vercel serverless entry
   Vercel runs this as a single Node function. It reuses the full
   Express app from backend/server.js and ensures the DB is ready
   before handling the first request.
   ============================================================ */
'use strict';

const app = require('../backend/server');
const db = require('../backend/db');

let boot = null;
function ensureBoot(){
  if (!boot) boot = db.init();
  return boot;
}

module.exports = function handler(req, res){
  ensureBoot()
    .then(() => app(req, res))
    .catch((e) => {
      console.error('[vercel] boot failed: ' + (e && e.message));
      res.status(500).json({ error: 'boot_failed' });
    });
};