/* ============================================================
   YallahClick - Express middleware
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
  db.verifyToken(token).then(async (payload) => {
    if (!payload || !payload.email){
      return res.status(401).json({ error: 'unauthorized', message: 'Missing or invalid session token.' });
    }
    /* Re-read the account from the users collection so that role/status
       changes (promotions, disable) take effect immediately - even for
       an already-issued token. A disabled or deleted account is locked
       out on the spot. */
    let user = null;
    try{ user = db.getAll('users').find((u) => String(u.email || '').toLowerCase() === String(payload.email).toLowerCase()) || null; }
    catch(e){ user = null; }
    if (!user || String(user.status) === 'disabled'){
      return res.status(401).json({ error: 'unauthorized', message: 'Account is disabled or no longer exists.' });
    }
    req.user = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: String(user.role || 'none'),
      status: user.status,
    };
    next();
  }).catch(next);
}

/* Role gate: `roles` is an array of allowed role names (e.g. ['owner'])
   or the magic value `true` (any authenticated user passes).
   Rejects with 403 when the session holder's role is not allowed. */
function requireRole(roles){
  return (req, res, next) => {
    requireAuth(req, res, (err) => {
      if (err) return next(err);
      const ok = roles === true || (Array.isArray(roles) && roles.indexOf(req.user.role) >= 0);
      if (!ok){
        return res.status(403).json({ error: 'forbidden', message: 'Your role does not allow this action.' });
      }
      next();
    });
  };
}

function optionalAuth(req, res, next){
  const token = bearerToken(req);
  db.verifyToken(token).then((payload) => {
    req.user = payload || null;
    next();
  }).catch(() => { req.user = null; next(); });
}

module.exports = { requireAuth, requireRole, optionalAuth, bearerToken };