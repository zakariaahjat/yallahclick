/* ============================================================
   YallahClick — Public library pages (prompts / templates)
   Renders grids from YC.services, wires search + filters,
   favorites (localStorage) and the detail modal.
   ============================================================ */
window.YC = window.YC || {};
YC.lib = {};

YC.lib.favKey = function(type){
  return 'yc-favs-' + type;
};
YC.lib.getFavs = function(type){
  try{ return JSON.parse(localStorage.getItem(YC.lib.favKey(type))) || {}; }
  catch(e){ return {}; }
};
YC.lib.saveFavs = function(type, data){
  localStorage.setItem(YC.lib.favKey(type), JSON.stringify(data));
};
YC.lib.toggleFav = function(type, id){
  var f = YC.lib.getFavs(type);
  var k = String(id);
  if(f[k]) delete f[k]; else f[k] = true;
  YC.lib.saveFavs(type, f);
  return !!f[k];
};

YC.lib.platBadge = function(name){
  var cls = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return '<span class="plat-badge ' + cls + '"><span class="pdot"></span>' + YC.esc(name) + '</span>';
};
YC.lib.typeChip = function(type){
  var cls = String(type || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return '<span class="type-chip ' + cls + '">' + YC.esc(type) + '</span>';
};
YC.lib.hl = function(text, q){
  if(!text) return text;
  var qt = String(q == null ? '' : q).trim().toLowerCase();
  if(!qt) return text;
  var out = '', lower = text.toLowerCase(), i = 0, idx;
  while((idx = lower.indexOf(qt, i)) !== -1){
    if(idx > i) out += text.slice(i, idx);
    out += '<span class="hl">' + text.slice(idx, idx + qt.length) + '</span>';
    i = idx + qt.length;
  }
  out += text.slice(i);
  return out;
};

YC.lib.render = function(opts){
  var type = opts.type;            // 'prompts' | 'templates' | 'video' | 'thumb'
  var svc = opts.svc;              // YC.services.prompts | templates | videoTemplates | thumbnailTemplates
  var isPrompt = type === 'prompts';
  var host = document.getElementById('libGrid');
  var featuredHost = document.getElementById('libFeatured');

  var state = { q: '', sort: 'popular', category: 'all', platform: 'all' };

  /* ---- filters list ---- */
  var categoryList = [];
  (function(){
    var seen = {};
    svc.all().forEach(function(x){ if(x.category && !seen[x.category]){ seen[x.category] = 1; categoryList.push(x.category); } });
    categoryList.sort();
  })();
  var platformList = [];
  (function(){
    var seen = {};
    svc.all().forEach(function(x){ if(x.platform && !seen[x.platform]){ seen[x.platform] = 1; platformList.push(x.platform); } });
    platformList.sort();
  })();

  function fillSelect(sel, list, placeholder){
    if(!sel) return;
    sel.innerHTML = '<option value="all">' + placeholder + '</option>' +
      list.map(function(v){ return '<option value="' + YC.esc(v) + '">' + YC.esc(v) + '</option>'; }).join('');
  }

  function applyFilter(list){
    var out = list.slice();
    if(state.category !== 'all') out = out.filter(function(x){ return x.category === state.category; });
    if(state.platform !== 'all') out = out.filter(function(x){ return x.platform === state.platform; });
    return out;
  }
  function applySearch(list){
    var q = state.q.trim().toLowerCase();
    if(!q) return list;
    return list.filter(function(x){
      return x.title.toLowerCase().indexOf(q) >= 0 ||
             x.description.toLowerCase().indexOf(q) >= 0 ||
             x.tags.some(function(t){ return t.toLowerCase().indexOf(q) >= 0; });
    });
  }
  function sortList(list){
    var arr = list.slice();
    if(state.sort === 'favorites'){
      arr.sort(function(a, b){ return (b.favorites || 0) - (a.favorites || 0); });
    }else if(state.sort === 'newest'){
      arr.sort(function(a, b){ return String(b.createdAt).localeCompare(String(a.createdAt)); });
    }else if(state.sort === 'title'){
      arr.sort(function(a, b){ return a.title.localeCompare(b.title); });
    }else{
      arr.sort(function(a, b){ return (b.views || b.downloads || 0) - (a.views || a.downloads || 0); });
    }
    return arr;
  }

  function prevMarkup(x){
    if(x.preview){
      return '<img loading="lazy" decoding="async" src="' + YC.esc(x.preview) + '" alt="' + YC.esc(x.title) + '">';
    }
    return '<span class="p-emoji" style="font-size:44px">' + (x.previewEmoji || '✨') + '</span>';
  }

  function card(x, idx){
    if(isPrompt){
      return '<article class="card prompt-card" data-id="' + x.id + '" style="cursor:pointer">' +
        '<div class="p-preview" style="background:' + YC.esc(x.previewColor || '#101216') + '">' +
          (x.platform ? '<span class="p-platform">' + (x.platform === 'Midjourney' ? 'MJ' : x.platform === 'DALL-E' ? 'DALL·E' : x.platform) + '</span>' : '') +
          (x.featured ? '<span class="p-featured-badge">★</span>' : '') +
          prevMarkup(x) +
        '</div>' +
        '<div class="p-body">' +
          '<div class="p-meta">' +
            (x.category ? '<span class="plat-badge other" style="color:var(--gray)"><span class="pdot"></span>' + YC.esc(x.category) + '</span>' : '') +
          '</div>' +
          '<h3 class="p-title">' + YC.lib.hl(YC.esc(x.title), state.q) + '</h3>' +
          '<p class="p-desc">' + YC.lib.hl(YC.esc(x.description), state.q) + '</p>' +
          '<div class="p-tags">' + x.tags.slice(0, 3).map(function(t){ return '<span class="plat-badge" style="color:var(--gray)"><span class="pdot"></span>#' + YC.esc(t) + '</span>'; }).join('') + '</div>' +
          '<div class="p-foot">' +
            '<span class="p-views"><b>' + YC.esc(YC.abbrNum(x.views || 0)) + '</b> views</span>' +
            '<button type="button" class="p-fav' + (YC.lib.getFavs(type)[String(x.id)] ? ' faved' : '') + '" data-fav="' + x.id + '" aria-label="Favorite"><span class="ic">' + YC.icons.get('star') + '</span></button>' +
          '</div>' +
        '</div>' +
      '</article>';
    }
    /* template / video / thumb */
    var typeTag = x.type && x.type.toLowerCase() !== 'zip' ? x.type.toUpperCase() : (x.duration ? x.duration : 'Pack');
    return '<article class="card tpl-card" data-id="' + x.id + '" style="cursor:pointer">' +
      '<div class="t-preview" style="background:' + YC.esc(x.previewColor || '#101216') + '">' +
        (x.preview ? prevMarkup(x) : '<span class="p-emoji" style="font-size:44px;position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:1">' + (x.previewEmoji || '📦') + '</span>') +
        (x.type ? '<span class="t-type">' + (x.type === 'After Effects' ? 'AE' : x.type === 'Premiere Pro' ? 'PR' : x.type === 'PowerPoint' ? 'PPT' : x.type) + '</span>' : '') +
        (x.duration ? '<span class="t-dur">' + YC.esc(x.duration) + '</span>' : '') +
        '<span class="t-play"><span>▶</span></span>' +
      '</div>' +
      '<div class="t-body">' +
        '<h3 class="t-title">' + YC.lib.hl(YC.esc(x.title), state.q) + '</h3>' +
        '<p class="t-desc">' + YC.lib.hl(YC.esc(x.description), state.q) + '</p>' +
        '<div class="t-software">' + YC.esc(x.software || '') + (x.dimensions ? ' &middot; ' + YC.esc(x.dimensions) : '') + (x.resolution ? ' &middot; ' + YC.esc(x.resolution) : '') + '</div>' +
        '<div class="t-meta">' +
          (x.platform ? '<span class="plat-badge" style="color:var(--gray)"><span class="pdot"></span>' + YC.esc(x.platform) + '</span>' : '') +
          (x.category ? '<span class="plat-badge other" style="color:var(--gray)"><span class="pdot"></span>' + YC.esc(x.category) + '</span>' : '') +
        '</div>' +
        '<div class="t-foot">' +
          (isPrompt ? '' : '<button type="button" class="btn btn-primary" data-dl="' + x.id + '">Download</button>') +
          '<button type="button" class="btn btn-ghost" data-view="' + x.id + '">Details</button>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  var firstRender = true;

  function skeletonHTML(count){
    var s = '';
    for(var i = 0; i < count; i++){
      s += '<div class="sk-card">' +
        '<div class="skeleton sk-preview"></div>' +
        '<div class="sk-body">' +
          '<div class="skeleton sk-line" style="width:55%"></div>' +
          '<div class="skeleton sk-line" style="width:100%"></div>' +
          '<div class="skeleton sk-line" style="width:82%"></div>' +
          '<div class="skeleton sk-line" style="width:40%"></div>' +
        '</div>' +
      '</div>';
    }
    return s;
  }

  function applyStagger(host){
    if(!host) return;
    var cards = host.querySelectorAll('.prompt-card, .tpl-card');
    if(!cards.length) return;
    host.classList.remove('in');
    host.classList.add('reveal-stagger');
    cards.forEach(function(c, i){
      c.style.transitionDelay = Math.min(0.05 + i * 0.06, 0.3) + 's';
    });
    void host.offsetHeight; /* commit hidden state, then play entrance */
    host.classList.add('in');
  }

  function renderCards(all, featured){
    var empty = '<div class="empty-state" style="padding:48px"><span class="empty-ico">' + YC.icons.get('search') + '</span><strong>No ' + (isPrompt ? 'prompts' : 'templates') + ' found.</strong></div>';

    if(featuredHost){
      featuredHost.classList.toggle('lib-grid', !!featured.length);
      featuredHost.style.display = featured.length ? '' : 'none';
      featuredHost.innerHTML = featured.length ? featured.map(card).join('') : '';
    }
    if(host){
      var rest = all.filter(function(x){ return featured.indexOf(x) === -1; });
      host.innerHTML = rest.length ? rest.map(card).join('') : (all.length ? empty : empty);
      if(!all.length && featuredHost) featuredHost.style.display = 'none';
    }

    applyStagger(featuredHost);
    applyStagger(host);

    /* per-card wiring */
    var clickables = document.querySelectorAll('[data-view]');
    clickables.forEach(function(b){
      b.addEventListener('click', function(e){
        e.stopPropagation();
        detail(svc.getById(b.getAttribute('data-view')));
      });
    });
    var dls = document.querySelectorAll('[data-dl]');
    dls.forEach(function(b){
      b.addEventListener('click', function(e){
        e.stopPropagation();
        var x = svc.getById(b.getAttribute('data-dl'));
        svc.incrementDownloads(x.id);
        YC.downloadDemo(x.file || x.title);
        YC.toast.success('Demo file download started.');
      });
    });
    var favs = document.querySelectorAll('[data-fav]');
    favs.forEach(function(b){
      b.addEventListener('click', function(e){
        e.stopPropagation();
        var id = b.getAttribute('data-fav');
        var nowFav = YC.lib.toggleFav(type, id);
        b.classList.toggle('faved', nowFav);
        updateTray();
        YC.toast.info(nowFav ? 'Added to favorites.' : 'Removed from favorites.');
      });
    });
    var cards = document.querySelectorAll('.prompt-card, .tpl-card');
    cards.forEach(function(c){
      c.addEventListener('click', function(){
        var x = svc.getById(c.getAttribute('data-id'));
        if(x) detail(x);
      });
    });
  }

  function render(){
    var all = sortList(applySearch(applyFilter(svc.all().filter(function(x){ return x.published; }))));
    var featured = all.filter(function(x){ return x.featured; }).slice(0, 2);
    var rest = all.filter(function(x){ return featured.indexOf(x) === -1; });

    /* skeleton flash */
    if(featuredHost){
      featuredHost.classList.toggle('lib-grid', !!featured.length);
      featuredHost.style.display = featured.length ? '' : 'none';
      featuredHost.innerHTML = featured.length ? skeletonHTML(featured.length) : '';
    }
    if(host){
      host.innerHTML = rest.length ? skeletonHTML(rest.length) : '';
      if(!all.length && featuredHost) featuredHost.style.display = 'none';
    }

    setTimeout(function(){
      renderCards(all, featured);
    }, firstRender ? 300 : 150);
    firstRender = false;
  }

  function detail(x){
    if(!x) return;
    svc.incrementViews(x.id);
    var meta = [];
    if(x.platform) meta.push('<div class="meta-item"><div class="k">Platform</div><div class="v">' + YC.esc(x.platform) + '</div></div>');
    if(x.category) meta.push('<div class="meta-item"><div class="k">Category</div><div class="v">' + YC.esc(x.category) + '</div></div>');
    if(x.type) meta.push('<div class="meta-item"><div class="k">Format</div><div class="v">' + YC.esc(x.type) + '</div></div>');
    if(x.software) meta.push('<div class="meta-item"><div class="k">Software</div><div class="v">' + YC.esc(x.software) + '</div></div>');
    if(x.duration) meta.push('<div class="meta-item"><div class="k">Duration</div><div class="v">' + YC.esc(x.duration) + '</div></div>');
    if(x.dimensions) meta.push('<div class="meta-item"><div class="k">Dimensions</div><div class="v">' + YC.esc(x.dimensions) + '</div></div>');
    if(x.resolution) meta.push('<div class="meta-item"><div class="k">Resolution</div><div class="v">' + YC.esc(x.resolution) + '</div></div>');
    if(x.fileSize) meta.push('<div class="meta-item"><div class="k">Size</div><div class="v">' + YC.esc(x.fileSize) + '</div></div>');
    if(x.downloads != null) meta.push('<div class="meta-item"><div class="k">Downloads</div><div class="v">' + YC.esc(x.downloads) + '</div></div>');
    if(x.views != null) meta.push('<div class="meta-item"><div class="k">Views</div><div class="v">' + YC.esc(YC.abbrNum(x.views)) + '</div></div>');
    if(x.favorites != null) meta.push('<div class="meta-item"><div class="k">Favorites</div><div class="v">' + YC.esc(x.favorites) + '</div></div>');

    var hero;
    if(x.preview){
      hero = '<img src="' + YC.esc(x.preview) + '" alt="' + YC.esc(x.title) + '">';
    }else{
      hero = '<span class="d-emoji">' + (x.previewEmoji || '✨') + '</span>';
    }
    var gallery = (x.gallery && x.gallery.length) ? '<div class="gallery-strip">' + x.gallery.map(function(g){
      return '<img loading="lazy" decoding="async" src="' + YC.esc(g) + '" alt="" data-gtab>';
    }).join('') + '</div>' : '';

    var body =
      '<div class="detail-hero" style="background:' + YC.esc(x.previewColor || '#101216') + '">' + hero +
        (x.platform ? '<span class="d-platform">' + YC.esc(x.platform) + '</span>' : '') +
        (x.featured ? '<span class="d-feat">★</span>' : '') +
      '</div>' +
      '<div class="detail-kicker">' + (x.category ? '<b>' + YC.esc(x.category) + '</b> · ' : '') + (x.platform ? YC.esc(x.platform) + ' · ' : '') + 'YallahClick Library</div>' +
      '<h2 class="detail-title">' + YC.esc(x.title) + '</h2>' +
      '<p class="detail-desc">' + YC.esc(x.description) + '</p>' +
      '<div class="meta-list">' + meta.join('') + '</div>' +
      gallery +
      (isPrompt ? '<div class="detail-section-title">The prompt</div>' +
        '<div class="prompt-full" id="promptFull">' + YC.esc(x.prompt).replace(/\n/g, '\n') + '</div>' +
        '<div class="detail-section-title">Tags</div><div class="detail-tags">' + x.tags.map(function(t){ return '<span class="plat-badge" style="color:var(--gray)"><span class="pdot"></span>#' + YC.esc(t) + '</span>'; }).join('') + '</div>'
        : '');

    YC.modal.open({
      title: x.title,
      eyebrow: isPrompt ? 'AI Prompt' : 'Template',
      size: 'lg',
      body: body,
      footer: (isPrompt
        ? '<button type="button" class="btn btn-primary" data-copy-prompt>Copy prompt</button>'
        : '<button type="button" class="btn btn-primary" data-dl-detail>Download</button>') +
        '<button type="button" class="btn btn-ghost" data-close-modal>Close</button>',
      onMount: function(card){
        var cp = card.querySelector('[data-copy-prompt]');
        if(cp){
          cp.addEventListener('click', function(){
            YC.copyText(x.prompt);
            var box = card.querySelector('#promptFull');
            if(box){ box.classList.add('grabbed'); setTimeout(function(){ box.classList.remove('grabbed'); }, 900); }
          });
        }
        var dl = card.querySelector('[data-dl-detail]');
        if(dl){
          dl.addEventListener('click', function(){
            svc.incrementDownloads(x.id);
            YC.downloadDemo(x.file || x.title);
            YC.toast.success('Demo file download started.');
          });
        }
        var main = card.querySelector('.detail-hero img');
        card.querySelectorAll('[data-gtab]').forEach(function(img){
          img.addEventListener('click', function(){
            if(main) main.src = img.src;
            card.querySelectorAll('[data-gtab]').forEach(function(g){ g.classList.toggle('active', g === img); });
          });
        });
        card.querySelector('[data-close-modal]').addEventListener('click', function(){ YC.modal.close(); });
      }
    });
  }

  function updateTray(){
    var tray = document.getElementById('favTray');
    if(!tray) return;
    var count = Object.keys(YC.lib.getFavs(type)).length;
    if(count){
      tray.innerHTML = '<span class="fav-chip"><span class="ic">' + YC.icons.get('star') + '</span><b>' + count + '</b> in favorites &middot; <button type="button" class="btn-link" data-clear-favs>Clear</button></span>';
      var clear = tray.querySelector('[data-clear-favs]');
      if(clear) clear.addEventListener('click', function(){
        YC.lib.saveFavs(type, {});
        updateTray();
        render();
        YC.toast.info('Favorites cleared.');
      });
    }else{
      tray.innerHTML = '';
    }
  }

  /* wire UI */
  var search = document.getElementById('libSearch');
  if(search) search.addEventListener('input', YC.debounce(function(){ state.q = this.value; render(); }, 250));

  var seg = document.getElementById('libSort');
  if(seg){
    seg.querySelectorAll('button').forEach(function(b){
      b.addEventListener('click', function(){
        seg.querySelectorAll('button').forEach(function(x){ x.classList.remove('active'); });
        b.classList.add('active');
        state.sort = b.getAttribute('data-sort');
        render();
      });
    });
  }

  var catSel = document.getElementById('libCategory');
  if(catSel){ fillSelect(catSel, categoryList, 'All categories'); catSel.addEventListener('change', function(){ state.category = this.value; render(); }); }
  var platSel = document.getElementById('libPlatform');
  if(platSel){
    fillSelect(platSel, platformList, 'All platforms');
    platSel.addEventListener('change', function(){ state.platform = this.value; render(); });
  }

  /* hero count */
  var heroCount = document.getElementById('heroCount');
  if(heroCount){
    var totalNumber = svc.all().filter(function(x){ return x.published; }).length;
    heroCount.innerHTML = '<b>' + totalNumber + '</b> curated ' + (isPrompt ? 'prompts' : '+ ' + 'templates') + ' ready to use';
  }

  render();
  updateTray();
};

/* ---------- auto-boot per page ---------- */
document.addEventListener('DOMContentLoaded', function(){
  var lib = document.body && document.body.getAttribute('data-library');
  if(!lib) return;
  var map = {
    prompts: { type: 'prompts', svc: YC.services.prompts },
    templates: { type: 'templates', svc: YC.services.templates },
    video: { type: 'video', svc: YC.services.videoTemplates },
    thumb: { type: 'thumb', svc: YC.services.thumbnailTemplates },
    psd: { type: 'psd', svc: YC.services.psdTemplates }
  };
  var cfg = map[lib];
  if(cfg && cfg.svc){
    /* wait for API hydration so the library shows server data when a
       backend is present; otherwise fall back to the static demo data */
    var ready = (YC.backend && YC.backend.hydrate) ? YC.backend.hydrate() : Promise.resolve(true);
    Promise.resolve(ready).then(function(){ YC.lib.render({ type: cfg.type, svc: cfg.svc }); })
      .catch(function(){ YC.lib.render({ type: cfg.type, svc: cfg.svc }); });
  }
});