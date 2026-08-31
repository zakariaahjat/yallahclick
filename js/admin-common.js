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
  var lastFocus = null;

  function isOpen(){
    return !!sidebar && sidebar.classList.contains('open');
  }
  function open(){
    if(!sidebar || isOpen()) return;
    lastFocus = document.activeElement;
    sidebar.classList.add('open');
    if(scrim) scrim.classList.add('open');
    if(burger) burger.setAttribute('aria-expanded', 'true');
    sidebar.setAttribute('aria-hidden', 'false');
    var first = sidebar.querySelector('a, button, [tabindex]:not([tabindex="-1"])');
    if(first) setTimeout(function(){ first.focus(); }, 40);
  }
  function close(){
    if(!sidebar || !isOpen()) return;
    sidebar.classList.remove('open');
    if(scrim) scrim.classList.remove('open');
    if(burger) burger.setAttribute('aria-expanded', 'false');
    sidebar.setAttribute('aria-hidden', 'true');
    if(burger){
      if(lastFocus && lastFocus.focus){ lastFocus.focus(); }
      else { burger.focus(); }
    }
    lastFocus = null;
  }
  if(burger){
    burger.setAttribute('aria-controls', 'adminSidebar');
    burger.setAttribute('aria-expanded', 'false');
    burger.addEventListener('click', function(){ if(!isOpen()) open(); });
  }
  if(sidebar) sidebar.setAttribute('aria-hidden', 'true');
  if(closeBtn) closeBtn.addEventListener('click', close);
  if(scrim) scrim.addEventListener('click', close);
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && isOpen()) close();
  });
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

/* ---------- undo / redo stack (in-memory) ---------- */
YC.undoStack = (function(){
  var undoStack = [];
  var redoStack = [];
  var MAX = 100;

  function push(undoFn, label, redoFn){
    undoStack.push({ undo: undoFn, label: label || 'Action', redo: redoFn || null });
    redoStack = [];
    if(undoStack.length > MAX) undoStack.shift();
  }

  function undo(){
    if(!undoStack.length){
      YC.toast.info('Nothing to undo.');
      return false;
    }
    var entry = undoStack.pop();
    try{ entry.undo(); }
    catch(e){ if(window.console) console.error('Undo failed:', e); }
    if(entry.redo) redoStack.push(entry);
    try{ YC.toast.success('Undid: ' + entry.label); }catch(e){}
    return true;
  }

  function redo(){
    if(!redoStack.length){
      YC.toast.info('Nothing to redo.');
      return false;
    }
    var entry = redoStack.pop();
    try{ entry.redo(); }
    catch(e){ if(window.console) console.error('Redo failed:', e); }
    undoStack.push(entry);
    try{ YC.toast.success('Redid: ' + entry.label); }catch(e){}
    return true;
  }

  /* Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y keyboard handler for the admin shell. */
  function bind(){
    document.addEventListener('keydown', function(e){
      if(!(e.ctrlKey || e.metaKey) || e.altKey) return;
      var k = String(e.key || '').toLowerCase();
      if(e.shiftKey && k === 'z'){ e.preventDefault(); redo(); }
      else if(k === 'z'){ e.preventDefault(); undo(); }
      else if(k === 'y'){ e.preventDefault(); redo(); }
    });
  }

  return { push: push, undo: undo, redo: redo, bind: bind };
})();
YC.adminHistory = YC.undoStack;

/* ---------- toast with inline action buttons (does NOT modify YC.toast) ---------- */
YC.admin.actionToast = function(msg, actions){
  var box = document.getElementById('toastContainer');
  if(!box){
    box = document.createElement('div');
    box.className = 'toast-container';
    box.id = 'toastContainer';
    document.body.appendChild(box);
  }
  actions = actions || [];
  var buttons = actions.map(function(a){
    return '<button type="button" class="toast-action">' + YC.esc(a.label) + '</button>';
  }).join('');
  var t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = '<span>' + YC.esc(msg) + '</span>' + buttons;
  box.appendChild(t);
  requestAnimationFrame(function(){ t.classList.add('show'); });

  function dismiss(){
    t.classList.add('hide');
    setTimeout(function(){ t.remove(); }, 400);
  }
  actions.forEach(function(a, i){
    var btn = t.querySelectorAll('.toast-action')[i];
    if(btn) btn.addEventListener('click', function(){
      dismiss();
      if(a.onClick) a.onClick();
    });
  });
  return { dismiss: dismiss, el: t };
};

/* Restore a deleted record back into a service without ever throwing.
   Prefers an `add` method when present; otherwise re-inserts the item
   directly, falling back to `create` only if that too fails. */
function YCAdminRestore(svc, item){
  if(svc && item){
    if(typeof svc.add === 'function'){
      try{ svc.add(item); return; }catch(e){}
    }
    try{
      var list = svc.all();
      var exists = list.some(function(r){ return String(r.id) === String(item.id); });
      if(!exists){
        list.unshift(item);
        if(typeof svc.save === 'function') svc.save(list);
      }
      return;
    }catch(e){}
    if(typeof svc.create === 'function'){
      try{ svc.create(item); return; }catch(e2){}
    }
  }
}

/* Deferred delete with an inline "Undo" button in the toast.
   The removal is delayed ~5s; pressing Undo cancels it. After a
   successful removal the record is pushed onto the undo stack so
   Ctrl+Z can also restore it. Fires `onDone` once removed. */
YC.admin.undoableDelete = function(svc, id, label, onDone){
  var snapshot = null;
  try{
    var item = (svc && svc.getById) ? svc.getById(id) : null;
    if(item) snapshot = JSON.parse(JSON.stringify(item));
  }catch(e){ snapshot = null; }

  var cancelled = false;
  var removed = false;
  var toast = YC.admin.actionToast('Deleting ' + (label || id) + '\u2026', [
    { label: 'Undo', onClick: function(){
        cancelled = true;
        YC.toast.info((label || id) + ' was kept.');
      } }
  ]);

  setTimeout(function(){
    if(cancelled) return;
    try{ svc.remove(id); removed = true; }catch(e){ if(window.console) console.error(e); }
    if(toast && toast.dismiss) toast.dismiss();
    YC.toast.success('Deleted ' + (label || id) + '.');
    if(removed && snapshot){
      YC.undoStack.push(function(){
        YCAdminRestore(svc, snapshot);
      }, 'Delete ' + (label || id));
    }
    if(onDone) onDone();
  }, 5000);
};

/* ---------- CSV export for tables ---------- */
YC.exportCSV = function(filename, rows, columns){
  var safe = function(v){
    var s = String(v == null ? '' : v);
    if(/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  var lines = [];
  lines.push(columns.map(function(c){ return safe(c.title != null ? c.title : c); }).join(','));
  rows.forEach(function(r){
    lines.push(columns.map(function(c){
      var key = c.key != null ? c.key : c;
      var val = r[key] != null ? r[key] : '';
      if(typeof c.render === 'function'){
        val = c.render(r) || '';
        val = String(val).replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&middot;/g, '·');
      }
      return safe(val);
    }).join(','));
  });
  var csv = '\uFEFF' + lines.join('\r\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
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
  YC.undoStack.bind();
};