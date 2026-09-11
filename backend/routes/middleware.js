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

/* ---- in-memory sliding-window rate limiter -------------------
   Guards public, abuse-prone endpoints (login, booking form,
   newsletter signup) that don't require an auth token. Keyed by
   client IP (req.ip, falling back to the raw socket address).
   Returns 429 with a Retry-After header when the window is full. */
function rateLimit(opts){
  opts = opts || {};
  const windowMs = opts.windowMs || 60 * 1000;
  const max = opts.max || 20;
  const label = opts.name || 'request';
  const buckets = new Map();
  let lastSweep = Date.now();

  return (req, res, next) => {
    const key = req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';

    // periodic housekeeping so the map never grows unbounded
    if (Date.now() - lastSweep > windowMs){
      lastSweep = Date.now();
      for (const [k, arr] of buckets){
        const fresh = arr.filter((t) => Date.now() - t < windowMs);
        if (fresh.length === 0) buckets.delete(k);
        else buckets.set(k, fresh);
      }
    }

    const now = Date.now();
    const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
    if (hits.length >= max){
      const retryAfter = Math.max(1, Math.ceil((windowMs - (now - hits[0])) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: 'rate_limited',
        message: 'Too many ' + label + 's. Please wait a moment and try again.'
      });
    }

    hits.push(now);
    buckets.set(key, hits);
    next();
  };
}

module.exports = { requireAuth, requireRole, optionalAuth, bearerToken, rateLimit };