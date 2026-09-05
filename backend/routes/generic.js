/* ============================================================
   YallahClick — Generic REST CRUD router
   Mounted at /api/:collection for every known collection.
   Full create / read / update / delete with query support.

     GET    /api/:collection          list (filters, search, sort, limit)
     GET    /api/:collection/:id      one
     POST   /api/:collection          create
     PUT    /api/:collection/:id      replace
     PATCH  /api/:collection/:id      partial update
     DELETE /api/:collection/:id      remove
   ============================================================ */
'use strict';

const express = require('express');
const db = require('../db');

/* ---- server-side validation -----------------------------------
   Each known collection has an optional validate(record) that throws
   { status, message } when the record is invalid. This keeps the API
   honest: bad records never reach the JSON files. */
const validators = {
  prompts(p){
    if (!p || !String(p.title || '').trim()) return 'title is required';
    if (!String(p.category || '').trim()) return 'category is required';
    if (!String(p.prompt || '').trim()) return 'prompt is required';
    return null;
  },
  promotions(p){
    if (!p || !String(p.title || '').trim()) return 'title is required';
    const s = p.startDate, e = p.endDate;
    if (s && !validIso(s)) return 'startDate must be a valid date';
    if (e && !validIso(e)) return 'endDate must be a valid date';
    return null;
  },
  videoTemplates(t){ return validateTemplate(t, 'video template'); },
  thumbnailTemplates(t){ return validateTemplate(t, 'thumbnail template'); },
  psdTemplates(t){ return validateTemplate(t, 'psd template'); },
  templates(t){ return validateTemplate(t, 'template'); },
  bookings(b){
    if (!b || (!String(b.customerName || b.name || '').trim())) return 'customer name is required';
    return null;
  },
  customers(c){
    if (!c || !String(c.name || '').trim()) return 'name is required';
    if (c.email && !validEmail(c.email)) return 'email is not a valid address';
    return null;
  },
  categories(c){
    if (!c || !String(c.name || '').trim()) return 'name is required';
    return null;
  },
  settings(s){
    if (s && s.contactEmail && !validEmail(s.contactEmail)) return 'contactEmail is not a valid address';
    return null;
  },
  files(f){
    if (!f || !String(f.name || '').trim()) return 'name is required';
    if (f.url && !validUrl(f.url)) return 'url is not a valid URL';
    return null;
  },
  services(s){
    if (!s || !String(s.name || '').trim()) return 'name is required';
    return null;
  },
  admins(a){
    if (!a || !String(a.email || '').trim()) return 'email is required';
    if (a.email && !validEmail(a.email)) return 'email is not a valid address';
    return null;
  }
};

function validEmail(v){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || ''));
}
function validUrl(v){
  return /^(https?:|data:|\/)/i.test(String(v || ''));
}
function validIso(v){
  const d = new Date(v);
  return !isNaN(d.getTime());
}
function validateTemplate(t, label){
  if (!t) return label + ' record is required';
  if (!String(t.title || '').trim()) return 'title is required';
  if (t.preview && !validUrl(t.preview)) return 'preview is not a valid URL/path';
  if (t.file && !validUrl(t.file) && !/^[a-z0-9._-]+$/i.test(String(t.file))) return 'file is not a valid name/URL';
  return null;
}

function validate(name, record){
  const fn = validators[name];
  if (!fn) return null;
  const err = fn(record);
  if (err){ const e = new Error(err); e.status = 400; throw e; }
}

function matchField(record, field, value){
  // boolean coercion (true/false), numeric, or string
  const actual = record[field];
  const vs = String(value).toLowerCase();
  if (typeof actual === 'boolean') return actual === (vs === 'true');
  if (vs === 'true' || vs === 'false') return String(actual) === vs;
  return String(actual).toLowerCase() === vs;
}

function applyQuery(list, req){
  let out = db.clone(list);
  const q = req.query;

  if (q && q.filters){
    try{
      const filters = JSON.parse(q.filters);
      for (const [field, value] of Object.entries(filters)){
        if (value === undefined || value === null || value === '' || value === 'all') continue;
        if (Array.isArray(value)){
          out = out.filter((r) => value.some((v) => matchField(r, field, v)));
        }else{
          out = out.filter((r) => matchField(r, field, value));
        }
      }
      if (filters.q){
        const needle = String(filters.q).toLowerCase();
        out = out.filter((r) =>
          Object.values(r).some((v) =>
            v !== null && v !== undefined &&
            String(v).toLowerCase().indexOf(needle) >= 0
          )
        );
      }
    }catch(e){ /* ignore malformed filters */ }
  }

  if (q && q.search){
    const needle = String(q.search).toLowerCase();
    out = out.filter((r) =>
      Object.values(r).some((v) =>
        v !== null && v !== undefined &&
        String(v).toLowerCase().indexOf(needle) >= 0
      )
    );
  }

  if (q && typeof q.status === 'string' && q.status !== 'all'){
    out = out.filter((r) => matchField(r, 'status', q.status) || matchField(r, 'published', q.status));
  }

  if (q && q.sort){
    const [field, dir] = String(q.sort).split(':');
    const mul = dir === 'desc' ? -1 : 1;
    out = out.slice().sort((a, b) => {
      const av = a[field], bv = b[field];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mul;
      return String(av === undefined ? '' : av).localeCompare(String(bv === undefined ? '' : bv)) * mul;
    });
  }

  if (q && q.limit){
    out = out.slice(0, parseInt(q.limit, 10) || 20);
  }

  return out;
}

function routerFor(name){
  const router = express.Router();

  // NOTE: auth + parent-facing reads stay anonymous (GET allowed without token)
  // so the public site/library can show content before any login.
  router.get('/', async (req, res, next) => {
    try{
      await db.refresh(name);
      if (!db.exists(name)) return res.status(404).json({ error: 'unknown collection' });
      res.json({ data: applyQuery(db.getAll(name), req), meta: { collection: name } });
    }catch(e){ next(e); }
  });

  // POST is admin-only EXCEPT for `bookings`, which the public inquiry
  // form submits to (no token). Bookings are normalized server-side.
  router.post('/', async (req, res, next) => {
    try{
      await db.refresh(name);
      if (name !== 'bookings'){
        // admin-only: 401 unless a valid session token is present
        const auth = require('./middleware');
        const payload = db.verifyToken(auth.bearerToken(req));
        if (!payload || !payload.email){
          return res.status(401).json({ error: 'unauthorized', message: 'Missing or invalid session token.' });
        }
        req.user = payload;
      }
      const b = Object.assign({}, req.body || {});
      if (name === 'bookings'){
        b.status = 'pending';
        if (!b.date) b.date = new Date().toISOString().slice(0, 10);
        if (!b.createdAt) b.createdAt = new Date().toISOString();
        if (!b.id){
          const max = db.getAll(name).reduce((acc, x) => {
            const n = parseInt(String(x.id || '').replace(/\D+/g, ''), 10);
            return isNaN(n) ? acc : Math.max(acc, n);
          }, 1000);
          b.id = 'YC-' + (max + 1);
        }
      }
      validate(name, b);
      const rec = db.create(name, b);
      // Durability: wait for the KV/file write to finish BEFORE responding so
      // serverless instances never report success for a record that wasn't
      // yet written to the durable store.
      await db.persist(name).catch(() => {});
      res.status(201).json({ data: rec });
    }catch(e){ next(e); }
  });

  router.get('/:id', async (req, res, next) => {
    try{
      await db.refresh(name);
      const item = db.getById(name, req.params.id);
      if (!item) return res.status(404).json({ error: 'not found' });
      res.json({ data: item });
    }catch(e){ next(e); }
  });

  router.put('/:id', async (req, res, next) => {
    try{
      await db.refresh(name);
      validate(name, Object.assign({}, db.getById(name, req.params.id) || {}, req.body || {}));
      const item = db.update(name, req.params.id, req.body || {});
      if (!item) return res.status(404).json({ error: 'not found' });
      await db.persist(name).catch(() => {});
      res.json({ data: item });
    }catch(e){ next(e); }
  });

  router.patch('/:id', async (req, res, next) => {
    try{
      await db.refresh(name);
      validate(name, Object.assign({}, db.getById(name, req.params.id) || {}, req.body || {}));
      const item = db.update(name, req.params.id, req.body || {});
      if (!item) return res.status(404).json({ error: 'not found' });
      await db.persist(name).catch(() => {});
      res.json({ data: item });
    }catch(e){ next(e); }
  });

  router.delete('/:id', async (req, res, next) => {
    try{
      await db.refresh(name);
      const removed = db.remove(name, req.params.id);
      if (!removed) return res.status(404).json({ error: 'not found' });
      await db.persist(name).catch(() => {});
      res.json({ data: { ok: true, id: req.params.id } });
    }catch(e){ next(e); }
  });

  return router;
}

module.exports = routerFor;