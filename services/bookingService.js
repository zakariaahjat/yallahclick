/* ============================================================
   YallahClick — Booking service
   ============================================================ */
window.YC = window.YC || {};
YC.services = YC.services || {};

(function(){
  var seed = function(){ return JSON.parse(JSON.stringify(YC.data.bookings)); };

  YC.services.bookings = YC.createService('yc:bookings', seed, {
    extend: {
      STATUSES: ['pending', 'confirmed', 'cancelled', 'completed'],

      setStatus: function(id, status){
        if(this.STATUSES.indexOf(status) < 0) return null;
        return this.update(id, { status: status });
      },

      search: function(q){
        q = (q || '').trim().toLowerCase();
        if(!q) return this.all();
        return this.all().filter(function(b){
          return String(b.id).toLowerCase().indexOf(q) >= 0 ||
                 (b.customerName || '').toLowerCase().indexOf(q) >= 0 ||
                 (b.email || '').toLowerCase().indexOf(q) >= 0 ||
                 (b.phone || '').toLowerCase().indexOf(q) >= 0 ||
                 (b.serviceName ? b.serviceName.toLowerCase().indexOf(q) >= 0 : false);
        });
      },

      byStatus: function(status){
        if(!status || status === 'all') return this.all();
        return this.all().filter(function(b){ return b.status === status; });
      },

      betweenDates: function(range){
        if(!range || !range.from) return null; // handled by caller
        return this.all().filter(function(b){
          if(range.from && b.date < range.from) return false;
          if(range.to && b.date > range.to) return false;
          return true;
        });
      },

      upcoming: function(limit){
        var today = new Date().toISOString().slice(0, 10);
        return this.all()
          .filter(function(b){ return b.date >= today && b.status !== 'cancelled'; })
          .sort(function(a, b){ return a.date.localeCompare(b.date); })
          .slice(0, limit || 5);
      },

      recent: function(limit){
        return this.all()
          .slice()
          .sort(function(a, b){ return String(b.createdAt).localeCompare(String(a.createdAt)); })
          .slice(0, limit || 6);
      }
    }
  });

  YC.services.bookings.seed();
})();