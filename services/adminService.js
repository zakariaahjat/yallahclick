/* ============================================================
   YallahClick - Staff accounts service (users)
   Powers the admin Users page (CRUD), the login flow and the
   role labels used across the admin shell. Reads/writes go
   through the API-backed store (collection `users`), so account
   management here is exactly what /api/auth/login enforces.
   ============================================================ */
window.YC = window.YC || {};
YC.services = YC.services || {};

(function(){
  var seed = function(){
    var src = YC.data.users || YC.data.admins || [];
    return JSON.parse(JSON.stringify(src));
  };

  YC.services.users = YC.createService('yc:users', seed, {
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
        return String(name || 'Staff').split(/\s+/)[0];
      }
    }
  });

  YC.services.users.seed();
})();