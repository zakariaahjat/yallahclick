/* ============================================================
   YallahClick — Storage layer + base service factory
   Static demo: reads/writes localStorage seeded from /data.
   Backend-ready: swap the mapping layer; UI code unchanged.
   ============================================================ */
window.YC = window.YC || {};
YC.SEED_VERSION = '3';
YC.Store = {
  read: function(key){
    try{
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }catch(e){ return null; }
  },
  write: function(key, value){
    try{ localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch(e){ return false; }
  },
  remove: function(key){
    try{ localStorage.removeItem(key); }catch(e){}
  },
  migrate: function(key, seedData){
    /* If the dataset was expanded (SEED_VERSION bumped), drop the
       previously-seeded demo records so the new seed can take over. */
    this.ensureFresh();
    if(!localStorage.getItem(key)){
      this.write(key, seedData);
    }
  },
  ensureFresh: function(){
    try{
      if(localStorage.getItem('yc:seed-version') === YC.SEED_VERSION) return;
      var stale = [];
      for(var i = 0; i < localStorage.length; i++){
        var k = localStorage.key(i);
        if(k && k.indexOf('yc:') === 0 && k !== 'yc:seed-version') stale.push(k);
      }
      stale.forEach(function(k){ localStorage.removeItem(k); });
      localStorage.setItem('yc:seed-version', YC.SEED_VERSION);
    }catch(e){}
  }
};

/* Generic CRUD service factory — used by all domain services.
   Each service manages a single localStorage key seeded with mock data. */
YC.createService = function(key, seedFn, options){
  options = options || {};
  var svc = {
    key: key,

    d: function(){
      var data = YC.Store.read(this.key);
      if(!data){
        data = seedFn();
        YC.Store.write(this.key, data);
      }
      return data;
    },

    save: function(list){
      YC.Store.write(this.key, list);
    },

    reset: function(){
      YC.Store.remove(this.key);
      return this.d();
    },

    all: function(){
      return this.d();
    },

    getById: function(id){
      return this.d().find(function(x){ return String(x.id) === String(id); }) || null;
    },

    nextId: function(list){
      return list.reduce(function(max, x){
        var n = parseInt(x.id, 10);
        return isNaN(n) ? max : Math.max(max, n);
      }, 0) + 1;
    },

    create: function(record){
      var list = this.d();
      var now = new Date().toISOString();
      var r = Object.assign(
        { id: this.nextId(list), createdAt: now, updatedAt: now },
        record
      );
      list.unshift(r);
      this.save(list);
      return r;
    },

    update: function(id, patch){
      var list = this.d();
      var i = list.findIndex(function(x){ return String(x.id) === String(id); });
      if(i < 0) return null;
      list[i] = Object.assign({}, list[i], patch, { updatedAt: new Date().toISOString() });
      this.save(list);
      return list[i];
    },

    remove: function(id){
      this.save(this.d().filter(function(x){ return String(x.id) !== String(id); }));
    },

    seed: function(){
      YC.Store.migrate(this.key, seedFn());
    }
  };

  if(options.extend){
    Object.assign(svc, options.extend);
  }
  return svc;
};