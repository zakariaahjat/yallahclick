/* ============================================================
   YallahClick — Admin common (auth + shell chrome)
   ============================================================ */
window.YC = window.YC || {};
YC.admin = YC.admin || {};

/* ---------- auth: validates against the admin accounts stored in
   localStorage (adminService). Falls back to the demo credentials
   only when the accounts service isn't loaded. ---------- */
YC.auth = {
  DEMO: { email: 'admin@yallahclick.com', password: 'admin123' },

  login: function(email, password, remember){
    var user = null;
    if(YC.services && YC.services.admins){
      var au = YC.services.admins.authenticate(email, password);
      if(au) user = au;
    }
    if(!user){
      if(String(email).trim().toLowerCase() === this.DEMO.email && password === this.DEMO.password){
        user = { email: this.DEMO.email, name: 'YallahClick Admin', role: 'owner' };
      }
    }
    if(!user) return { ok: false, error: 'Incorrect email or password. Try the demo credentials.' };
    var payload = JSON.stringify({ email: user.email, name: user.name || 'Admin', role: user.role || 'admin', at: new Date().toISOString() });
    if(remember){
      localStorage.setItem('yc-auth', payload);
      sessionStorage.removeItem('yc-session');
    }else{
      sessionStorage.setItem('yc-session', payload);
    }
    return { ok: true };
  },

  isLoggedIn: function(){
    return !!(localStorage.getItem('yc-auth') || sessionStorage.getItem('yc-session'));
  },

  user: function(){
    var raw = localStorage.getItem('yc-auth') || sessionStorage.getItem('yc-session');
    if(!raw) return null;
    try{ return JSON.parse(raw); }catch(e){ return null; }
  },

  logout: function(){
    localStorage.removeItem('yc-auth');
    sessionStorage.removeItem('yc-session');
  },

  guard: function(redirect){
    if(!this.isLoggedIn()){
      location.href = redirect || 'login.html';
      return false;
    }
    return true;
  }
};

/* ---------- sidebar ---------- */
YC.admin.navItems = [
  {
    section: 'Overview',
    items: [
      { page: 'dashboard', file: 'index.html', label: 'Dashboard', icon: 'dashboard' }
    ]
  },
  {
    section: 'Operations',
    items: [
      { page: 'bookings', file: 'bookings.html', label: 'Bookings', icon: 'bookings', count: 'bookings-pending' },
      { page: 'customers', file: 'customers.html', label: 'Customers', icon: 'customers', count: 'customers-total' }
    ]
  },
  {
    section: 'Content Library',
    items: [
      { page: 'content', file: 'content.html', label: 'Content Hub', icon: 'content' },
      { page: 'ai-prompts', file: 'ai-prompts.html', label: 'AI Prompts', icon: 'prompts', count: 'prompts-published' },
      { page: 'templates', file: 'templates.html', label: 'Templates', icon: 'templates', count: 'templates-published' },
      { page: 'video-templates', file: 'video-templates.html', label: 'Video Templates', icon: 'video', count: 'video-published' },
      { page: 'thumbnail-templates', file: 'thumbnail-templates.html', label: 'Thumbnail Templates', icon: 'thumbnail', count: 'thumb-published' },
      { page: 'files', file: 'files.html', label: 'Files', icon: 'files' }
    ]
  },
  {
    section: 'Growth',
    items: [
      { page: 'promotions', file: 'promotions.html', label: 'Promotions', icon: 'promotions' },
      { page: 'categories', file: 'categories.html', label: 'Categories', icon: 'categories' },
      { page: 'analytics', file: 'analytics.html', label: 'Analytics', icon: 'analytics' }
    ]
  },
  {
    section: 'System',
    items: [
      { page: 'users', file: 'users.html', label: 'Users', icon: 'users', count: 'admins-total' },
      { page: 'settings', file: 'settings.html', label: 'Settings', icon: 'settings' }
    ]
  }
];

YC.admin.counts = function(){
  var c = {};
  try{
    c['bookings-pending'] = YC.services.bookings.all().filter(function(b){ return b.status === 'pending'; }).length;
    c['customers-total'] = YC.services.customers.all().length;
    c['prompts-published'] = YC.services.prompts.all().filter(function(p){ return p.published; }).length;
    c['templates-published'] = YC.services.templates.all().filter(function(t){ return t.published; }).length;
    c['video-published'] = YC.services.videoTemplates.all().filter(function(t){ return t.published; }).length;
    c['thumb-published'] = YC.services.thumbnailTemplates.all().filter(function(t){ return t.published; }).length;
    if(YC.services.admins) c['admins-total'] = YC.services.admins.all().length;
  }catch(e){}
  return c;
};

YC.admin.setNavCount = function(key, value){
  var el = document.querySelector('.nav-item[data-count="' + key + '"] .nav-count');
  if(el) el.textContent = value;
};

YC.admin.buildSidebar = function(){
  var host = document.getElementById('adminSidebarNav');
  if(!host) return;

  var currentFile = location.pathname.split('/').pop() || 'index.html';
  var counts = YC.admin.counts();

  var html = YC.admin.navItems.map(function(group){
    var rows = group.items.map(function(item){
      var active = item.file === currentFile ? ' class="active"' : '';
      var count = '';
      if(item.count && counts[item.count] > 0){
        count = '<span class="nav-count" data-count="' + item.count + '">' + counts[item.count] + '</span>';
      }
      return '<a class="nav-item' + (item.file === currentFile ? ' active' : '') + '" href="' + item.file + '" data-icon="' + item.icon + '">' +
        '<span class="ic">' + YC.icons.get(item.icon) + '</span><span>' + item.label + '</span>' + count + '</a>';
    }).join('');
    return '<div class="admin-nav-section">' + group.section + '</div>' + rows;
  }).join('');

  html += '<a class="nav-item logout" href="javascript:;" data-logout><span class="ic">' + YC.icons.get('logout') + '</span><span>Log out</span></a>';

  host.innerHTML = html;

  var logoutBtn = host.querySelector('[data-logout]');
  if(logoutBtn) logoutBtn.addEventListener('click', function(){
    YC.auth.logout();
    location.href = 'login.html';
  });
};

/* ---------- drawer (mobile) ---------- */
YC.admin.initDrawer = function(){
  var burger = document.getElementById('adminBurger');
  var sidebar = document.getElementById('adminSidebar');
  var closeBtn = document.querySelector('.sidebar-close');
  var scrim = document.getElementById('adminScrim');

  function open(){
    sidebar.classList.add('open');
    if(scrim) scrim.classList.add('open');
  }
  function close(){
    sidebar.classList.remove('open');
    if(scrim) scrim.classList.remove('open');
  }
  if(burger) burger.addEventListener('click', open);
  if(closeBtn) closeBtn.addEventListener('click', close);
  if(scrim) scrim.addEventListener('click', close);
};

/* ---------- topbar ---------- */
YC.admin.buildTopbar = function(opts){
  opts = opts || {};
  var crumb = document.getElementById('topbarCrumb');
  var title = document.getElementById('topbarTitle');
  if(crumb) crumb.innerHTML = 'Admin <b>/</b> ' + YC.esc(opts.crumb || '');
  if(title) title.textContent = opts.title || '';

  var user = YC.auth.user();
  var u = document.getElementById('adminUser');
  if(u && user){
    u.innerHTML =
      '<span class="au-avatar">' + YC.avatar(user.name || 'YC') + '</span>' +
      '<span class="au-meta"><span class="au-name">' + YC.esc(user.name || 'Admin') + '</span>' +
      '<span class="au-role">' + (user.role === 'owner' ? 'Owner' : 'Administrator') + '</span></span>';
  }
};

/* ---------- boot ---------- */
YC.admin.boot = function(opts){
  opts = opts || {};
  YC.theme.init();
  if(opts.guard !== false){
    if(!YC.auth.guard()){
      return;
    }
  }
  YC.admin.buildSidebar();
  YC.admin.initDrawer();
  YC.admin.buildTopbar(opts);
};