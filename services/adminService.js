/* ============================================================
   YallahClick — Admin accounts service
   Used by the admin Users page (CRUD) and by the login flow.
   ============================================================ */
window.YC = window.YC || {};
YC.services = YC.services || {};

(function(){
  var seed = function(){ return JSON.parse(JSON.stringify(YC.data.admins)); };

  YC.services.admins = YC.createService('yc:admins', seed, {
    extend: {
      byEmail: function(email){
        var e = String(email || '').trim().toLowerCase();
        if(!e) return null;
        return this.all().find(function(a){ return String(a.email).toLowerCase() === e; }) || null;
      },

      /* Returns the account when email+password match AND the account
         is not disabled. Returns null otherwise. */
      authenticate: function(email, password){
        var u = this.byEmail(email);
        if(!u) return null;
        if(String(u.status) === 'disabled') return null;
        if(String(u.password) !== String(password || '')) return null;
        return u;
      },

      activeCount: function(){
        return this.all().filter(function(a){ return String(a.status) !== 'disabled'; }).length;
      },

      firstName: function(name){
        return String(name || 'Admin').split(/\s+/)[0];
      }
    }
  });

  YC.services.admins.seed();
})();