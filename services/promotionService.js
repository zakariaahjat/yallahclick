/* ============================================================
   YallahClick — Promotion service
   Computes SCHEDULED / ACTIVE / EXPIRED / INACTIVE status
   from dates + the admin `active` flag.
   ============================================================ */
window.YC = window.YC || {};
YC.services = YC.services || {};

(function(){
  var seed = function(){ return JSON.parse(JSON.stringify(YC.data.promotions)); };

  function pad(n){ return (n < 10 ? '0' : '') + n; }
  function dateKey(d){ return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  YC.services.promotions = YC.createService('yc:promotions', seed, {
    extend: {
      STATUS_RANK: { active: 0, scheduled: 1, inactive: 2, expired: 3 },

      /* Compute the effective status. `now` (Date) is injectable for tests/previews. */
      computeStatus: function(p, now){
        now = now || new Date();
        if(p.active === false) return 'inactive';
        var start = new Date(p.startDate + 'T' + (p.startTime || '00:00'));
        var end = new Date(p.endDate + 'T' + (p.endTime || '23:59'));
        if(now < start) return 'scheduled';
        if(now > end) return 'expired';
        return 'active';
      },

      allWithStatus: function(){
        var self = this;
        return this.all().map(function(p){
          return Object.assign({}, p, { status: self.computeStatus(p) });
        });
      },

      getActiveForPopup: function(){
        var self = this;
        var active = this.allWithStatus().filter(function(p){
          return p.status === 'active' && p.popupEnabled && p.serviceId;
        });
        if(!active.length) return null;
        active.sort(function(a, b){
          if(!!a.featured !== !!b.featured) return a.featured ? -1 : 1;
          return String(b.startDate).localeCompare(String(a.startDate));
        });
        return active[0];
      },

      toggleActive: function(id){
        var p = this.getById(id);
        if(!p) return null;
        return this.update(id, { active: p.active === false });
      },

      search: function(q){
        q = (q || '').trim().toLowerCase();
        if(!q) return this.allWithStatus();
        return this.allWithStatus().filter(function(p){
          return p.title.toLowerCase().indexOf(q) >= 0 ||
                 (p.promoCode || '').toLowerCase().indexOf(q) >= 0 ||
                 (p.description || '').toLowerCase().indexOf(q) >= 0;
        });
      },

      activeCount: function(){
        var self = this;
        return this.allWithStatus().filter(function(p){ return p.status === 'active'; }).length;
      }
    }
  });

  /* Re-seed once when stored data was created before the
     `promoType` field existed, so the new offers actually appear. */
  var existing = YC.Store.read('yc:promotions');
  if(existing && (!existing.length || existing.some(function(p){ return p.promoType === undefined; }))){
    YC.Store.remove('yc:promotions');
  }
  YC.services.promotions.seed();
})();