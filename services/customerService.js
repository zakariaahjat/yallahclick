/* ============================================================
   YallahClick — Customer service
   Derives booking counts from the booking service.
   ============================================================ */
window.YC = window.YC || {};
YC.services = YC.services || {};

(function(){
  var seed = function(){ return JSON.parse(JSON.stringify(YC.data.customers)); };

  function enrich(customer){
    var c = Object.assign({}, customer);
    var bookings = YC.services.bookings.all().filter(function(b){
      return String(b.customerId) === String(c.id);
    });
    c.bookingCount = bookings.length;
    var last = bookings.slice().sort(function(a, b){ return b.date.localeCompare(a.date); })[0];
    c.lastBooking = last ? { date: last.date, serviceName: last.serviceName || last.serviceId } : null;
    return c;
  }

  YC.services.customers = YC.createService('yc:customers', seed, {
    extend: {
      allWithStats: function(){
        return this.all().map(enrich);
      },
      getWithStats: function(id){
        var c = this.getById(id);
        return c ? enrich(c) : null;
      },
      search: function(q){
        q = (q || '').trim().toLowerCase();
        if(!q) return this.allWithStats();
        return this.allWithStats().filter(function(c){
          return c.name.toLowerCase().indexOf(q) >= 0 ||
                 (c.email || '').toLowerCase().indexOf(q) >= 0 ||
                 (c.phone || '').toLowerCase().indexOf(q) >= 0;
        });
      },
      toggleStatus: function(id){
        var c = this.getById(id);
        if(!c) return null;
        return this.update(id, { status: c.status === 'active' ? 'disabled' : 'active' });
      },
      recent: function(limit){
        return this.allWithStats()
          .sort(function(a, b){ return String(b.registered).localeCompare(String(a.registered)); })
          .slice(0, limit || 5);
      },
      bookingHistory: function(customerId){
        return YC.services.bookings.all()
          .filter(function(b){ return String(b.customerId) === String(customerId); })
          .sort(function(a, b){ return String(b.createdAt).localeCompare(String(a.createdAt)); });
      }
    }
  });

  YC.services.customers.seed();
})();