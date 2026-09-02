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

  /* Validate against the backend (/api/auth/login). Falls back to the
     local demo credential only when the API is unreachable, so the
     static demo still opens without a server. Returns { ok, error }. */
  login: function(email, password, remember){
    var self = this;
    var me = { email: String(email || '').trim(), password: String(password || '') };

    // 1) try the backend first (async)
    var attemptApi = function(){
      if(!window.YC || !YC.backend) return Promise.resolve({ ok: false, error: 'Backend not loaded.' });
      return fetch(YC.backend.base + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ email: me.email, password: me.password })
      }).then(function(res){ return res.json().catch(function(){ return {}; }); })
        .then(function(json){
          if (json && json.data && json.data.token){
            self._setSession(json.data.user, json.data.token, remember);
            if (YC.backend) YC.backend.token = function(){ return json.data.token; };
            return { ok: true };
          }
          return { ok: false, error: (json && json.message) || 'Incorrect email or password.' };
        })
        .catch(function(){ return null; }); // API unreachable
    };

    return attemptApi().then(function(res){
      // 3) backend rejected or offline: try local demo creds (offline fallback)
      if (res === null || (res && res.ok === false)){
        var demo = self.DEMO;
        if (String(me.email).trim().toLowerCase() === demo.email && me.password === demo.password){
          var user = { email: demo.email, name: 'YallahClick Admin', role: 'owner' };
          self._setSession(user, 'local-' + Date.now(), remember);
          return { ok: true };
        }
        return res || { ok: false, error: 'Incorrect email or password.' };
      }
      return res;
    });
  },

  _setSession: function(user, token, remember){
    var store = remember ? localStorage : sessionStorage;
    var payload = JSON.stringify({ email: user.email, name: user.name || 'Admin', role: user.role || 'admin', at: new Date().toISOString() });
    store.setItem('yc-auth', payload);
    if (token) store.setItem('yc-token', token);
    var other = remember ? sessionStorage : localStorage;
    other.removeItem('yc-auth');
    other.removeItem('yc-token');
  },

  isLoggedIn: function(){
    return !!(localStorage.getItem('yc-auth') || sessionStorage.getItem('yc-auth'));
  },

  user: function(){
    var raw = localStorage.getItem('yc-auth') || sessionStorage.getItem('yc-auth');
    if(!raw) return null;
    try{ return JSON.parse(raw); }catch(e){ return null; }
  },

  logout: function(){
    localStorage.removeItem('yc-auth');
    sessionStorage.removeItem('yc-auth');
    localStorage.removeItem('yc-token');
    sessionStorage.removeItem('yc-token');
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
      return '<a class="nav-item' + (item.file === currentFile ? ' active' : '') + '" href="' + item.file + '" data-icon="' + item.icon + '" title="' + item.label + '">' +
        '<span class="ic">' + YC.icons.get(item.icon) + '</span><span>' + item.label + '</span>' + count + '</a>';
    }).join('');
    return '<div class="admin-nav-section">' + group.section + '</div>' + rows;
  }).join('');

  html += '<a class="nav-item logout" href="javascript:;" data-logout title="Log out"><span class="ic">' + YC.icons.get('logout') + '</span><span>Log out</span></a>';

  host.innerHTML = html;

  var logoutBtn = host.querySelector('[data-logout]');
  if(logoutBtn) logoutBtn.addEventListener('click', function(){
    YC.auth.logout();
    location.href = 'login.html';
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

/* ---------- page transitions ---------- */
YC.admin.initPageFx = function(){
  /* remove stale key left by the removed sidebar-collapse feature */
  try{ if(localStorage.getItem('yc:sidebar-collapsed') != null) localStorage.removeItem('yc:sidebar-collapsed'); }catch(e){}

  var overlay = document.createElement('div');
  overlay.id = 'pgFx';
  var bar = document.createElement('div');
  bar.id = 'pgBar';
  document.body.appendChild(overlay);
  document.body.appendChild(bar);

  document.body.classList.add('is-boot');
  requestAnimationFrame(function(){
    document.body.classList.add('is-ready');
  });

  function kickbar(){
    bar.getBoundingClientRect();
    document.body.classList.add('pg-busy');
  }
  YC.admin.pageFxKick = kickbar;

  var leaving = false;
  document.addEventListener('click', function(e){
    if(leaving) return;
    var t = e.target;
    var a = t && t.closest ? t.closest('a[href]') : null;
    if(!a) return;
    var href = a.getAttribute('href') || '';
    if(!href || href.charAt(0) === '#' || href.indexOf('javascript:') === 0) return;
    if(a.getAttribute('download') != null) return;
    if(a.target && a.target !== '_self') return;
    if(a.hasAttribute('data-no-fx')) return;
    try{
      if(new URL(href, location.href).origin !== location.origin) return;
    }catch(err){ return; }
    if(e.defaultPrevented) return;
    e.preventDefault();
    leaving = true;
    kickbar();
    document.body.classList.add('pg-leave');
    setTimeout(function(){ location.href = href; }, 250);
  });

  return { kick: kickbar };
};

/* ---------- command palette (Cmd/Ctrl+K) ---------- */
YC.admin.initPalette = function(){
  window.addEventListener('keydown', function(e){
    if((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')){
      e.preventDefault();
      open();
    }
  });

  var host = null, input = null, list = null;

  function build(){
    host = document.createElement('div');
    host.id = 'palette';
    host.className = 'palette';
    host.innerHTML =
      '<div class="palette-backdrop" data-close></div>' +
      '<div class="palette-box" role="dialog" aria-modal="true" aria-label="Quick search">' +
        '<div class="palette-search">' +
          '<span class="palette-ico">' + YC.icons.get('search') + '</span>' +
          '<input id="paletteInput" type="text" placeholder="Jump to a booking, customer, prompt, template or file…" autocomplete="off" spellcheck="false">' +
          '<kbd>ESC</kbd>' +
        '</div>' +
        '<div class="palette-body"><div class="palette-list" id="paletteList"></div></div>' +
      '</div>';
    document.body.appendChild(host);
    input = host.querySelector('#paletteInput');
    list = host.querySelector('#paletteList');
    host.addEventListener('click', function(e){
      if(e.target && e.target.hasAttribute('data-close')) close();
    });
    input.addEventListener('input', function(){ render(input.value); });
    input.addEventListener('keydown', function(e){
      if(e.key === 'Escape'){ close(); }
      else if(e.key === 'Enter'){ goFirst(); }
      else if(e.key === 'ArrowDown'){ move(1); }
      else if(e.key === 'ArrowUp'){ move(-1); }
    });
  }

  function source(){
    var items = [];
    function add(file, ico, label, sub, extra){
      items.push({ file: file, ico: ico, label: label, sub: sub, extra: extra || '' });
    }
    try{
      YC.services.bookings.all().slice(0, 60).forEach(function(b){
        add('bookings.html', 'calendar', b.id + ' · ' + b.customerName, YC.app.svcName(b.serviceId), b.status);
      });
    }catch(e){}
    try{
      YC.services.customers.all().slice(0, 60).forEach(function(c){
        add('customers.html', 'users', c.name, c.email, c.status);
      });
    }catch(e){}
    try{
      YC.services.prompts.all().slice(0, 60).forEach(function(p){
        add('ai-prompts.html', 'prompts', p.title, p.category, p.platform);
      });
    }catch(e){}
    try{
      ['templates', 'videoTemplates', 'thumbnailTemplates'].forEach(function(k){
        if(!YC.services[k]) return;
        YC.services[k].all().slice(0, 40).forEach(function(t){
          add(k === 'templates' ? 'templates.html' : k === 'videoTemplates' ? 'video-templates.html' : 'thumbnail-templates.html', 'layers', t.title, t.category);
        });
      });
    }catch(e){}
    return items;
  }

  var allItems = [];
  var activeIndex = -1;

  function render(q){
    q = (q || '').trim().toLowerCase();
    var pool = q ? allItems.filter(function(it){
      return (it.label + ' ' + it.sub + ' ' + it.extra).toLowerCase().indexOf(q) >= 0;
    }) : allItems.slice();
    activeIndex = -1;
    if(!pool.length){
      list.innerHTML = '<div class="palette-empty">' + (q ? 'No matches for “' + q + '”.' : 'No results.') + '</div>';
      return;
    }
    list.innerHTML = pool.map(function(it, i){
      return '<button type="button" class="palette-item" data-i="' + i + '" data-file="' + it.file + '">' +
        '<span class="palette-item-ico">' + YC.icons.get(it.ico) + '</span>' +
        '<span class="palette-item-main"><b>' + YC.esc(it.label) + '</b>' +
        (it.sub ? '<span class="pi-sub">' + YC.esc(it.sub) + '</span>' : '') + '</span>' +
        (it.extra ? '<span class="pi-tag">' + YC.esc(it.extra) + '</span>' : '') +
        '<span class="pi-arrow">' + YC.icons.get('chevronR') + '</span></button>';
    }).join('');
    list.querySelectorAll('.palette-item').forEach(function(btn){
      btn.addEventListener('click', function(){ goto(btn.getAttribute('data-file')); });
    });
    markActive();
  }

  function markActive(){
    var itemsList = list.querySelectorAll('.palette-item');
    itemsList.forEach(function(el, i){
      el.classList.toggle('active', i === activeIndex);
    });
  }
  function move(d){
    var n = list.querySelectorAll('.palette-item').length;
    if(!n) return;
    activeIndex = (activeIndex + d + n) % n;
    markActive();
    var el = list.querySelector('.palette-item[data-i="' + activeIndex + '"]');
    if(el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }
  function goFirst(){
    var el = list.querySelector('.palette-item.active') || list.querySelector('.palette-item');
    if(el) goto(el.getAttribute('data-file'));
  }
  function goto(file){
    if(!file) return;
    close();
    if(YC.admin && YC.admin.pageFxKick) YC.admin.pageFxKick();
    document.body.classList.add('pg-leave');
    setTimeout(function(){ location.href = file; }, 200);
  }

  function open(){
    if(!host) build();
    allItems = source();
    render(input.value);
    host.classList.add('open');
    document.body.classList.add('palette-open');
    setTimeout(function(){ if(input) input.focus(); }, 30);
  }
  function close(){
    if(!host) return;
    host.classList.remove('open');
    document.body.classList.remove('palette-open');
    if(input) input.value = '';
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
  /* hydrate the API-backed cache, then build the shell */
  var ready = (YC.backend && YC.backend.hydrate) ? YC.backend.hydrate() : Promise.resolve(true);
  Promise.resolve(ready).then(function(){
    YC.admin.buildSidebar();
    YC.admin.buildTopbar(opts);
    YC.admin.initPageFx();
    YC.admin.initPalette();
    YC.undoStack.bind();
  });
};