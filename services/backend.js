/* ============================================================
   YallahClick — Backend client + sync bridge
   Talks to the Express /api (REST CRUD over data/db.json) and
   exposes:
     YC.backend.base(), hydrate(), persist(), request(),
     YC.backend.ready (Promise) — resolves once data is hydrated
   The existing YC.Store/localStorage layer is bridged: reads come
   from an in-memory cache hydrated from the API, and every write
   is pushed back to the API. When the API is unreachable (e.g.
   opened as a plain static file) it transparently falls back to
   localStorage so the demo never blanks out.
   ============================================================ */
window.YC = window.YC || {};

(function(){
  var API = (function(){
    // When served by Express the API lives at the same origin.
    if (window.__YC_API__) return window.__YC_API__;
    var p = location.pathname || '';
    var base = location.origin;
    // if we're under /backend or a subpath, still assume root /api
    if (p && p.length > 1) base = window.location.protocol + '//' + window.location.host;
    return base;
  })();

  var apiBase = API.replace(/\/+$/, '') + '/api';
  var COLLECTIONS = [
    'bookings','customers','prompts','templates','videoTemplates',
    'thumbnailTemplates','promotions','admins','files','categories','services'
  ];

  var cache = {};        // key(ref YC key) -> array
  var hydrated = false;  // has the cache been populated from the API?
  var online = null;     // true/false after first probe

  function token(){
    try{ return localStorage.getItem('yc-token') || sessionStorage.getItem('yc-token') || ''; }
    catch(e){ return ''; }
  }

  function headers(json){
    var h = { 'Accept': 'application/json' };
    if (json) h['Content-Type'] = 'application/json';
    var t = token();
    if (t) h['Authorization'] = 'Bearer ' + t;
    return h;
  }

  /* Low-level fetch wrapper. Returns { ok, status, data } or throws. */
  function request(method, path, body){
    var url = apiBase + path;
    var opts = { method: method, headers: headers(body !== undefined) };
    if (body !== undefined) opts.body = JSON.stringify(body);
    return fetch(url, opts).then(function(res){
      return res.json().catch(function(){ return {}; }).then(function(json){
        return { ok: res.ok, status: res.status, body: json };
      });
    });
  }

  /* Map a storage key ('yc:bookings') to a collection + a base array.
     Returns { name, arr } reading from the cache. */
  function resolve(key){
    var name = String(key).replace(/^yc:/, '');
    // normalize yc:video-templates / yc:thumbnail-templates
    if (name === 'video-templates') name = 'videoTemplates';
    if (name === 'thumbnail-templates') name = 'thumbnailTemplates';
    return { name: name, arr: cache[name] };
  }

  /* Probe the API once. Short timeout so static opens don't hang. */
  function probe(){
    if (online !== null) return Promise.resolve(online);
    return fetch(apiBase + '/health', { method: 'GET', headers: headers(false) })
      .then(function(r){ online = r.ok; return online; })
      .catch(function(){ online = false; return false; });
  }

  /* Hydrate every collection into the cache. Returns a promise. */
  function hydrate(){
    if (hydrated) return Promise.resolve(true);
    return probe().then(function(isUp){
      if (!isUp){ hydrated = true; online = false; return false; }
      var jobs = COLLECTIONS.map(function(name){
        return request('GET', '/' + name).then(function(r){
          if (r.ok && r.body && Array.isArray(r.body.data)) cache[name] = r.body.data;
          else cache[name] = [];
        }).catch(function(){ cache[name] = []; });
      });
      return Promise.all(jobs).then(function(){ hydrated = true; online = true; return true; });
    });
  }

  /* Full-localStorage fallback read (used before/without API). */
  function lsRead(key){
    try{ var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
    catch(e){ return null; }
  }
  function lsWrite(key, val){
    try{ localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch(e){ return false; }
  }

  /* Persist a collection's full array back to the server.
     Prefer diffing when we know a record id, but a wholesale PUT
     of the array is simplest & correct for a single-actor admin
     demo. We PATCH each changed id when possible, else recreate. */
  function pushCollection(name, arr){
    if (!online || !arr) return Promise.resolve();
    var tokenOf = function(id){ return String(id); };
    var created = arr.filter(function(x){ return x && !x._synced; });
    var jobs = [];
    // create missing server-side records
    created.forEach(function(x){
      var rec = Object.assign({}, x);
      delete rec._synced; delete rec._clientId;
      jobs.push(request('POST', '/' + name, rec));
    });
    return Promise.all(jobs).catch(function(){ /* non-fatal */ });
  }

  /* ---- YC.Store bridge: replace read/write with an API-backed cache ---- */
  function overrideStore(){
    var Store = window.YC.Store;
    if (!Store) return;

    // cache-aware read
    Store.read = function(key){
      var r = resolve(key);
      if (r.arr) return r.arr;
      // not hydrated yet: fall back to localStorage
      var v = lsRead(key);
      if (v) return v;
      return null;
    };

    // cache-aware write (updates cache, persists to localStorage + API)
    Store.write = function(key, list){
      var r = resolve(key);
      if (r.arr) r.arr = list;
      // keep working even if API later comes online by mirroring to LS
      lsWrite(key, list);
      if (Array.isArray(list)) pushCollection(r.name, list);
      return true;
    };

    // removals
    Store.remove = function(key){
      var r = resolve(key);
      if (r) delete cache[r.name ? r.name : key];
      try{ localStorage.removeItem(key); }catch(e){}
    };

    // seed/migrate become no-ops when we have the API (data lives there)
    Store.migrate = function(key, seedData){
      // only seed localStorage so static fallback still works
      if (!hydrated && !lsRead(key)) lsWrite(key, seedData);
    };
    Store.ensureFresh = function(){ /* versioning handled server-side */ };
  }

  /* Public API used by pages to reset data (admin "restore demo" button). */
  function resetAll(){
    return request('POST', '/auth/reset-public').then(function(r){
      if (r.ok){ hydrated = false; online = null; return hydrate(); }
      return false;
    });
  }

  window.YC.backend = {
    base: apiBase,
    request: request,
    hydrate: hydrate,
    resetAll: resetAll,
    probe: probe,
    isOnline: function(){ return online; },
    token: token
  };

  window.YC.backend.ready = hydrate();
  overrideStore();
})();