/* ============================================================
   YallahClick — Express middleware
   ============================================================ */
'use strict';

const db = require('../db');

function bearerToken(req){
  const h = req.headers.authorization || '';
  if (h.indexOf('Bearer ') === 0) return h.slice(7);
  // fallback to ?token= for simpler clients
  if (req.query && req.query.token) return req.query.token;
  return null;
}

function requireAuth(req, res, next){
  const token = bearerToken(req);
  db.verifyToken(token).then((payload) => {
    if (!payload || !payload.email){
      return res.status(401).json({ error: 'unauthorized', message: 'Missing or invalid session token.' });
    }
    req.user = payload;
    next();
  }).catch(next);
}

function optionalAuth(req, res, next){
  const token = bearerToken(req);
  db.verifyToken(token).then((payload) => {
    req.user = payload || null;
    next();
  }).catch(() => { req.user = null; next(); });
}

module.exports = { requireAuth, optionalAuth, bearerToken };