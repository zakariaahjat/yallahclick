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
  const guard = require('./middleware').requireAuth;

  // NOTE: auth + parent-facing reads stay anonymous (GET allowed without token)
  // so the public site/library can show content before any login.
  router.get('/', (req, res, next) => {
    try{
      if (!db.exists(name)) return res.status(404).json({ error: 'unknown collection' });
      res.json({ data: applyQuery(db.getAll(name), req), meta: { collection: name } });
    }catch(e){ next(e); }
  });

  router.post('/', guard, (req, res, next) => {
    try{
      const rec = db.create(name, req.body || {});
      res.status(201).json({ data: rec });
    }catch(e){ next(e); }
  });

  router.get('/:id', (req, res, next) => {
    try{
      const item = db.getById(name, req.params.id);
      if (!item) return res.status(404).json({ error: 'not found' });
      res.json({ data: item });
    }catch(e){ next(e); }
  });

  router.put('/:id', guard, (req, res, next) => {
    try{
      const item = db.update(name, req.params.id, req.body || {});
      if (!item) return res.status(404).json({ error: 'not found' });
      res.json({ data: item });
    }catch(e){ next(e); }
  });

  router.patch('/:id', guard, (req, res, next) => {
    try{
      const item = db.update(name, req.params.id, req.body || {});
      if (!item) return res.status(404).json({ error: 'not found' });
      res.json({ data: item });
    }catch(e){ next(e); }
  });

  router.delete('/:id', guard, (req, res, next) => {
    try{
      const removed = db.remove(name, req.params.id);
      if (!removed) return res.status(404).json({ error: 'not found' });
      res.json({ data: { ok: true, id: req.params.id } });
    }catch(e){ next(e); }
  });

  return router;
}

module.exports = routerFor;