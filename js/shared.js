/* ============================================================
   YallahClick — Shared UI utilities (theme, toast, icons,
   modal, charts, public site chrome). No framework required.
   ============================================================ */
window.YC = window.YC || {};
YC.util = YC.util || {};

/* ---------- tiny DOM helpers ---------- */
YC.$ = function(sel, ctx){ return (ctx || document).querySelector(sel); };
YC.$$ = function(sel, ctx){ return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
YC.esc = function(str){
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};
YC.debounce = function(fn, wait){
  var t; return function(){
    var ctx = this, args = arguments;
    clearTimeout(t); t = setTimeout(function(){ fn.apply(ctx, args); }, wait || 200);
  };
};
YC.slugify = function(str){
  return String(str).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
};
YC.uid = function(prefix){
  return (prefix || 'id') + '-' + Math.random().toString(36).slice(2, 9);
};

/* ---------- date helpers ---------- */
YC.fmtDate = function(iso){
  if(!iso) return '—';
  var d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
  if(isNaN(d.getTime())) return iso;
  var m = String(d.getMonth() + 1).padStart(2, '0');
  return d.getDate() + ' ' + m + ' ' + d.getFullYear();
};
YC.fmtDateTime = function(iso){
  if(!iso) return '—';
  var d = new Date(iso);
  if(isNaN(d.getTime())) return iso;
  var h = String(d.getHours()).padStart(2, '0');
  var min = String(d.getMinutes()).padStart(2, '0');
  return YC.fmtDate(iso) + ' · ' + h + ':' + min;
};
YC.timeAgo = function(iso){
  if(!iso) return '—';
  var d = new Date(iso);
  if(isNaN(d.getTime())) return '—';
  var s = Math.floor((Date.now() - d.getTime()) / 1000);
  if(s < 60) return 'just now';
  var m = Math.floor(s / 60);
  if(m < 60) return m + 'm ago';
  var h = Math.floor(m / 60);
  if(h < 24) return h + 'h ago';
  var days = Math.floor(h / 24);
  if(days < 30) return days + 'd ago';
  return YC.fmtDate(iso);
};

/* ---------- theme ---------- */
YC.theme = (function(){
  var html = document.documentElement;
  function preferred(){
    var stored = localStorage.getItem('yc-theme');
    if(stored) return stored;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  function apply(t){
    html.setAttribute('data-theme', t);
    localStorage.setItem('yc-theme', t);
    syncLabels();
  }
  function syncLabels(){
    var dark = html.getAttribute('data-theme') === 'dark';
    var els = document.querySelectorAll('[data-theme-label]');
    for(var i = 0; i < els.length; i++){
      els[i].textContent = dark ? 'Switch to light mode' : 'Switch to dark mode';
    }
  }
  function init(){
    apply(preferred());
    var toggles = Array.prototype.slice.call(document.querySelectorAll('.theme-toggle:not(.burger-admin), #themeToggle'));
    toggles = toggles.filter(function(t, i){ return toggles.indexOf(t) === i; });
    toggles.forEach(function(t){
      t.addEventListener('click', function(){
        apply(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
      });
    });
  }
  function current(){ return html.getAttribute('data-theme') || 'dark'; }
  return { init: init, apply: apply, current: current };
})();

/* ---------- ambience (page spotlight + cursor dot) ---------- */
YC.ambience = (function(){
  function init(){
    if(!window.matchMedia || !window.matchMedia('(hover:hover)').matches) return;
    if(!document.querySelector('.site-header')) return;
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if(!document.getElementById('heroSpotlight') && !document.querySelector('.page-spotlight')){
      var s = document.createElement('div');
      s.className = 'page-spotlight';
      document.body.appendChild(s);
      var mx = 45, my = 20, sx = 45, sy = 20;
      var set = function(){ s.style.setProperty('--mx', sx + '%'); s.style.setProperty('--my', sy + '%'); };
      document.addEventListener('mousemove', function(e){
        mx = (e.clientX / window.innerWidth) * 100;
        my = (e.clientY / window.innerHeight) * 100;
      });
      if(!reduced){
        (function loop(){
          sx += (mx - sx) * 0.06;
          sy += (my - sy) * 0.06;
          set();
          requestAnimationFrame(loop);
        })();
      }else{
        set();
      }
      requestAnimationFrame(function(){ s.classList.add('on'); });
    }

    if(!document.querySelector('.cursor-dot')){
      var layers = {};
      ['cursor-dot', 'cursor-ring', 'cursor-label'].forEach(function(cls){
        var el = document.createElement('div');
        el.className = cls;
        el.id = cls;
        document.body.appendChild(el);
        layers[cls] = el;
      });
      var dot = layers['cursor-dot'], ring = layers['cursor-ring'], label = layers['cursor-label'];
      var mouseX = 0, mouseY = 0, dotX = 0, dotY = 0, ringX = 0, ringY = 0;
      document.addEventListener('mousemove', function(e){
        mouseX = e.clientX;
        mouseY = e.clientY;
      });
      function cursorVisibility(){
        var dark = document.documentElement.getAttribute('data-theme') === 'dark';
        var show = dark && !reduced && document.visibilityState === 'visible';
        [dot, ring, label].forEach(function(el){ el.style.display = show ? 'block' : 'none'; });
      }
      function animateLayers(){
        dotX += (mouseX - dotX) * 0.25;
        dotY += (mouseY - dotY) * 0.25;
        ringX += (mouseX - ringX) * 0.1;
        ringY += (mouseY - ringY) * 0.1;
        dot.style.left = (dotX - 4) + 'px';
        dot.style.top = (dotY - 4) + 'px';
        ring.style.left = (ringX - 20) + 'px';
        ring.style.top = (ringY - 20) + 'px';
        label.style.left = (ringX + 26) + 'px';
        label.style.top = (ringY - 12) + 'px';
        if(document.visibilityState === 'visible' && !reduced) requestAnimationFrame(animateLayers);
      }
      if(!reduced) animateLayers();

      var hoverables = 'a, button, [role="button"], .card, .tpl-card, .prompt-card, .work-card, input, select, textarea, .seg-control button, .gallery-strip img';
      document.addEventListener('mouseover', function(e){
        var t = e.target;
        if(t.closest && t.closest('a, button, [role="button"]')){
          ring.classList.add('grow');
        }
      });
      document.addEventListener('mouseout', function(e){
        if(e.target.closest && e.target.closest('a, button, [role="button"]')) ring.classList.remove('grow');
      });

      function updateCursorVisibility(){
        cursorVisibility();
      }
      updateCursorVisibility();
      document.addEventListener('visibilitychange', updateCursorVisibility);
      var obs = new MutationObserver(updateCursorVisibility);
      obs.observe(document.documentElement, { attributes:true, attributeFilter:['data-theme'] });
    }
  }
  return { init: init };
})();

/* ---------- motion detection (performance-aware) ---------- */
YC.motion = (function(){
  var state = { reduced: false, low: false };
  function detect(){
    var rm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    state.reduced = rm ? rm.matches : false;
    var cores = navigator.hardwareConcurrency || 8;
    var mem = navigator.deviceMemory || 8;
    state.low = cores <= 2 || mem <= 2;
    return state;
  }
  function allows(){
    detect();
    return !state.reduced && !state.low;
  }
  return { detect: detect, allows: allows, state: state };
})();

/* ---------- confetti (dependency-free canvas burst) ---------- */
YC.confetti = (function(){
  var canvas, ctx, parts = [], raf = null;
  function ensure(){
    if(!canvas){
      canvas = document.createElement('canvas');
      canvas.className = 'confetti-canvas';
      document.body.appendChild(canvas);
      ctx = canvas.getContext('2d');
      function resize(){
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
      window.addEventListener('resize', resize);
      resize();
    }
    return ctx;
  }
  function burst(opts){
    opts = opts || {};
    var cx = opts.x != null ? opts.x : window.innerWidth / 2;
    var cy = opts.y != null ? opts.y : window.innerHeight / 2;
    var count = opts.count || 80;
    var g = ensure();
    var colors = ['#ff3344', '#ff8a74', '#ffd76a', '#ffffff', '#f8f7f4'];
    for(var i = 0; i < count; i++){
      var a = Math.random() * Math.PI * 2;
      var sp = 3 + Math.random() * 6;
      parts.push({
        x: cx, y: cy,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2,
        size: 4 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1, rot: Math.random() * Math.PI, vr: (Math.random() - .5) * .2,
        shape: Math.random() < .5 ? 'rect' : 'circle'
      });
    }
    if(!raf) draw();
  }
  function draw(){
    var g = ensure();
    g.clearRect(0, 0, canvas.width, canvas.height);
    var alive = [];
    parts.forEach(function(p){
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.12; p.vx *= 0.99;
      p.rot += p.vr; p.life -= 0.012;
      if(p.life <= 0 || p.y > canvas.height + 20) return;
      alive.push(p);
      g.save();
      g.globalAlpha = Math.max(p.life, 0);
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.fillStyle = p.color;
      if(p.shape === 'rect') g.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      else { g.beginPath(); g.arc(0, 0, p.size / 2, 0, Math.PI * 2); g.fill(); }
      g.restore();
    });
    parts = alive;
    if(parts.length){ raf = requestAnimationFrame(draw); }
    else { g.clearRect(0, 0, canvas.width, canvas.height); raf = null; }
  }
  return { burst: burst };
})();

/* ---------- command palette (Cmd/Ctrl+K) ---------- */
YC.palette = (function(){
  var overlay, input, listEl, items = [], index = 0, open = false;
  function itemsData(){
    var out = [];
    var pages = [
      { label: 'Home', hint: 'index.html', href: 'index.html' },
      { label: 'AI Prompts', hint: 'ai-prompts.html', href: 'ai-prompts.html' },
      { label: 'Templates', hint: 'templates.html', href: 'templates.html' },
      { label: 'Video Templates', hint: 'video-templates.html', href: 'video-templates.html' },
      { label: 'Thumbnails', hint: 'thumbnail-templates.html', href: 'thumbnail-templates.html' },
      { label: 'Book a Call', hint: 'index.html#book', href: 'index.html#book' }
    ];
    pages.forEach(function(p){ p.action = 'nav'; out.push(p); });
    out.push({ label: 'Toggle light / dark mode', hint: 'theme', action: 'theme' });
    return out;
  }
  function ensure(){
    if(!overlay){
      overlay = document.createElement('div');
      overlay.className = 'palette-overlay';
      overlay.innerHTML =
        '<div class="palette-box" role="dialog" aria-modal="true" aria-label="Command palette">' +
          '<div class="palette-input-wrap">' +
            '<span class="palette-ico"></span>' +
            '<input class="palette-input" type="text" placeholder="Type a page, prompt or action\u2026" autocomplete="off">' +
            '<kbd class="palette-kbd">ESC</kbd>' +
          '</div>' +
          '<ul class="palette-list"></ul>' +
        '</div>';
      document.body.appendChild(overlay);
      input = overlay.querySelector('.palette-input');
      listEl = overlay.querySelector('.palette-list');
      overlay.addEventListener('click', function(e){ if(e.target === overlay) hide(); });
      input.addEventListener('input', function(){ render(); select(0); });
      input.addEventListener('keydown', function(e){
        if(e.key === 'Escape'){ e.preventDefault(); hide(); }
        else if(e.key === 'ArrowDown'){ e.preventDefault(); select(index + 1); }
        else if(e.key === 'ArrowUp'){ e.preventDefault(); select(index - 1); }
        else if(e.key === 'Enter'){ e.preventDefault(); choose(items[index]); }
      });
      overlay.addEventListener('keydown', function(e){
        if(e.key === 'Escape') hide();
      });
    }
    return overlay;
  }
  function render(){
    var q = (input.value || '').toLowerCase().trim();
    var all = itemsData();
    items = q
      ? all.filter(function(i){
          return (i.label + ' ' + (i.hint || '')).toLowerCase().indexOf(q) >= 0;
        })
      : all;
    if(!items.length){
      listEl.innerHTML = '<li class="palette-empty">No results</li>';
      return;
    }
    listEl.innerHTML = items.map(function(it, i){
      return '<li data-i="' + i + '" class="' + (i === index ? 'active' : '') + '">' +
        '<span class="p-label">' + YC.esc(it.label) + '</span>' +
        '<span class="p-hint">' + YC.esc(it.hint || '') + '</span></li>';
    }).join('');
  }
  function select(i){
    if(!items.length) return;
    index = (i + items.length) % items.length;
    var els = listEl.querySelectorAll('li[data-i]');
    els.forEach(function(el){ el.classList.remove('active'); });
    var cur = listEl.querySelector('li[data-i="' + index + '"]');
    if(cur){ cur.classList.add('active'); cur.scrollIntoView({ block: 'nearest' }); }
  }
  function choose(it){
    if(!it) return;
    if(it.action === 'theme'){
      var html = document.documentElement;
      YC.theme.apply(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    }else{
      window.location.href = it.href;
    }
    hide();
  }
  function show(){
    ensure();
    items = itemsData();
    items[0] = items[0];
    index = 0;
    render(); select(0);
    overlay.classList.add('open');
    open = true;
    input.value = '';
    setTimeout(function(){ input.focus(); }, 30);
  }
  function hide(){
    if(!overlay) return;
    overlay.classList.remove('open');
    open = false;
  }
  function init(){
    document.addEventListener('keydown', function(e){
      if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'){
        e.preventDefault();
        open ? hide() : show();
      }
    });
  }
  return { init: init, show: show, hide: hide };
})();

/* ---------- view transitions (cross-page, progressive) ---------- */
YC.transition = (function(){
  function go(href){
    href = href || 'index.html';
    if(document.startViewTransition){
      document.startViewTransition(function(){ window.location.href = href; });
    }else{
      window.location.href = href;
    }
  }
  function wire(selector){
    selector = selector || 'a[data-transition]';
    document.querySelectorAll(selector).forEach(function(a){
      a.addEventListener('click', function(e){
        var href = a.getAttribute('href');
        if(!href || href.charAt(0) === '#') return;
        e.preventDefault();
        go(href);
      });
    });
  }
  return { go: go, wire: wire };
})();

/* ---------- toast ---------- */
YC.toast = (function(){
  var container;
  function ensure(){
    if(!container){
      container = document.getElementById('toastContainer');
      if(!container){
        container = document.createElement('div');
        container.className = 'toast-container';
        container.id = 'toastContainer';
        document.body.appendChild(container);
      }
    }
    return container;
  }
  function show(msg, type){
    var box = ensure();
    var icons = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };
    var t = document.createElement('div');
    t.className = 'toast' + (type && icons[type] ? ' ' + type : '');
    t.innerHTML = '<span class="t-ico">' + (type && icons[type] ? icons[type] : icons.info) + '</span><span>' + YC.esc(msg) + '</span>';
    box.appendChild(t);
    requestAnimationFrame(function(){ t.classList.add('show'); });
    setTimeout(function(){
      t.classList.add('hide');
      setTimeout(function(){ t.remove(); }, 400);
    }, 2800);
  }
  return { show: show, success: function(m){ show(m, 'success'); }, error: function(m){ show(m, 'error'); }, info: function(m){ show(m, 'info'); } };
})();

/* ---------- icons ---------- */
YC.icons = (function(){
  var S = {
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
    bookings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 15l2 2 4-4"/></svg>',
    customers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    content: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>',
    prompts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.39 5.39 0 0 1-4.4 2.26 5.4 5.4 0 0 1-5.4-5.4 5.39 5.39 0 0 1 2.26-4.4A9 9 0 0 0 12 3z"/></svg>',
    templates: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
    video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="5" width="15" height="14" rx="2"/><path d="M16 10l5-3v10l-5-3z"/></svg>',
    thumbnail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="13" rx="2"/><polyline points="8 21 8 17 16 17 16 21"/><polyline points="12 17 12 21"/><line x1="6" y1="11" x2="18" y2="11"/><circle cx="8.5" cy="8" r="0.5" fill="currentColor"/></svg>',
    files: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
    promotions: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 1 10 12 15 17 8"/><path d="M12 15v7"/><path d="M18 13.5V21a2 2 0 0 1-4 0v-1"/></svg>',
    categories: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    analytics: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    starOutline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    view: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    duplicate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
    chevronR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    message: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>'
  };
  return {
    get: function(name){ return S[name] || S.external; },
    html: function(name){ return '<span class="ic">' + S[name] || S.external + '</span>'; }
  };
})();

/* ---------- status pill ---------- */
YC.pill = function(status){
  var map = {
    pending: 'pending', confirmed: 'confirmed', cancelled: 'cancelled', completed: 'completed',
    active: 'active', inactive: 'inactive', scheduled: 'scheduled', expired: 'expired',
    published: 'published', draft: 'draft', public: 'published', private: 'private',
    enabled: 'active', disabled: 'disabled'
  };
  var cls = map[String(status).toLowerCase()] || 'neutral';
  return '<span class="pill ' + cls + '">' + YC.esc(status) + '</span>';
};

/* ---------- avatar ---------- */
YC.avatar = function(name){
  var initials = String(name || '?').split(/\s+/).slice(0, 2).map(function(w){
    return w.charAt(0).toUpperCase();
  }).join('');
  return initials;
};

/* ---------- modal ---------- */
YC.modal = (function(){
  var overlay;
  function ensure(){
    if(!overlay){
      overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = '';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', function(e){
        if(e.target === overlay) close();
      });
      document.addEventListener('keydown', function(e){
        if(e.key === 'Escape' && overlay.classList.contains('open')) close();
      });
    }
    return overlay;
  }
  function currentCard(){ return ensure().querySelector('.modal-card'); }
  var lastFocused = null;
  function focusableOf(root){
    return Array.prototype.slice.call((root || document).querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    )).filter(function(el){ return el.offsetParent !== null || el === document.activeElement; });
  }
  function trapFocus(e, ov){
    var f = focusableOf(ov);
    if(!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  }
  function open(opts){
    opts = opts || {};
    var ov = ensure();
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.innerHTML =
      '<div class="modal-card ' + (opts.size || '') + '">' +
        (opts.closable === false ? '' :
        '<div class="modal-head"><div>' +
          (opts.eyebrow ? '<div class="modal-eyebrow">' + YC.esc(opts.eyebrow) + '</div>' : '') +
          '<h3>' + (opts.title || '') + '</h3></div>' +
          '<button class="modal-close" aria-label="Close">&times;</button></div>') +
        '<div class="modal-body">' + (opts.body || '') + '</div>' +
        (opts.footer ? '<div class="modal-foot">' + opts.footer + '</div>' : '') +
      '</div>';
    ov.querySelector('.modal-close').addEventListener('click', close);
    ov.classList.add('open');
    document.body.style.overflow = 'hidden';
    ov.addEventListener('keydown', function(e){
      if(e.key === 'Tab') trapFocus(e, ov);
    });
    lastFocused = document.activeElement;
    var card = ov.querySelector('.modal-card');
    if(opts.onMount) opts.onMount(card);
    var f = focusableOf(ov);
    if(f.length) f[0].focus();
  }
  function close(){
    var ov = ensure();
    ov.classList.remove('open');
    document.body.style.overflow = '';
    ov.removeAttribute('role');
    ov.removeAttribute('aria-modal');
    ov.innerHTML = '';
    if(lastFocused && lastFocused.focus) lastFocused.focus();
    lastFocused = null;
  }
  function card(){
    return currentCard();
  }
  return { open: open, close: close, card: card };
})();

/* ---------- charts (SVG, dependency-free) ---------- */
YC.charts = (function(){
  function css(){
    var cs = getComputedStyle(document.documentElement);
    return {
      red: cs.getPropertyValue('--red').trim() || '#ff3344',
      gray: cs.getPropertyValue('--gray').trim() || '#98979d',
      line: cs.getPropertyValue('--line').trim() || 'rgba(255,255,255,.1)',
      white: cs.getPropertyValue('--white').trim() || '#f8f7f4'
    };
  }
  function niceMax(v){
    var n = Math.pow(10, Math.floor(Math.log10(v)));
    return Math.ceil(v / n) * n;
  }

  function areaChart(el, data, opts){
    opts = opts || {};
    var w = 640, h = 220, pad = { t: 14, r: 12, b: 30, l: 42 };
    var max = Math.max.apply(null, data.map(function(d){ return d.value; }));
    max = Math.max(max, 4);
    var innerW = w - pad.l - pad.r, innerH = h - pad.t - pad.b;
    var step = innerW / (data.length - 1 || 1);
    var pts = data.map(function(d, i){
      return { x: pad.l + i * step, y: pad.t + innerH - (d.value / max) * innerH, d: d };
    });
    var line = pts.map(function(p, i){ return (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1); }).join(' ');
    var area = line + ' L' + pts[pts.length - 1].x.toFixed(1) + ' ' + (pad.t + innerH) + ' L' + pts[0].x + ' ' + (pad.t + innerH) + ' Z';
    var gridLines = '';
    for(var g = 0; g <= 4; g++){
      var gy = pad.t + (innerH / 4) * g;
      var val = max - (max / 4) * g;
      gridLines += '<line class="svg-grid" x1="' + pad.l + '" y1="' + gy + '" x2="' + (w - pad.r) + '" y2="' + gy + '" stroke="' + css().line + '" stroke-width="1"/><text x="' + (pad.l - 8) + '" y="' + (gy + 3) + '" text-anchor="end" font-size="10" fill="' + css().gray + '">' + YC.abbrNum ? YC.abbrNum(val) : Math.round(val) + '</text>';
    }
    var color = opts.color || css().red;
    var html =
      '<svg class="svg-chart" viewBox="0 0 ' + w + ' ' + h + '" role="img">' +
        '<defs><linearGradient id="ycAreaGrad" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="' + color + '" stop-opacity=".35"/>' +
          '<stop offset="100%" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
        gridLines +
        '<path d="' + area + '" fill="url(#ycAreaGrad)"/>' +
        '<path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' +
        pts.map(function(p, i){
          var extra = (i === pts.length - 1) ? ' class="svg-pulse"' : '';
          return '<circle' + extra + ' cx="' + p.x + '" cy="' + p.y + '" r="3.2" fill="' + color + '" stroke="' + css().white + '" stroke-width="1.5"><title>' + p.d.label + ' — ' + p.d.value + '</title></circle>';
        }).join('') +
        pts.filter(function(p, i){ return i % Math.ceil(data.length / 6) === 0; }).map(function(p){
          return '<text x="' + p.x + '" y="' + (h - 10) + '" text-anchor="middle" font-size="10" fill="' + css().gray + '">' + p.d.label + '</text>';
        }).join('') +
      '</svg>';
    el.innerHTML = html;
  }

  function barChart(el, data, opts){
    opts = opts || {};
    var bars = data.length;
    var w = 640, h = 220, pad = { t: 14, r: 8, b: 30, l: 8 };
    var max = Math.max.apply(null, data.map(function(d){ return d.value; }));
    max = Math.max(max, 4);
    var innerW = w - pad.l - pad.r, innerH = h - pad.t - pad.b;
    var slot = innerW / bars;
    var bw = Math.min(44, slot * 0.55);
    var color = opts.color || css().red;
    var html =
      '<svg class="svg-chart" viewBox="0 0 ' + w + ' ' + h + '" role="img">' +
      data.map(function(d, i){
        var bh = Math.max(2, (d.value / max) * innerH);
        var x = pad.l + i * slot + (slot - bw) / 2;
        var y = pad.t + innerH - bh;
        return '<rect class="svg-bar" x="' + x + '" y="' + y + '" width="' + bw + '" height="' + bh + '" rx="5" fill="' + color + '" opacity=".92" style="transform-origin:' + (x + bw / 2) + 'px ' + (y + bh) + 'px"><title>' + d.label + ' — ' + d.value + '</title></rect>' +
               '<text x="' + (x + bw / 2) + '" y="' + (y - 6) + '" text-anchor="middle" font-size="10" fill="' + css().white + '" font-family="JetBrains Mono,monospace">' + d.value + '</text>' +
               '<text x="' + (x + bw / 2) + '" y="' + (h - 10) + '" text-anchor="middle" font-size="10" fill="' + css().gray + '">' + d.label + '</text>';
      }).join('') +
      '</svg>';
    el.innerHTML = html;
  }

  function hbar(el, items){
    var max = Math.max.apply(null, items.map(function(i){ return i.value; }));
    max = Math.max(max, 1);
    var html = items.map(function(i){
      var pct = Math.round((i.value / max) * 100);
      return '<div class="rank-row">' +
        '<span class="rk-num">' + (i.rank == null ? '' : i.rank) + '</span>' +
        '<div class="rk-main"><div class="t">' + YC.esc(i.label) + '</div><div class="bar"><i style="width:' + pct + '%"></i></div></div>' +
        '<span class="rk-val">' + i.value + '</span></div>';
    }).join('');
    el.innerHTML = html;
  }

  function donut(el, items, opts){
    opts = opts || {};
    var total = items.reduce(function(s, i){ return s + i.value; }, 0) || 1;
    var r = 44, c = 2 * Math.PI * r, cx = 100, cy = 100;
    var acc = 0;
    var palette = [css().red, css().red + '88', css().red + '55', css().gray, 'rgba(255,138,116,.7)'];
    var segs = items.map(function(item, i){
      var frac = item.value / total;
      var len = frac * c;
      var off = acc * c; acc += frac;
      return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + (palette[i % palette.length]) + '" stroke-width="16" stroke-dasharray="' + len.toFixed(2) + ' ' + c.toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"><title>' + item.label + ' — ' + item.value + ' (' + Math.round(frac * 100) + '%)</title></circle>';
    }).join('');
    el.innerHTML =
      '<svg class="svg-chart" viewBox="0 0 200 200" role="img">' + segs +
      '<text x="100" y="96" text-anchor="middle" font-size="24" font-weight="800" fill="' + css().white + '" font-family="JetBrains Mono,monospace">' + total + '</text>' +
      '<text x="100" y="114" text-anchor="middle" font-size="10" fill="' + css().gray + '">' + (opts.label || 'Total') + '</text></svg>' +
      '<div class="legend">' + items.map(function(item, i){
        return '<span class="lg"><i style="background:' + (palette[i % palette.length]) + '"></i>' + YC.esc(item.label) + '</span>';
      }).join('') + '</div>';
  }

  function spark(el, data, opts){
    opts = opts || {};
    var w = 120, h = 26, pad = 2;
    var max = Math.max.apply(null, data.map(function(d){ return d; })) || 1;
    var min = Math.min.apply(null, data.map(function(d){ return d; }));
    var range = (max - min) || 1;
    var innerW = w - pad * 2, innerH = h - pad * 2;
    var step = innerW / (data.length - 1 || 1);
    var pts = data.map(function(v, i){
      var x = pad + i * step;
      var y = pad + innerH - ((v - min) / range) * innerH;
      return x.toFixed(1) + ',' + y.toFixed(1);
    });
    var color = opts.color || css().red;
    el.innerHTML =
      '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '" preserveAspectRatio="none" role="img" aria-hidden="true">' +
      '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity=".9"/>' +
      '</svg>';
  }

  return { area: areaChart, bar: barChart, hbar: hbar, donut: donut, spark: spark };
})();
YC.abbrNum = function(n){
  if(n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if(n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
};

/* ---------- download helper (static demo) ---------- */
YC.downloadDemo = function(fileName, note){
  var content = [
    'YallahClick — demo file',
    '=========================',
    'File: ' + fileName,
    'Note: ' + (note || 'Static demo. Real file hosting connects later.'),
    'Name: ' + (YC.settings && YC.settings.get ? YC.settings.get('websiteName') : 'Yallah Click')
  ].join('\n');
  var blob = new Blob([content], { type: 'text/plain' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName + '.demo.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
};

/* ---------- copy helper ---------- */
YC.copyText = function(text){
  var done = function(){
    YC.toast.success('Copied to clipboard!');
  };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(done).catch(function(){
      legacyCopy(text); done();
    });
  }else{
    legacyCopy(text); done();
  }
};
function legacyCopy(text){
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

/* ---------- settings store ---------- */
YC.settings = (function(){
  var DEFAULT = {
    websiteName: 'Yallah Click',
    tagline: 'Premium Video Editing & Content Growth',
    contactEmail: 'yallahclick.contact@gmail.com',
    phone: '+212 600 000 000',
    logoDark: 'images/Yalah Click WH.png',
    logoLight: 'images/yallahclick.png',
    favicon: 'images/Mini logo.ico',
    defaultTheme: 'dark',
    enableThemeToggle: true,
    announcement: '',
    bookingEnabled: true,
    bookingMinPeople: 1,
    bookingMaxPeople: 10,
    bookingBufferHours: 1,
    confirmRequired: true,
    contentPromptsEnabled: true,
    contentTemplatesEnabled: true,
    downloadMethod: 'direct',
    itemsPerPage: 9,
    promoPopupsEnabled: true,
    promoDefaultDelay: 5,
    promoDefaultPosition: 'center',
    promoDefaultShowOnce: true,
    social: {
      youtube: 'https://www.youtube.com/@YallahClick',
      instagram: 'https://www.instagram.com/yallah.click/?hl=en',
      tiktok: 'https://www.tiktok.com/@yallah.click',
      behance: 'https://www.behance.net/yallahclick',
      linkedin: 'https://www.linkedin.com/in/yallah-click-34a897421/',
      facebook: 'https://facebook.com',
      pinterest: 'https://www.pinterest.com/yallahclick/_profile/',
      x: 'https://x.com/YallahClick',
      whatsapp: 'https://wa.me/message/I5ZSIR6EPNRON1'
    }
  };
  /* Prefer the backend's persisted settings when it's loaded & hydrated,
     otherwise fall back to localStorage, otherwise the bundled defaults. */
  function serverSettings(){
    try{
      if (window.YC && YC.backend){
        var s = YC.backend.getSettings();
        if (s && typeof s === 'object' && !Array.isArray(s)) return s;
      }
    }catch(e){}
    return null;
  }
  function localBase(){
    try{ return YC.Store.read('yc:settings') || null; }
    catch(e){ return null; }
  }
  function load(){
    var s = serverSettings() || localBase() || {};
    return Object.assign({}, DEFAULT, s, { social: Object.assign({}, DEFAULT.social, (s.social || {})) });
  }
  return {
    all: load,
    get: function(k){
      return load()[k];
    },
    save: function(patch){
      var current = load();
      var next = Object.assign({}, current, patch);
      next.id = current.id || 1;
      try{ YC.Store.write('yc:settings', next); }catch(e){}
      if (window.YC && YC.backend && YC.backend.saveSettings){
        YC.backend.saveSettings(next);
      }
      return next;
    }
  };
})();

/* ========== PUBLIC SITE CHROME (header + footer) ========== */
YC.buildChrome = function(opts){
  opts = opts || {};
  var socials = [
    { name: 'youtube', label: 'YouTube', href: 'https://www.youtube.com/@YallahClick', icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5.5" width="19" height="13" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 9l6 3-6 3z" fill="currentColor" stroke="none"/></svg>' },
    { name: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/yallah.click/?hl=en', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>' },
    { name: 'tiktok', label: 'TikTok', href: 'https://www.tiktok.com/@yallah.click', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>' },
    { name: 'behance', label: 'Behance', href: 'https://www.behance.net/yallahclick', icon: '<span class="social-letter behance-mark" aria-hidden="true">Bē</span>' },
    { name: 'linkedin', label: 'LinkedIn', href: 'https://www.linkedin.com/in/yallah-click-34a897421/', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>' },
    { name: 'facebook', label: 'Facebook', href: 'https://facebook.com', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>' },
    { name: 'pinterest', label: 'Pinterest', href: 'https://www.pinterest.com/yallahclick/_profile/', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.2 20.5c1.1-3.4 1.5-4.7 2.2-7.8-.5-1-.1-3 1.1-3 1 0 1.5.8 1.5 1.8 0 1.1-.7 2.8-1 4.3-.5 1.3.7 2.4 2 2.4 2.4 0 4.1-2.6 4.1-6.2 0-3.2-2.3-5.4-5.7-5.4-3.9 0-6.2 2.9-6.2 5.9 0 1.2.5 2.4 1 3 .1.1.1.3.1.5l-.4 1.7c-.1.5-.5.7-1 .4-2.1-1-3.4-4-3.4-6.4C2.5 6.5 6.4 2 13.4 2 19 2 23 6 23 11.3c0 5.6-3.5 10.1-8.4 10.1-1.6 0-3.2-.9-3.7-1.9l-1 3.8"/></svg>' },
    { name: 'x', label: 'X (Twitter)', href: 'https://x.com/YallahClick', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4l16 16M20 4L4 20"/></svg>' },
    { name: 'whatsapp', label: 'WhatsApp', href: 'https://wa.me/message/I5ZSIR6EPNRON1', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>' }
  ];
  var nav = [
    { label: 'Home', href: 'index.html', idx: '01' },
    { label: 'AI Prompts', href: 'ai-prompts.html', idx: '02' },
    { label: 'Templates', href: 'templates.html', idx: '03' },
    { label: 'Video Templates', href: 'video-templates.html', idx: '04' },
    { label: 'Thumbnails', href: 'thumbnail-templates.html', idx: '05' }
  ];
  if(opts.active) nav = nav.map(function(n){ n.active = n.href === opts.active; return n; });

  /* header (identical structure to the homepage's) */
  var header = document.createElement('header');
  header.className = 'site-header nav-visible';
  header.id = 'siteHeader';
  header.innerHTML =
    '<div class="nav-shell"><div class="nav-inner">' +
      '<a href="index.html" class="logo" aria-label="Yallah Click — Home">' +
        '<img class="logo-light" src="images/Yalah Click WH.png" alt="Yallah Click">' +
        '<img class="logo-dark" src="images/yallahclick.png" alt="Yallah Click">' +
        '<span class="logo-status"><i></i> Taking projects</span>' +
      '</a>' +
      '<div class="nav-links-wrap">' +
        '<nav class="desktop-nav" aria-label="Primary navigation"><ul>' +
          nav.map(function(n){ return '<li><a href="' + n.href + '"' + (n.active ? ' class="active-link"' : '') + '>' + n.label + '</a></li>'; }).join('') +
        '</ul></nav>' +
        '<a href="index.html#book" class="nav-cta">Book a Call</a>' +
        '<button class="theme-toggle" id="themeToggle" type="button" aria-label="Switch color theme" title="Switch color theme">' +
          '<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>' +
          '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>' +
        '</button>' +
        '<button class="burger" id="burgerBtn" type="button" aria-label="Open navigation menu" aria-expanded="false"><span></span><span></span><span></span></button>' +
      '</div>' +
    '</div><div class="nav-progress" id="navProgress" aria-hidden="true"></div></div>';

  var scrim = document.createElement('div');
  scrim.className = 'drawer-scrim';
  scrim.id = 'drawerScrim';

  var drawer = document.createElement('nav');
  drawer.className = 'mobile-drawer';
  drawer.id = 'mobileDrawer';
  drawer.setAttribute('aria-label', 'Mobile navigation');
  drawer.innerHTML =
    '<div class="mobile-drawer-head">Yallah Click / Menu</div>' +
    nav.map(function(n){ return '<a href="' + n.href + '" data-index="' + n.idx + '">' + n.label + '</a>'; }).join('') +
    '<a href="index.html#book" class="mobile-cta">Book a Call</a>' +
    '<button class="theme-toggle mobile-theme-toggle" type="button" aria-label="Switch color theme">' +
      '<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>' +
      '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>' +
      '<span data-theme-label></span>' +
    '</button>';

  /* footer */
  var footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML =
    '<div class="wrap">' +
      '<div class="footer-top">' +
        '<a href="index.html" class="logo"><span class="rec-dot"></span>' +
          '<img class="logo-light" src="images/Yalah Click WH.png" alt="Yallah Click">' +
          '<img class="logo-dark" src="images/yallahclick.png" alt="Yallah Click">' +
        '</a>' +
        '<nav class="footer-nav">' +
          '<a href="ai-prompts.html">AI Prompts</a><a href="templates.html">Templates</a>' +
          '<a href="video-templates.html">Video Templates</a><a href="thumbnail-templates.html">Thumbnails</a>' +
          '<a href="index.html#book">Book a Call</a>' +
        '</nav>' +
      '</div>' +
      '<div class="footer-bottom">' +
        '<span>&copy; 2026 Yallah Click. All rights reserved.</span>' +
        '<div class="footer-social">' +
          socials.map(function(s){ return '<a href="' + s.href + '" target="_blank" rel="noopener noreferrer" aria-label="' + s.label + '" title="' + s.label + '">' + s.icon + '</a>'; }).join('') +
        '</div>' +
        '<div class="legal"><a href="#">Privacy Policy</a><a href="#">Terms of Service</a><a href="admin/login.html" target="_blank">Admin</a></div>' +
      '</div>' +
    '</div>';

  document.body.appendChild(header);
  document.body.appendChild(footer);
  document.body.appendChild(scrim);
  document.body.appendChild(drawer);

  /* skip-to-content link */
  if(!document.querySelector('.skip-link')){
    var skip = document.createElement('a');
    skip.className = 'skip-link';
    skip.href = '#main';
    skip.textContent = 'Skip to main content';
    document.body.insertBefore(skip, document.body.firstChild);
  }

  /* scroll-to-top button */
  if(!document.querySelector('.scroll-top')){
    var topBtn = document.createElement('button');
    topBtn.className = 'scroll-top';
    topBtn.type = 'button';
    topBtn.setAttribute('aria-label', 'Back to top');
    topBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>';
    topBtn.style.display = 'none';
    document.body.appendChild(topBtn);
    topBtn.addEventListener('click', function(){ window.scrollTo({ top: 0, behavior: 'smooth' }); });
    function onScroll(){
      var show = window.scrollY > 600;
      topBtn.style.display = show ? 'inline-flex' : 'none';
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* init nav interactions */
  var burgerBtn = document.getElementById('burgerBtn');
  function toggle(open){
    burgerBtn.classList.toggle('open', open);
    drawer.classList.toggle('open', open);
    scrim.classList.toggle('open', open);
    burgerBtn.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  }
  burgerBtn.addEventListener('click', function(){ toggle(!drawer.classList.contains('open')); });
  scrim.addEventListener('click', function(){ toggle(false); });
  drawer.querySelectorAll('a').forEach(function(a){ a.addEventListener('click', function(){ toggle(false); }); });
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && drawer.classList.contains('open')) toggle(false);
  });

  YC.theme.init();

  /* header show/hide on scroll + reading progress (same as homepage) */
  var siteHeader = header;
  var navProgress = document.getElementById('navProgress');
  var lastScrollY = window.scrollY, tickingNav = false;
  function updateNavigation(){
    var currentY = Math.max(window.scrollY, 0);
    var maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if(navProgress) navProgress.style.width = (maxScroll > 0 ? Math.min((currentY / maxScroll) * 100, 100) : 0) + '%';
    siteHeader.classList.toggle('is-scrolled', currentY > 24);
    var goingDown = currentY > lastScrollY;
    var canHide = currentY > 180 && !drawer.classList.contains('open');
    siteHeader.classList.toggle('nav-hidden', canHide && goingDown && currentY - lastScrollY > 2);
    siteHeader.classList.toggle('nav-visible', !canHide || !goingDown);
    lastScrollY = currentY;
    tickingNav = false;
  }
  window.addEventListener('scroll', function(){
    if(!tickingNav){
      requestAnimationFrame(updateNavigation);
      tickingNav = true;
    }
  }, { passive: true });
  updateNavigation();
};

/* ========== REVEAL OBSERVER (public pages) ========== */
YC.initReveal = function(){
  var targets = document.querySelectorAll('.reveal, .reveal-stagger');
  if(!('IntersectionObserver' in window)){
    targets.forEach(function(t){ t.classList.add('in'); });
    return;
  }
  var obs = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(entry.isIntersecting){
        entry.target.classList.add('in');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  targets.forEach(function(t){ obs.observe(t); });
};