/* ============================================================
   YallahClick — Admin application controllers
   One controller per <body data-page="…"> value.
   ============================================================ */
window.YC = window.YC || {};
YC.app = {};

/* ---------- categories service (built lazily so the login page
   never needs the data/storage layer) ---------- */
YC.app.catsService = function(){
  if(YC.services && YC.services.categories) return YC.services.categories;
  var svc = YC.createService('yc:categories', function(){
    return JSON.parse(JSON.stringify(YC.data.categories));
  });
  svc.seed();
  return svc;
};

/* ---------- tiny helpers ---------- */
YC.app.$ = function(s){ return document.querySelector(s); };
YC.app.$$ = function(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); };
YC.app.esc = function(v){ return YC.esc(v); };
YC.app.iso = function(d){
  var pad = function(n){ return (n < 10 ? '0' : '') + n; };
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
};
YC.app.svcName = function(id){ return (!id || id === 'all') ? 'All services' : YC.data.getServiceName(id); };

YC.app.statCard = function(icon, num, label, delta, deltaDir, unit){
  return '<div class="stat-card"><div class="stat-ico">' + YC.icons.get(icon) + '</div>' +
    '<div class="stat-num">' + num + (unit ? '<span class="unit">' + unit + '</span>' : '') + '</div>' +
    '<div class="stat-label">' + YC.esc(label) + '</div>' +
    (delta ? '<div class="stat-delta ' + (deltaDir || 'up') + '">' + YC.esc(delta) + '</div>' : '') + '</div>';
};
YC.app.renderStats = function(cards, cols){
  var el = YC.app.$('#statGrid');
  if(!el) return;
  el.className = 'stat-grid' + (cols ? ' cols-' + cols : '');
  el.innerHTML = cards.map(function(c){
    return YC.app.statCard(c.icon, c.num, c.label, c.delta, c.dir, c.unit);
  }).join('');
};
YC.app.actBtn = function(act, iconName, title){
  return '<button type="button" class="btn-icon" data-act="' + act + '" title="' + title + '"><span class="ic">' + YC.icons.get(iconName) + '</span></button>';
};
YC.app.typeChip = function(type){
  var cls = String(type || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return '<span class="type-chip ' + cls + '">' + YC.esc(type) + '</span>';
};
YC.app.previewThumb = function(r){
  var style = 'width:52px;height:38px;border-radius:8px;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;';
  if(r.preview){
    return '<span style="' + style + ';background:var(--glass);border:1px solid var(--line)"><img src="' + YC.esc(r.preview) + '" style="width:100%;height:100%;object-fit:cover" alt=""></span>';
  }
  return '<span style="' + style + ';background:' + (r.previewColor || '#101216') + ';font-size:18px">' + (r.previewEmoji || '🗂️') + '</span>';
};

/* ---------- field builders ---------- */
YC.app.fld = {
  text: function(o){
    return '<div class="field"><label>' + YC.esc(o.label || '') + (o.required ? ' <span class="req">*</span>' : '') + '</label>' +
      '<input type="' + (o.type || 'text') + '" name="' + o.name + '" value="' + YC.esc(o.value || '') + '"' +
      (o.placeholder ? ' placeholder="' + YC.esc(o.placeholder) + '"' : '') +
      (o.required ? ' required' : '') + (o.step ? ' step="' + o.step + '"' : '') + (o.min != null ? ' min="' + o.min + '"' : '') +
      (o.max != null ? ' max="' + o.max + '"' : '') + '>' +
      '<div class="field-error">' + YC.esc(o.errorMsg || 'This field is required.') + '</div></div>';
  },
  area: function(o){
    return '<div class="field"><label>' + YC.esc(o.label || '') + (o.required ? ' <span class="req">*</span>' : '') + '</label>' +
      '<textarea name="' + o.name + '" rows="' + (o.rows || 4) + '"' +
      (o.placeholder ? ' placeholder="' + YC.esc(o.placeholder) + '"' : '') + '>' + YC.esc(o.value || '') + '</textarea>' +
      '<div class="field-error">' + YC.esc(o.errorMsg || 'This field is required.') + '</div></div>';
  },
  select: function(o){
    var opts = (o.options || []).map(function(op){
      var val = typeof op === 'object' && op != null ? op.value : op;
      var lbl = typeof op === 'object' && op != null ? op.label : op;
      var sel = String(o.value) === String(val) ? ' selected' : '';
      return '<option value="' + YC.esc(val) + '"' + sel + '>' + YC.esc(lbl) + '</option>';
    }).join('');
    return '<div class="field"><label>' + YC.esc(o.label || '') + (o.required ? ' <span class="req">*</span>' : '') + '</label>' +
      '<select name="' + o.name + '"' + (o.required ? ' required' : '') + '>' + opts + '</select>' +
      '<div class="field-error">' + YC.esc(o.errorMsg || 'Please choose an option.') + '</div></div>';
  },
  sw: function(o){
    return '<div class="field"><label class="switch"><input type="checkbox" name="' + o.name + '"' +
      (o.value ? ' checked' : '') + '><span class="track"></span><span class="switch-label">' + YC.esc(o.label || '') + '</span></label></div>';
  }
};

YC.app.parseForm = function(form){
  var out = {};
  for(var i = 0; i < form.elements.length; i++){
    var el = form.elements[i];
    if(!el.name) continue;
    if(el.type === 'checkbox'){
      out[el.name] = el.checked;
    }else if(el.type === 'number'){
      out[el.name] = el.value === '' ? null : Number(el.value);
    }else{
      out[el.name] = el.value;
    }
  }
  return out;
};
YC.app.markErrors = function(form, fields){
  YC.app.$$('input,textarea,select', form).forEach(function(el){
    var f = el.closest('.field');
    if(f) f.classList.toggle('error', fields.indexOf(el.name) >= 0);
  });
};
YC.app.required = function(data, fields){
  var missing = [];
  fields.forEach(function(f){
    var v = data[f];
    if(v == null || String(v).trim() === '') missing.push(f);
  });
  return missing;
};

YC.app.openForm = function(opts){
  var html = opts.fields.map(function(f){ return YC.app.fld[f.t](f); }).join('');
  YC.modal.open({
    title: opts.title,
    eyebrow: opts.eyebrow,
    size: opts.size || 'lg',
    body: '<form id="ycModalForm" autocomplete="off" novalidate>' + html + '</form>',
    footer: '<button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>' +
      '<button type="submit" class="btn btn-primary" data-submit-form>Save changes</button>',
    onMount: function(card){
      var form = card.querySelector('#ycModalForm');
      card.querySelector('[data-close-modal]').addEventListener('click', function(){ YC.modal.close(); });
      var submit = card.querySelector('[data-submit-form]');
      submit.addEventListener('click', function(){
        form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit'));
      });
      form.addEventListener('submit', function(e){
        e.preventDefault();
        var data = YC.app.parseForm(form);
        if(opts.onSubmit) opts.onSubmit(data, form);
      });
    }
  });
};
YC.app.confirm = function(msg, onYes, label){
  YC.modal.open({
    title: 'Please confirm',
    size: 'sm',
    body: '<p style="color:var(--gray);line-height:1.6">' + YC.esc(msg) + '</p>',
    footer: '<button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>' +
      '<button type="button" class="btn btn-danger" id="ycConfirmYes">' + YC.esc(label || 'Delete') + '</button>',
    onMount: function(card){
      card.querySelector('#ycConfirmYes').addEventListener('click', function(){ YC.modal.close(); onYes(); });
      card.querySelector('[data-close-modal]').addEventListener('click', function(){ YC.modal.close(); });
    }
  });
};
YC.app.nav = function(file){
  location.href = file;
};

/* ============================================================
   Generic admin table
   ============================================================ */
YC.app.Table = function(cfg){
  var host = typeof cfg.host === 'string' ? document.querySelector(cfg.host) : cfg.host;
  var state = {
    q: '',
    page: 1,
    per: cfg.per || 8,
    sortKey: cfg.sortKey || null,
    sortDir: cfg.sortDir != null ? cfg.sortDir : -1,
    extra: Object.assign({}, cfg.defaults || {})
  };
  var rows = [];

  function base(){ return (cfg.data ? cfg.data(state) || [] : []).slice(); }
  function search(list){
    var q = state.q.trim().toLowerCase();
    if(!q) return list;
    var keys = cfg.keys || [];
    if(!keys.length) return list;
    return list.filter(function(r){
      return keys.some(function(k){
        var v = r[k];
        if(v == null) return false;
        return String(v).toLowerCase().indexOf(q) >= 0;
      });
    });
  }
  function sort(list){
    if(!state.sortKey) return list;
    var k = state.sortKey, dir = state.sortDir;
    return list.slice().sort(function(a, b){
      var av = a[k], bv = b[k];
      if(av == null && bv == null) return 0;
      if(av == null) return 1;
      if(bv == null) return -1;
      if(typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }
  function pagerHtml(total, pages){
    var h = '<div class="pagination">';
    h += '<button type="button" data-pg="prev"' + (state.page <= 1 ? ' disabled' : '') + '>Prev</button>';
    var start = Math.max(1, state.page - 2);
    var end = Math.min(pages, start + 4);
    start = Math.max(1, end - 4);
    for(var i = start; i <= end; i++){
      h += '<button type="button" data-pg="' + i + '" class="' + (i === state.page ? 'active' : '') + '">' + i + '</button>';
    }
    h += '<button type="button" data-pg="next"' + (state.page >= pages ? ' disabled' : '') + '>Next</button></div>';
    return h;
  }

  function render(){
    var all = sort(search(base()));
    var pages = Math.max(1, Math.ceil(all.length / state.per));
    if(state.page > pages) state.page = pages;
    if(state.page < 1) state.page = 1;
    rows = all.slice((state.page - 1) * state.per, state.page * state.per);

    var thead = cfg.columns.map(function(c){
      var arrow = '';
      if(c.sort){
        arrow = '<span class="sort-arrow">' + (state.sortKey === c.key && state.sortDir < 0 ? '&#9660;' : '&#9650;') + '</span>';
      }
      return '<th' + (c.sort ? ' class="sortable' + (state.sortKey === c.key ? ' sorted' : '') + '" data-sort="' + c.key + '"' : '') + '>' +
        (c.title || '') + arrow + '</th>';
    }).join('');

    var body;
    if(rows.length){
      body = rows.map(function(r){
        var tr = cfg.onClickRow ? ' data-row-click="1"' : '';
        tr += ' data-id="' + r.id + '"';
        return '<tr' + tr + '>' + cfg.columns.map(function(c){
          var cell = c.render ? c.render(r, state.extra) : YC.esc(r[c.key]);
          return '<td' + (c.className ? ' class="' + c.className + '"' : '') + '>' + (cell == null ? '' : cell) + '</td>';
        }).join('') + '</tr>';
      }).join('');
    }else{
      body = '<tr><td colspan="' + cfg.columns.length + '"><div class="empty-state" style="padding:40px 20px">' +
        '<span class="empty-ico">' + YC.icons.get(cfg.emptyIcon || 'layers') + '</span>' +
        '<strong>' + (cfg.empty || 'No records found.') + '</strong></div></td></tr>';
    }

    host.innerHTML = '<div class="table-scroll"><table class="tbl"><thead><tr>' + thead + '</tr></thead><tbody>' + body +
      '</tbody></table></div>' + (rows.length ? pagerHtml(all.length, pages) : '');

    var ths = host.querySelectorAll('th.sortable');
    ths.forEach(function(th){
      th.addEventListener('click', function(){
        var k = th.getAttribute('data-sort');
        if(state.sortKey === k){ state.sortDir = -state.sortDir; }
        else { state.sortKey = k; state.sortDir = -1; }
        state.page = 1;
        render();
      });
    });
    var clicks = host.querySelectorAll('.pagination button');
    clicks.forEach(function(b){
      b.addEventListener('click', function(){
        var v = b.getAttribute('data-pg');
        if(v === 'prev'){ if(state.page > 1){ state.page--; render(); } }
        else if(v === 'next'){ if(state.page < pages){ state.page++; render(); } }
        else { state.page = parseInt(v, 10); render(); }
      });
    });
    host.querySelectorAll('tbody tr[data-id]').forEach(function(tr){
      tr.addEventListener('click', function(e){
        var btn = e.target.closest('[data-act]');
        var id = tr.getAttribute('data-id');
        var row = rows.find(function(r){ return String(r.id) === String(id); });
        if(btn){
          e.preventDefault(); e.stopPropagation();
          if(cfg.onAction) cfg.onAction(btn.getAttribute('data-act'), id, row, tr);
          return;
        }
        if(cfg.onClickRow && tr.hasAttribute('data-row-click')) cfg.onClickRow(id, row, tr);
      });
    });
    if(cfg.onSwitch){
      host.querySelectorAll('tbody input[data-switch]').forEach(function(inp){
        inp.addEventListener('change', function(){
          var id = inp.getAttribute('data-switch');
          var row = rows.find(function(r){ return String(r.id) === String(id); });
          if(cfg.onSwitch) cfg.onSwitch(inp.getAttribute('data-on') || 'toggle', id, row, inp.checked, inp);
        });
      });
    }
  }

  return {
    refresh: render,
    setQ: function(q){ state.q = q; state.page = 1; render(); },
    setExtra: function(k, v){
      if(v == null || v === ''){ delete state.extra[k]; }
      else { state.extra[k] = v; }
      state.page = 1; render();
    },
    getExtra: function(){ return state.extra; },
    getRows: function(){ return rows; }
  };
};

YC.app.attachSearch = function(sel, onQ){
  var inp = YC.app.$(sel);
  if(!inp) return;
  inp.addEventListener('input', YC.debounce(function(){ onQ(this.value); }, 250));
};
YC.app.attachSelect = function(sel, onVal){
  var el = YC.app.$(sel);
  if(!el) return;
  el.addEventListener('change', function(){ onVal(this.value); });
};

/* ============================================================
   LOGIN
   ============================================================ */
YC.app.pages_login = function(){
  var next = new URLSearchParams(location.search).get('next') || 'index.html';
  if(YC.auth.isLoggedIn()){
    location.replace(next);
    return;
  }
  var form = YC.app.$('#loginForm');
  var formBox = YC.app.$('#loginCard');
  var errorBox = YC.app.$('#loginError');
  var submit = YC.app.$('#loginSubmit');

  var pw = YC.app.$('#loginPassword');
  var toggle = YC.app.$('#pwToggle');
  if(toggle){
    toggle.addEventListener('click', function(){
      pw.type = pw.type === 'password' ? 'text' : 'password';
    });
  }

  form.addEventListener('submit', function(e){
    e.preventDefault();
    if(formBox) formBox.classList.remove('is-error');
    if(errorBox) errorBox.classList.remove('show');
    var email = YC.app.$('#loginEmail').value;
    var pass = pw.value;
    var remember = YC.app.$('#rememberMe').checked;
    submit.disabled = true;
    submit.classList.add('loading');
    setTimeout(function(){
      var res = YC.auth.login(email, pass, remember);
      submit.disabled = false;
      submit.classList.remove('loading');
      if(res.ok){
        YC.toast.success('Welcome back, Admin!');
        if(errorBox) errorBox.classList.remove('show');
        setTimeout(function(){ location.href = next; }, 450);
      }else{
        if(formBox) formBox.classList.add('is-error');
        if(errorBox){
          errorBox.textContent = res.error;
          errorBox.classList.add('show');
        }
      }
    }, 450);
  });
};

/* ============================================================
   DASHBOARD
   ============================================================ */
YC.app.pages_dashboard = function(){
  var bookings = YC.services.bookings.all();
  var customers = YC.services.customers.all();
  var activePro = (YC.services.promotions.allWithStatus() || YC.services.promotions.all().map(function(p){ return Object.assign({}, p, { status: '' }); })).filter(function(p){ return p.status === 'active'; }).length;

  var statuses = { pending: 0, confirmed: 0, cancelled: 0, completed: 0 };
  bookings.forEach(function(b){ statuses[b.status] = (statuses[b.status] || 0) + 1; });
  var today = new Date();
  var nextWeek = new Date(today); nextWeek.setDate(nextWeek.getDate() + 7);
  var nwIso = YC.app.iso(nextWeek);
  var upcomingCount = bookings.filter(function(b){
    return b.date >= YC.app.iso(today) && b.date <= nwIso && b.status !== 'cancelled';
  }).length;
  var libCount = ['prompts', 'templates', 'videoTemplates', 'thumbnailTemplates'].reduce(function(sum, k){
    return sum + YC.services[k].all().filter(function(x){ return x.published; }).length;
  }, 0);

  YC.app.renderStats([
    { icon: 'bookings', num: bookings.length, label: 'Total bookings', delta: upcomingCount + ' in the next 7 days', dir: 'up' },
    { icon: 'clock', num: statuses.pending, label: 'Pending approval', delta: statuses.confirmed + ' confirmed', dir: 'up' },
    { icon: 'users', num: customers.length, label: 'Customers', delta: customers.filter(function(c){ return c.status === 'active'; }).length + ' active', dir: 'up' },
    { icon: 'layers', num: libCount, label: 'Published library items', delta: activePro + ' active promotions', dir: 'up' }
  ]);

  /* booking activity (last 14 days) */
  var area = YC.app.$('#chartActivity');
  if(area){
    var days = [];
    for(var i = 13; i >= 0; i--){
      var d = new Date(today); d.setDate(d.getDate() - i);
      var key = YC.app.iso(d);
      var c = bookings.filter(function(b){ return b.date === key; }).length;
      days.push({ label: (d.getMonth() + 1) + '/' + d.getDate(), value: c });
    }
    YC.charts.area(area, days);
  }
  var donut = YC.app.$('#chartDonut');
  if(donut){
    YC.charts.donut(donut, [
      { label: 'Pending', value: statuses.pending },
      { label: 'Confirmed', value: statuses.confirmed },
      { label: 'Completed', value: statuses.completed },
      { label: 'Cancelled', value: statuses.cancelled || 1 }
    ], { label: 'Bookings' });
  }

  /* recent bookings list */
  var recent = YC.app.$('#recentList');
  if(recent){
    recent.innerHTML = YC.services.bookings.recent(6).map(function(b){
      return '<div class="list-item"><span class="list-avatar">' + YC.avatar(b.customerName) + '</span>' +
        '<div class="li-main"><div class="t">' + YC.esc(b.customerName) + '</div><div class="s">' + YC.esc(YC.app.svcName(b.serviceId)) + ' &middot; ' + YC.esc(b.id) + '</div></div>' +
        '<div class="li-time">' + YC.timeAgo(b.createdAt) + '</div></div>';
    }).join('') || '<div class="empty-state" style="padding:30px"><strong>No bookings yet.</strong></div>';
  }
  /* upcoming */
  var upList = YC.app.$('#upcomingList');
  if(upList){
    upList.innerHTML = YC.services.bookings.upcoming(5).map(function(b){
      return '<div class="list-item"><span class="list-avatar">' + YC.avatar(b.customerName) + '</span>' +
        '<div class="li-main"><div class="t">' + YC.esc(b.customerName) + '</div><div class="s">' + YC.esc(YC.app.svcName(b.serviceId)) + '</div></div>' +
        '<div class="li-time">' + YC.fmtDate(b.date) + '</div></div>';
    }).join('') || '<div class="empty-state" style="padding:30px"><strong>Nothing upcoming.</strong></div>';
  }

  /* hbar ranks */
  var ranks1 = YC.app.$('#rankPrompts');
  if(ranks1){
    var pops = YC.services.prompts.popular(5);
    YC.charts.hbar(ranks1, pops.map(function(p, i){
      return { rank: i + 1, label: p.title, value: p.views || 0 };
    }));
  }
  var ranks2 = YC.app.$('#rankTemplates');
  if(ranks2){
    var tops = ['templates', 'videoTemplates', 'thumbnailTemplates'].reduce(function(a, k){
      return a.concat(YC.services[k].all());
    }, []).filter(function(t){ return t.published; })
      .sort(function(a, b){ return (b.downloads || 0) - (a.downloads || 0); })
      .slice(0, 5);
    YC.charts.hbar(ranks2, tops.map(function(t, i){
      return { rank: i + 1, label: t.title, value: t.downloads || 0 };
    }));
  }
};

/* ============================================================
   BOOKINGS
   ============================================================ */
YC.app.pages_bookings = function(){
  var svc = YC.services.bookings;
  var all = svc.all();

  YC.app.renderStats([
    { icon: 'bookings', num: all.length, label: 'Total bookings' },
    { icon: 'clock', num: all.filter(function(b){ return b.status === 'pending'; }).length, label: 'Pending approval' },
    { icon: 'check', num: all.filter(function(b){ return b.status === 'confirmed'; }).length, label: 'Confirmed' },
    { icon: 'layers', num: all.filter(function(b){ return b.status === 'completed'; }).length, label: 'Completed' }
  ]);

  var table = YC.app.Table({
    host: '#bookingsTable',
    empty: 'No bookings match your filters.',
    keys: ['id', 'customerName', 'email', 'phone'],
    sortKey: 'date',
    data: function(state){
      var list = svc.all();
      if(state.extra.status && state.extra.status !== 'all'){
        list = list.filter(function(b){ return b.status === state.extra.status; });
      }
      return list;
    },
    columns: [
      { title: 'Booking', key: 'id', sort: true, className: 'cell-main',
        render: function(r){ return r.id + '<div class="cell-sub">' + YC.esc(r.customerName) + '</div>'; } },
      { title: 'Contact', key: 'email',
        render: function(r){ return YC.esc(r.email) + '<div class="cell-sub cell-monster">' + YC.esc(r.phone || '') + '</div>'; } },
      { title: 'Service', key: 'serviceId',
        render: function(r){ return YC.esc(YC.app.svcName(r.serviceId)); } },
      { title: 'Date', key: 'date', sort: true,
        render: function(r){ return YC.fmtDate(r.date) + '<div class="cell-sub cell-monster">' + YC.esc(r.time) + '</div>'; } },
      { title: 'People', key: 'people', sort: true },
      { title: 'Status', key: 'status',
        render: function(r){ return YC.pill(r.status); } },
      { title: '', key: '__a',
        render: function(r){
          var h = YC.app.actBtn('view', 'eye', 'View') + YC.app.actBtn('edit', 'edit', 'Edit');
          if(r.status === 'pending'){
            h += YC.app.actBtn('confirm', 'check', 'Confirm');
            h += YC.app.actBtn('cancel', 'close', 'Cancel');
          }
          h += YC.app.actBtn('delete', 'trash', 'Delete');
          return '<span class="row-actions">' + h + '</span>';
        } }
    ],
    onAction: function(act, id, row){
      if(act === 'view') viewBooking(row);
      else if(act === 'edit') editBooking(row);
      else if(act === 'confirm'){ svc.setStatus(id, 'confirmed'); YC.toast.success('Booking confirmed.'); table.refresh(); }
      else if(act === 'cancel'){ svc.setStatus(id, 'cancelled'); YC.toast.info('Booking cancelled.'); table.refresh(); }
      else if(act === 'delete'){
        YC.app.confirm('Delete booking ' + id + '? This cannot be undone.', function(){
          svc.remove(id);
          YC.toast.success('Booking deleted.');
          table.refresh(); updateStats();
        });
      }
    }
  });

  var btnNew = YC.app.$('#btnNewBooking');
  if(btnNew) btnNew.addEventListener('click', function(){ editBooking(null); });

  function updateStats(){
    var a = svc.all();
    YC.app.renderStats([
      { icon: 'bookings', num: a.length, label: 'Total bookings' },
      { icon: 'clock', num: a.filter(function(b){ return b.status === 'pending'; }).length, label: 'Pending approval' },
      { icon: 'check', num: a.filter(function(b){ return b.status === 'confirmed'; }).length, label: 'Confirmed' },
      { icon: 'layers', num: a.filter(function(b){ return b.status === 'completed'; }).length, label: 'Completed' }
    ]);
  }

  function nextBookingId(){
    var nums = svc.all().map(function(b){ return parseInt(String(b.id).replace(/\D/g, ''), 10) || 0; });
    return 'YC-' + ((nums.length ? Math.max.apply(null, nums) : 1000) + 1);
  }

  function editBooking(row){
    var editing = !!row;
    var v = function(k){ return editing && row[k] != null ? row[k] : ''; };
    YC.app.openForm({
      title: editing ? 'Edit booking ' + row.id : 'New booking',
      eyebrow: 'Bookings',
      fields: [
        { t: 'text', name: 'customerName', label: 'Customer name', value: v('customerName'), required: true },
        { t: 'text', name: 'email', label: 'Email', value: v('email'), type: 'email', required: true },
        { t: 'text', name: 'phone', label: 'Phone', value: v('phone'), required: true },
        { t: 'select', name: 'serviceId', label: 'Service', value: v('serviceId'), required: true,
          options: YC.data.services.map(function(s){ return { value: s.id, label: s.short }; }) },
        { t: 'text', name: 'date', label: 'Date', value: v('date'), type: 'date', required: true },
        { t: 'text', name: 'time', label: 'Time', value: v('time') || '10:00', type: 'time' },
        { t: 'text', name: 'people', label: 'People', value: v('people') || 1, type: 'number', min: 1, max: 10 },
        { t: 'select', name: 'status', label: 'Status', value: v('status') || 'pending', required: true,
          options: ['pending', 'confirmed', 'cancelled', 'completed'] },
        { t: 'area', name: 'notes', label: 'Notes', value: v('notes'), rows: 3 }
      ],
      onSubmit: function(data, form){
        var missing = YC.app.required(data, ['customerName', 'email', 'phone', 'serviceId', 'date']);
        if(missing.length){ YC.app.markErrors(form, missing); return; }
        if(editing){
          svc.update(row.id, data);
          YC.toast.success('Booking updated.');
        }else{
          data.id = nextBookingId();
          data.createdAt = new Date().toISOString();
          svc.create(data);
          YC.toast.success('Booking created.');
        }
        YC.modal.close();
        table.refresh(); updateStats();
      }
    });
  }

  function viewBooking(row){
    var service = YC.data.getService(row.serviceId);
    var body =
      '<div class="kv-grid">' +
      '<div class="kv"><span>Booking</span><b>' + YC.esc(row.id) + '</b></div>' +
      '<div class="kv"><span>Customer</span><b>' + YC.esc(row.customerName) + '</b></div>' +
      '<div class="kv"><span>Email</span><b>' + YC.esc(row.email) + '</b></div>' +
      '<div class="kv"><span>Phone</span><b>' + YC.esc(row.phone || '—') + '</b></div>' +
      '<div class="kv"><span>Service</span><b>' + YC.esc(service ? service.short : row.serviceId) + '</b></div>' +
      '<div class="kv"><span>Date &amp; time</span><b>' + YC.fmtDate(row.date) + ' &middot; ' + YC.esc(row.time) + '</b></div>' +
      '<div class="kv"><span>People</span><b>' + YC.esc(row.people) + '</b></div>' +
      '<div class="kv"><span>Status</span><b>' + YC.pill(row.status) + '</b></div>' +
      '</div>' +
      (row.notes ? '<div style="margin-top:16px"><div class="field"><label>Notes</label><div style="font-size:13px;color:var(--gray);line-height:1.6;background:var(--glass);border:1px solid var(--line);border-radius:11px;padding:12px 14px">' + YC.esc(row.notes) + '</div></div></div>' : '');
    YC.modal.open({
      title: 'Booking ' + row.id,
      eyebrow: 'Booking details',
      size: 'lg',
      body: body,
      footer: [
        row.status === 'pending' ? '<button type="button" class="btn btn-success" data-act-confirm>Confirm</button>' : '',
        row.status !== 'completed' ? '<button type="button" class="btn btn-ghost" data-act-complete>Mark completed</button>' : '',
        '<button type="button" class="btn btn-ghost" data-close-modal>Close</button>'
      ].join(''),
      onMount: function(card){
        var confirmBtn = card.querySelector('[data-act-confirm]');
        if(confirmBtn) confirmBtn.addEventListener('click', function(){
          svc.setStatus(row.id, 'confirmed');
          YC.toast.success('Booking confirmed.');
          YC.modal.close(); table.refresh(); updateStats();
        });
        var completeBtn = card.querySelector('[data-act-complete]');
        if(completeBtn) completeBtn.addEventListener('click', function(){
          svc.setStatus(row.id, 'completed');
          YC.toast.success('Booking completed.');
          YC.modal.close(); table.refresh(); updateStats();
        });
        card.querySelector('[data-close-modal]').addEventListener('click', function(){ YC.modal.close(); });
      }
    });
  }

  YC.app.attachSearch('#searchBookings', function(q){ table.setQ(q); });
  YC.app.attachSelect('#filterStatus', function(v){ table.setExtra('status', v); });
  if(location.search.indexOf('new=1') >= 0) editBooking(null);
};

/* ============================================================
   CUSTOMERS
   ============================================================ */
YC.app.pages_customers = function(){
  var svc = YC.services.customers;

  function stats(){
    var all = svc.allWithStats();
    var totalBookings = all.reduce(function(s, c){ return s + (c.bookingCount || 0); }, 0);
    YC.app.renderStats([
      { icon: 'users', num: all.length, label: 'Total customers' },
      { icon: 'check', num: all.filter(function(c){ return c.status === 'active'; }).length, label: 'Active' },
      { icon: 'close', num: all.filter(function(c){ return c.status === 'disabled'; }).length, label: 'Disabled' },
      { icon: 'bookings', num: totalBookings, label: 'Total bookings' }
    ]);
  }
  stats();

  var table = YC.app.Table({
    host: '#customersTable',
    empty: 'No customers match your filters.',
    keys: ['name', 'email', 'phone'],
    sortKey: 'registered',
    data: function(){
      return svc.allWithStats();
    },
    columns: [
      { title: 'Customer', key: 'name',
        render: function(r){
          return '<span style="display:inline-flex;align-items:center;gap:10px"><span class="list-avatar">' + YC.avatar(r.name) + '</span>' +
            '<span>' + YC.esc(r.name) + '<div class="cell-sub">' + YC.esc(r.email) + '</div></span></span>';
        } },
      { title: 'Phone', key: 'phone', className: 'cell-monster' },
      { title: 'Registered', key: 'registered', sort: true,
        render: function(r){ return YC.fmtDate(r.registered); } },
      { title: 'Bookings', key: 'bookingCount', sort: true },
      { title: 'Last booking', key: 'lastBooking',
        render: function(r){
          return r.lastBooking ? r.lastBooking.date + '<div class="cell-sub">' + YC.esc(r.lastBooking.serviceName) + '</div>' : '—';
        } },
      { title: 'Status', key: 'status',
        render: function(r){ return YC.pill(r.status); } },
      { title: '', key: '__a',
        render: function(r){
          var toggle = r.status === 'active' ? 'disable' : 'enable';
          var tIcon = r.status === 'active' ? 'eyeOff' : 'eye';
          return '<span class="row-actions">' +
            YC.app.actBtn('view', 'eye', 'View') + YC.app.actBtn(toggle, tIcon, r.status === 'active' ? 'Disable' : 'Enable') +
            YC.app.actBtn('delete', 'trash', 'Delete') + '</span>';
        } }
    ],
    onAction: function(act, id, row){
      if(act === 'view') viewCustomer(row);
      else if(act === 'enable'){ svc.toggleStatus(id); YC.toast.success('Customer enabled.'); table.refresh(); stats(); }
      else if(act === 'disable'){ svc.toggleStatus(id); YC.toast.info('Customer disabled.'); table.refresh(); stats(); }
      else if(act === 'delete'){
        YC.app.confirm('Delete customer ' + row.name + '? Their bookings stay in the system.', function(){
          svc.remove(id); YC.toast.success('Customer deleted.'); table.refresh(); stats();
        });
      }
    }
  });

  var btnNew = YC.app.$('#btnNewCustomer');
  if(btnNew) btnNew.addEventListener('click', function(){ editCustomer(null); });

  function editCustomer(row){
    var editing = !!row;
    var v = function(k){ return editing && row[k] != null ? row[k] : ''; };
    YC.app.openForm({
      title: editing ? 'Edit customer' : 'New customer',
      eyebrow: 'Customers',
      fields: [
        { t: 'text', name: 'name', label: 'Name', value: v('name'), required: true },
        { t: 'text', name: 'email', label: 'Email', value: v('email'), type: 'email', required: true },
        { t: 'text', name: 'phone', label: 'Phone', value: v('phone'), required: true },
        { t: 'select', name: 'status', label: 'Status', value: v('status') || 'active', options: ['active', 'disabled'] }
      ],
      onSubmit: function(data, form){
        var missing = YC.app.required(data, ['name', 'email']);
        if(missing.length){ YC.app.markErrors(form, missing); return; }
        if(editing){
          svc.update(row.id, data);
          YC.toast.success('Customer updated.');
        }else{
          data.registered = new Date().toISOString();
          svc.create(data);
          YC.toast.success('Customer added.');
        }
        YC.modal.close(); table.refresh(); stats();
      }
    });
  }

  function viewCustomer(row){
    var history = svc.bookingHistory(row.id);
    var body =
      '<div class="kv-grid">' +
      '<div class="kv"><span>Name</span><b>' + YC.esc(row.name) + '</b></div>' +
      '<div class="kv"><span>Email</span><b>' + YC.esc(row.email) + '</b></div>' +
      '<div class="kv"><span>Phone</span><b>' + YC.esc(row.phone || '—') + '</b></div>' +
      '<div class="kv"><span>Status</span><b>' + YC.pill(row.status) + '</b></div>' +
      '<div class="kv"><span>Registered</span><b>' + YC.fmtDate(row.registered) + '</b></div>' +
      '<div class="kv"><span>Total bookings</span><b>' + (row.bookingCount || 0) + '</b></div>' +
      '</div>' +
      '<div style="margin-top:18px"><div class="field"><label>Booking history</label></div>' +
      (history.length ? history.map(function(b){
        return '<div class="list-item"><span class="list-avatar">' + YC.avatar(b.customerName) + '</span>' +
          '<div class="li-main"><div class="t">' + YC.esc(b.id) + ' &middot; ' + YC.esc(YC.app.svcName(b.serviceId)) + '</div>' +
          '<div class="s">' + YC.fmtDate(b.date) + ' ' + YC.esc(b.time) + '</div></div><div class="li-time">' + YC.pill(b.status) + '</div></div>';
      }).join('') : '<p style="color:var(--gray);font-size:13px">No bookings yet.</p>') + '</div>';
    YC.modal.open({
      title: row.name,
      eyebrow: 'Customer',
      size: 'lg',
      body: body,
      footer: '<button type="button" class="btn btn-ghost" data-close-modal>Close</button>',
      onMount: function(card){
        card.querySelector('[data-close-modal]').addEventListener('click', function(){ YC.modal.close(); });
      }
    });
  }

  YC.app.attachSearch('#searchCustomers', function(q){ table.setQ(q); });
  if(location.search.indexOf('new=1') >= 0) editCustomer(null);
};

/* ============================================================
   CONTENT HUB
   ============================================================ */
YC.app.pages_content = function(){
  var types = [
    { file: 'ai-prompts.html', icon: 'prompts', name: 'AI Prompts',
      desc: 'Ready-to-use prompts tuned for YouTube, thumbnails, scripts and more.',
      count: YC.services.prompts.all().length },
    { file: 'templates.html', icon: 'templates', name: 'Templates',
      desc: 'Design templates for Photoshop, Canva, Figma and other tools.',
      count: YC.services.templates.all().length },
    { file: 'video-templates.html', icon: 'video', name: 'Video Templates',
      desc: 'Editable Premiere / After Effects / CapCut projects and packs.',
      count: YC.services.videoTemplates.all().length },
    { file: 'thumbnail-templates.html', icon: 'thumbnail', name: 'Thumbnail Templates',
      desc: 'High-CTR thumbnail layouts with real preview images.',
      count: YC.services.thumbnailTemplates.all().length },
    { file: 'files.html', icon: 'files', name: 'Files',
      desc: 'Brand assets, presets and downloadable resources.',
      count: YC.services.files ? YC.services.files.all().length : YC.data.files.length }
  ];
  var host = YC.app.$('#contentHub');
  if(!host) return;
  host.innerHTML = types.map(function(t){
    return '<a href="' + t.file + '" class="card card-pad" style="display:flex;flex-direction:column;gap:10px;text-decoration:none">' +
      '<div class="content-type-icon"><span class="ic">' + YC.icons.get(t.icon) + '</span></div>' +
      '<div><div class="card-title">' + t.name + '</div><div class="card-sub">' + YC.esc(t.desc) + '</div></div>' +
      '<div class="content-type-meta">' +
        '<span class="pill neutral">' + t.count + ' items</span>' +
        '<span class="btn-link">Manage</span>' +
      '</div></a>';
  }).join('');
};

/* ============================================================
   AI PROMPTS
   ============================================================ */
YC.app.pages_prompts = function(){
  var svc = YC.services.prompts;

  function stats(){
    var all = svc.all();
    var views = all.reduce(function(s, p){ return s + (p.views || 0); }, 0);
    YC.app.renderStats([
      { icon: 'prompts', num: all.length, label: 'Total prompts' },
      { icon: 'check', num: all.filter(function(p){ return p.published; }).length, label: 'Published' },
      { icon: 'star', num: all.filter(function(p){ return p.featured; }).length, label: 'Featured' },
      { icon: 'eye', num: YC.abbrNum(views), label: 'Total views' }
    ]);
  }
  stats();

  var categories = (function(){
    var seen = {}, out = [];
    svc.all().forEach(function(p){ if(!seen[p.category]){ seen[p.category] = 1; out.push(p.category); } });
    return out.sort();
  })();

  var table = YC.app.Table({
    host: '#promptsTable',
    empty: 'No prompts match your filters.',
    keys: ['title', 'description', 'category'],
    sortKey: 'views',
    data: function(state){
      return svc.byFilters(state.extra);
    },
    columns: [
      { title: 'Prompt', key: 'title',
        render: function(r){
          return '<span style="display:inline-flex;align-items:center;gap:10px">' + YC.app.previewThumb(r) +
            '<span>' + YC.esc(r.title) + '<div class="cell-sub">' + YC.esc(r.category) + '</div></span></span>';
        } },
      { title: 'Platform', key: 'platform',
        render: function(r){ return '<span class="pill neutral">' + YC.esc(r.platform) + '</span>'; } },
      { title: 'Views', key: 'views', sort: true },
      { title: 'Favorites', key: 'favorites', sort: true },
      { title: 'Featured', key: 'featured',
        render: function(r){
          return '<button type="button" class="btn-icon' + (r.featured ? '" style="color:var(--red);border-color:rgba(255,51,68,.4)"' : '"') + ' data-act="feature" title="Toggle featured"><span class="ic">' +
            YC.icons.get(r.featured ? 'star' : 'starOutline') + '</span></button>';
        } },
      { title: 'Status', key: 'published',
        render: function(r){
          return '<label class="switch"><input type="checkbox" data-switch="' + r.id + '" data-on="publish"' +
            (r.published ? ' checked' : '') + '><span class="track"></span></label>' +
            '<span class="s-text" style="margin-left:8px;font-size:12px;color:var(--gray)">' + (r.published ? 'Published' : 'Draft') + '</span>';
        } },
      { title: '', key: '__a',
        render: function(r){
          return '<span class="row-actions">' +
            YC.app.actBtn('view', 'eye', 'View') + YC.app.actBtn('copy', 'copy', 'Copy prompt') +
            YC.app.actBtn('edit', 'edit', 'Edit') + YC.app.actBtn('delete', 'trash', 'Delete') + '</span>';
        } }
    ],
    onAction: function(act, id, row){
      if(act === 'view') viewPrompt(row);
      else if(act === 'copy'){ YC.copyText(row.prompt); }
      else if(act === 'feature'){ svc.toggleFeatured(id); table.refresh(); stats(); }
      else if(act === 'edit') editPrompt(row);
      else if(act === 'delete'){
        YC.app.confirm('Delete this prompt?', function(){
          svc.remove(id); YC.toast.success('Prompt deleted.'); table.refresh(); stats();
        });
      }
    },
    onSwitch: function(act, id, row, checked){
      if(act === 'publish'){ svc.togglePublish(id); table.refresh(); stats(); YC.toast.info(checked ? 'Prompt published.' : 'Prompt set to draft.'); }
    }
  });

  populateSelects();

  var btnNew = YC.app.$('#btnNewPrompt');
  if(btnNew) btnNew.addEventListener('click', function(){ editPrompt(null); });

  function populateSelects(){
    var cat = YC.$('#filterPromptCat');
    if(cat){
      categories.forEach(function(c){
        var o = document.createElement('option');
        o.value = c; o.textContent = c;
        cat.appendChild(o);
      });
    }
  }

  function editPrompt(row){
    var editing = !!row;
    var v = function(k){ return editing && row[k] != null ? row[k] : ''; };
    var catOptions = categories.slice();
    if(editing && catOptions.indexOf(row.category) < 0) catOptions.push(row.category);
    YC.app.openForm({
      title: editing ? 'Edit prompt' : 'New prompt',
      eyebrow: 'AI Prompts',
      size: 'lg',
      fields: [
        { t: 'text', name: 'title', label: 'Title', value: v('title'), required: true },
        { t: 'area', name: 'description', label: 'Short description', value: v('description'), rows: 2, required: true },
        { t: 'area', name: 'prompt', label: 'Prompt text', value: v('prompt'), rows: 7, required: true },
        { t: 'select', name: 'category', label: 'Category', value: v('category'), required: true, options: catOptions },
        { t: 'select', name: 'platform', label: 'Platform', value: v('platform'), required: true, options: svc.PLATFORMS },
        { t: 'text', name: 'tags', label: 'Tags (comma separated)', value: editing ? (row.tags || []).join(', ') : '' },
        { t: 'text', name: 'previewEmoji', label: 'Preview emoji', value: v('previewEmoji') || '✨' },
        { t: 'text', name: 'previewColor', label: 'Preview color', value: v('previewColor') || '#101216', type: 'color' },
        { t: 'sw', name: 'featured', label: 'Featured on homepage', value: v('featured') },
        { t: 'sw', name: 'published', label: 'Published', value: editing ? v('published') : true }
      ],
      onSubmit: function(data, form){
        var missing = YC.app.required(data, ['title', 'description', 'prompt', 'category', 'platform']);
        if(missing.length){ YC.app.markErrors(form, missing); return; }
        data.tags = String(data.tags || '').split(',').map(function(t){ return t.trim(); }).filter(Boolean);
        if(editing){
          svc.update(row.id, data);
          YC.toast.success('Prompt updated.');
        }else{
          data.views = data.views || 0;
          data.favorites = data.favorites || 0;
          data.preview = null;
          svc.create(data);
          YC.toast.success('Prompt created.');
        }
        YC.modal.close(); table.refresh(); stats();
        var catEl = YC.$('#filterPromptCat');
        if(catEl && [data.category].indexOf(categories.indexOf(data.category) > -1 ? data.category : -1) === -1){
          var o = document.createElement('option'); o.value = data.category; o.textContent = data.category; catEl.appendChild(o);
        }
      }
    });
  }

  function viewPrompt(row){
    YC.modal.open({
      title: row.title,
      eyebrow: row.platform + ' · ' + row.category,
      size: 'lg',
      body:
        '<p style="color:var(--gray);font-size:13px;line-height:1.6;margin-bottom:14px">' + YC.esc(row.description) + '</p>' +
        '<div class="prompt-code-view">' + YC.esc(row.prompt).replace(/\n/g, '<br>') + '</div>' +
        '<div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">' +
          row.tags.map(function(t){ return '<span class="pill neutral">#' + YC.esc(t) + '</span>'; }).join('') +
        '</div>' +
        '<div style="display:flex;gap:18px;margin-top:16px" class="cell-monster" style="font-family:JetBrains Mono,monospace;font-size:12px;color:var(--gray)">' +
          '<span>' + YC.esc(YC.abbrNum(row.views || 0)) + ' views</span><span>' + YC.esc(row.favorites || 0) + ' favorites</span>' +
          '<span>' + (row.published ? 'Published' : 'Draft') + '</span>' +
        '</div>',
      footer: '<button type="button" class="btn btn-ghost" data-copy>Copy prompt</button>' +
        '<button type="button" class="btn btn-ghost" data-close-modal>Close</button>',
      onMount: function(card){
        card.querySelector('[data-copy]').addEventListener('click', function(){ YC.copyText(row.prompt); });
        card.querySelector('[data-close-modal]').addEventListener('click', function(){ YC.modal.close(); });
      }
    });
  }

  YC.app.attachSearch('#searchPrompts', function(q){ table.setQ(q); });
  YC.app.attachSelect('#filterPromptCat', function(v){ table.setExtra('category', v); });
  YC.app.attachSelect('#filterPromptPlatform', function(v){ table.setExtra('platform', v); });
  YC.app.attachSelect('#filterPromptStatus', function(v){ table.setExtra('status', v); });
  if(location.search.indexOf('new=1') >= 0) editPrompt(null);
};

/* ============================================================
   DESIGN TEMPLATES
   ============================================================ */
YC.app.pages_templates = function(){
  templatesPage(YC.services.templates, {
    host: '#templatesTable', search: '#searchTemplates',
    typeFilter: '#filterTemplateType', statusFilter: '#filterTemplateStatus',
    newBtn: '#btnNewTemplate',
    title: 'Template', eyebrow: 'Templates'
  });
};

/* ============================================================
   VIDEO TEMPLATES
   ============================================================ */
YC.app.pages_videoTemplates = function(){
  templatesPage(YC.services.videoTemplates, {
    host: '#videoTemplatesTable', search: '#searchVideoTemplates',
    typeFilter: '#filterVideoPlatform', statusFilter: '#filterVideoStatus',
    newBtn: '#btnNewVideoTemplate',
    title: 'Video template', eyebrow: 'Video Templates', platformFilter: true
  });
};

/* ============================================================
   THUMBNAIL TEMPLATES
   ============================================================ */
YC.app.pages_thumbnailTemplates = function(){
  templatesPage(YC.services.thumbnailTemplates, {
    host: '#thumbTemplatesTable', search: '#searchThumbTemplates',
    typeFilter: '#filterThumbPlatform', statusFilter: '#filterThumbStatus',
    newBtn: '#btnNewThumbTemplate',
    title: 'Thumbnail template', eyebrow: 'Thumbnail Templates', platformFilter: true, thumb: true
  });
};

function templatesPage(svc, cfg){
  var isVideo = cfg.platformFilter && !cfg.thumb;
  var isThumb = cfg.thumb;

  function stats(){
    var all = svc.all();
    var dl = all.reduce(function(s, t){ return s + (t.downloads || 0); }, 0);
    YC.app.renderStats([
      { icon: 'layers', num: all.length, label: 'Total ' + cfg.eyebrow.toLowerCase() },
      { icon: 'check', num: all.filter(function(t){ return t.published; }).length, label: 'Published' },
      { icon: 'star', num: all.filter(function(t){ return t.featured; }).length, label: 'Featured' },
      { icon: 'download', num: YC.abbrNum(dl), label: 'Total downloads' }
    ]);
  }
  stats();

  function platforms(){
    var seen = {}, out = [];
    svc.all().forEach(function(t){ if(t.platform && !seen[t.platform]){ seen[t.platform] = 1; out.push(t.platform); } });
    return out.sort();
  }
  function types(){
    var seen = {}, out = [];
    svc.all().forEach(function(t){ if(t.type && !seen[t.type]){ seen[t.type] = 1; out.push(t.type); } });
    return out.sort();
  }
  function cats(){
    var seen = {}, out = [];
    svc.all().forEach(function(t){ if(t.category && !seen[t.category]){ seen[t.category] = 1; out.push(t.category); } });
    return out.sort();
  }

  var extraCol = isVideo
    ? { title: 'Format', key: 'platform',
        render: function(r){ return YC.esc(r.platform) + '<div class="cell-sub cell-monster">' + YC.esc(r.resolution) + ' &middot; ' + YC.esc(r.aspectRatio) + '</div>'; } }
    : isThumb
      ? { title: 'Format', key: 'platform',
          render: function(r){ return YC.esc(r.platform) + '<div class="cell-sub cell-monster">' + YC.esc(r.dimensions) + '</div>'; } }
      : { title: 'Type', key: 'type', render: function(r){ return YC.app.typeChip(r.type); } };

  var table = YC.app.Table({
    host: cfg.host,
    empty: 'No templates match your filters.',
    keys: ['title', 'description', 'category'],
    sortKey: 'downloads',
    data: function(state){
      return svc.byFilters(state.extra);
    },
    columns: [
      { title: 'Template', key: 'title',
        render: function(r){
          return '<span style="display:inline-flex;align-items:center;gap:10px">' + YC.app.previewThumb(r) +
            '<span>' + YC.esc(r.title) + '<div class="cell-sub">' + YC.esc(r.category) + '</div></span></span>';
        } },
      extraCol,
      isThumb
        ? { title: 'Favorites', key: 'favorites', sort: true }
        : { title: 'Size', key: 'fileSize', className: 'cell-monster' },
      { title: 'Downloads', key: 'downloads', sort: true },
      { title: 'Status', key: 'published',
        render: function(r){
          return '<label class="switch"><input type="checkbox" data-switch="' + r.id + '" data-on="publish"' +
            (r.published ? ' checked' : '') + '><span class="track"></span></label>' +
            '<span class="s-text" style="margin-left:8px;font-size:12px;color:var(--gray)">' + (r.published ? 'Published' : 'Draft') + '</span>';
        } },
      { title: '', key: '__a',
        render: function(r){
          return '<span class="row-actions">' +
            YC.app.actBtn('view', 'eye', 'View') + YC.app.actBtn('download', 'download', 'Download') +
            YC.app.actBtn('edit', 'edit', 'Edit') + YC.app.actBtn('delete', 'trash', 'Delete') + '</span>';
        } }
    ],
    onAction: function(act, id, row){
      if(act === 'view') viewTemplate(row);
      else if(act === 'download'){ svc.incrementDownloads(id); YC.downloadDemo(row.file || row.title); YC.toast.success('Downloading demo file…'); table.refresh(); stats(); }
      else if(act === 'edit') editTemplate(row);
      else if(act === 'delete'){
        YC.app.confirm('Delete this template?', function(){
          svc.remove(id); YC.toast.success('Template deleted.'); table.refresh(); stats();
        });
      }
    },
    onSwitch: function(act, id, row, checked){
      if(act === 'publish'){ svc.togglePublish(id); table.refresh(); stats(); YC.toast.info(checked ? 'Template published.' : 'Template set to draft.'); }
    }
  });

  populateSelects();

  var btnNew = document.querySelector(cfg.newBtn);
  if(btnNew) btnNew.addEventListener('click', function(){ editTemplate(null); });

  function populateSelects(){
    var tf = document.querySelector(cfg.typeFilter);
    if(tf){
      (isVideo || isThumb ? platforms() : types()).forEach(function(v){
        var o = document.createElement('option'); o.value = v; o.textContent = v; tf.appendChild(o);
      });
    }
  }

  function editTemplate(row){
    var editing = !!row;
    var v = function(k){ return editing && row[k] != null ? row[k] : ''; };
    var typeOpts = (isVideo || isThumb ? platforms() : types()).concat(isVideo || isThumb ? [] : ['PSD', 'ZIP', 'Canva', 'Figma', 'After Effects', 'Premiere Pro', 'CapCut', 'PowerPoint', 'Illustrator', 'PNG', 'PDF', 'JPG']);
    typeOpts = typeOpts.filter(function(x, i){ return typeOpts.indexOf(x) === i; });
    var fields = [
      { t: 'text', name: 'title', label: 'Title', value: v('title'), required: true },
      { t: 'area', name: 'description', label: 'Description', value: v('description'), rows: 2, required: true },
      { t: 'select', name: isVideo || isThumb ? 'platform' : 'type', label: isVideo || isThumb ? 'Platform' : 'Type',
        value: editing ? v('type') || v('platform') || typeOpts[0] : typeOpts[0], required: true, options: typeOpts },
      { t: 'text', name: 'category', label: 'Category', value: v('category'), required: true },
      { t: 'text', name: 'tags', label: 'Tags (comma separated)', value: editing ? (row.tags || []).join(', ') : '' },
      { t: 'text', name: 'preview', label: 'Preview image URL (optional)', value: v('preview') },
      { t: 'text', name: 'previewEmoji', label: 'Fallback emoji', value: v('previewEmoji') || '📦' },
      { t: 'text', name: 'previewColor', label: 'Fallback color', value: v('previewColor') || '#101216', type: 'color' }
    ];
    if(isVideo){
      fields.push(
        { t: 'text', name: 'duration', label: 'Duration', value: v('duration'), required: true },
        { t: 'text', name: 'resolution', label: 'Resolution', value: v('resolution'), required: true },
        { t: 'text', name: 'aspectRatio', label: 'Aspect ratio', value: v('aspectRatio') || '16:9' }
      );
    }
    if(isThumb){
      fields.push(
        { t: 'text', name: 'dimensions', label: 'Dimensions', value: v('dimensions') || '1280x720', required: true }
      );
    }
    fields.push(
      { t: 'text', name: 'file', label: 'File name', value: v('file'), placeholder: 'template-pack.zip' },
      { t: 'text', name: 'fileSize', label: 'File size', value: v('fileSize'), placeholder: '24 MB' },
      isVideo || isThumb ? { t: 'text', name: 'software', label: 'Software', value: v('software'), required: true } : { t: 'text', name: 'fileSizeFake', label: '', value: '' },
      { t: 'sw', name: 'featured', label: 'Featured', value: v('featured') },
      { t: 'sw', name: 'published', label: 'Published', value: editing ? v('published') : true }
    );
    if(!isVideo && !isThumb){
      var f = { t: 'text', name: 'software', label: 'Software', value: v('software'), required: true };
      fields.splice(2, 0, f);
      fields = fields.filter(function(x){ return x.name !== 'fileSizeFake'; });
    }

    YC.app.openForm({
      title: editing ? 'Edit ' + cfg.title.toLowerCase() : 'New ' + cfg.title.toLowerCase(),
      eyebrow: cfg.eyebrow,
      size: 'lg',
      fields: fields,
      onSubmit: function(data, form){
        var req = ['title', 'description', 'category', 'software'];
        if(isVideo) req.push('platform', 'duration', 'resolution');
        if(isThumb) req.push('platform', 'dimensions');
        var missing = YC.app.required(data, req);
        if(missing.length){ YC.app.markErrors(form, missing); return; }
        data.tags = String(data.tags || '').split(',').map(function(t){ return t.trim(); }).filter(Boolean);
        if(editing){
          svc.update(row.id, data);
          YC.toast.success('Template updated.');
        }else{
          data.downloads = 0;
          data.file = data.file || YC.slugify(data.title) + '.zip';
          svc.create(data);
          YC.toast.success('Template created.');
        }
        YC.modal.close(); table.refresh(); stats();
      }
    });
  }

  function viewTemplate(row){
    var meta = [];
    if(row.type) meta.push(YC.app.typeChip(row.type));
    if(row.platform) meta.push('<span class="pill neutral">' + YC.esc(row.platform) + '</span>');
    if(row.duration) meta.push('<span class="pill neutral">' + YC.esc(row.duration) + '</span>');
    if(row.resolution) meta.push('<span class="pill neutral">' + YC.esc(row.resolution) + '</span>');
    if(row.aspectRatio) meta.push('<span class="pill neutral">' + YC.esc(row.aspectRatio) + '</span>');
    YC.modal.open({
      title: row.title,
      eyebrow: cfg.eyebrow,
      size: 'lg',
      body:
        (row.preview ? '<div style="border:1px solid var(--line);border-radius:14px;overflow:hidden;margin-bottom:16px"><img src="' + YC.esc(row.preview) + '" style="width:100%;height:200px;object-fit:cover" alt=""></div>' : '') +
        '<p style="color:var(--gray);font-size:13px;line-height:1.6;margin-bottom:14px">' + YC.esc(row.description) + '</p>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">' + meta.join('') + '</div>' +
        '<div class="kv-grid">' +
          (row.platform ? '<div class="kv"><span>Platform</span><b>' + YC.esc(row.platform) + '</b></div>' : '') +
          (row.dimensions ? '<div class="kv"><span>Dimensions</span><b>' + YC.esc(row.dimensions) + '</b></div>' : '') +
          '<div class="kv"><span>Software</span><b>' + YC.esc(row.software || '—') + '</b></div>' +
          '<div class="kv"><span>Version</span><b>' + YC.esc(row.version || '—') + '</b></div>' +
          '<div class="kv"><span>File</span><b>' + YC.esc(row.file || '—') + '</b></div>' +
          '<div class="kv"><span>Size</span><b>' + YC.esc(row.fileSize || '—') + '</b></div>' +
          '<div class="kv"><span>Downloads</span><b>' + YC.esc(row.downloads || 0) + '</b></div>' +
          '<div class="kv"><span>Created</span><b>' + YC.fmtDate(row.createdAt) + '</b></div>' +
        '</div>',
      footer: '<button type="button" class="btn btn-primary" data-dl>Download</button>' +
        '<button type="button" class="btn btn-ghost" data-close-modal>Close</button>',
      onMount: function(card){
        card.querySelector('[data-dl]').addEventListener('click', function(){
          svc.incrementDownloads(row.id);
          YC.downloadDemo(row.file || row.title);
          YC.toast.success('Downloading demo file…');
          YC.modal.close(); table.refresh(); stats();
        });
        card.querySelector('[data-close-modal]').addEventListener('click', function(){ YC.modal.close(); });
      }
    });
  }

  YC.app.attachSearch(cfg.search, function(q){ table.setQ(q); });
  YC.app.attachSelect(cfg.typeFilter, function(v){ table.setExtra(isVideo || isThumb ? 'platform' : 'type', v); });
  YC.app.attachSelect(cfg.statusFilter, function(v){ table.setExtra('status', v); });
  if(location.search.indexOf('new=1') >= 0) editTemplate(null);
}

/* ============================================================
   FILES
   ============================================================ */
YC.app.pages_files = function(){
  var svc = (function(){
    if(YC.services && YC.services.files) return YC.services.files;
    var s = YC.createService('yc:files', function(){ return JSON.parse(JSON.stringify(YC.data.files)); });
    s.seed();
    return s;
  })();

  function sizeNum(v){
    var m = /([\d.]+)\s*(MB|GB|KB)/i.exec(String(v));
    if(!m) return 0;
    var n = parseFloat(m[1]);
    return m[2].toUpperCase() === 'GB' ? n * 1024 : m[2].toUpperCase() === 'KB' ? n / 1024 : n;
  }

  function stats(){
    var all = svc.all();
    var total = all.reduce(function(s, f){ return s + sizeNum(f.size); }, 0);
    YC.app.renderStats([
      { icon: 'files', num: all.length, label: 'Total files' },
      { icon: 'eye', num: all.filter(function(f){ return f.status === 'public'; }).length, label: 'Public' },
      { icon: 'eyeOff', num: all.filter(function(f){ return f.status === 'private'; }).length, label: 'Private' },
      { icon: 'layers', num: (total >= 1024 ? (total / 1024).toFixed(1) : total), label: 'Total size', unit: total >= 1024 ? 'GB' : 'MB' }
    ]);
  }
  stats();

  var cats = [];
  (function(){
    var seen = {};
    svc.all().forEach(function(f){ if(!seen[f.category]){ seen[f.category] = 1; cats.push(f.category); } });
    cats.sort();
  })();

  var table = YC.app.Table({
    host: '#filesTable',
    empty: 'No files match your filters.',
    keys: ['name', 'type', 'category'],
    sortKey: 'date',
    data: function(state){
      var list = svc.all();
      if(state.extra.status && state.extra.status !== 'all') list = list.filter(function(f){ return f.status === state.extra.status; });
      if(state.extra.category && state.extra.category !== 'all') list = list.filter(function(f){ return f.category === state.extra.category; });
      return list;
    },
    columns: [
      { title: 'File', key: 'name',
        render: function(r){
          return '<span style="display:inline-flex;align-items:center;gap:10px">' + YC.app.previewThumb(r) +
            '<span>' + YC.esc(r.name) + '<div class="cell-sub">' + YC.pill(r.status) + '</div></span></span>';
        } },
      { title: 'Type', key: 'type', render: function(r){ return YC.app.typeChip(r.type); } },
      { title: 'Size', key: 'size', className: 'cell-monster' },
      { title: 'Category', key: 'category' },
      { title: 'Uploaded', key: 'date', sort: true, render: function(r){ return YC.fmtDate(r.date); } },
      { title: '', key: '__a',
        render: function(r){
          return '<span class="row-actions">' +
            YC.app.actBtn('download', 'download', 'Download') + YC.app.actBtn('edit', 'edit', 'Edit') +
            YC.app.actBtn('delete', 'trash', 'Delete') + '</span>';
        } }
    ],
    onAction: function(act, id, row){
      if(act === 'download'){ YC.downloadDemo(row.name); YC.toast.success('Downloading demo file…'); }
      else if(act === 'edit') editFile(row);
      else if(act === 'delete'){
        YC.app.confirm('Delete file ' + row.name + '?', function(){
          svc.remove(id); YC.toast.success('File deleted.'); table.refresh(); stats();
        });
      }
    }
  });

  var btnNew = YC.app.$('#btnUpload');
  if(btnNew) btnNew.addEventListener('click', function(){ editFile(null); });

  function editFile(row){
    var editing = !!row;
    var v = function(k){ return editing && row[k] != null ? row[k] : ''; };
    YC.app.openForm({
      title: editing ? 'Edit file' : 'Upload file (demo)',
      eyebrow: 'Files',
      fields: [
        { t: 'text', name: 'name', label: 'File name', value: v('name'), required: true },
        { t: 'select', name: 'type', label: 'Type', value: v('type'), required: true,
          options: ['ZIP', 'PSD', 'PDF', 'JPG', 'PNG', 'AI', 'Figma', 'Canva', 'Other'] },
        { t: 'text', name: 'size', label: 'File size', value: v('size'), placeholder: '24 MB' },
        { t: 'select', name: 'category', label: 'Category', value: v('category'), required: true, options: cats },
        { t: 'select', name: 'status', label: 'Visibility', value: v('status') || 'public', options: ['public', 'private'] },
        { t: 'text', name: 'preview', label: 'Preview image URL (optional)', value: v('preview') },
        { t: 'text', name: 'url', label: 'Storage URL', value: v('url'), placeholder: 'https://storage.yallahclick.com/files/...' }
      ],
      onSubmit: function(data, form){
        var missing = YC.app.required(data, ['name', 'type', 'category']);
        if(missing.length){ YC.app.markErrors(form, missing); return; }
        if(editing){
          svc.update(row.id, data);
          YC.toast.success('File updated.');
        }else{
          data.date = YC.app.iso(new Date());
          data.url = data.url || 'https://storage.yallahclick.com/files/' + YC.slugify(data.name);
          svc.create(data);
          YC.toast.success('File uploaded (demo).');
        }
        YC.modal.close(); table.refresh(); stats();
      }
    });
  }

  YC.app.attachSearch('#searchFiles', function(q){ table.setQ(q); });
  YC.app.attachSelect('#filterFileCat', function(v){ table.setExtra('category', v); });
  YC.app.attachSelect('#filterFileStatus', function(v){ table.setExtra('status', v); });
};

/* ============================================================
   PROMOTIONS
   ============================================================ */
YC.app.pages_promotions = function(){
  var svc = YC.services.promotions;
  var state = { q: '', status: 'all' };

  function stats(){
    var all = svc.allWithStatus();
    YC.app.renderStats([
      { icon: 'promotions', num: all.length, label: 'Total promotions' },
      { icon: 'check', num: all.filter(function(p){ return p.status === 'active'; }).length, label: 'Active now' },
      { icon: 'clock', num: all.filter(function(p){ return p.status === 'scheduled'; }).length, label: 'Scheduled' },
      { icon: 'layers', num: all.filter(function(p){ return p.popupEnabled; }).length, label: 'Popup enabled' }
    ]);
  }
  stats();

  function pcard(p){
    var disc = p.discountType === 'percentage' ? (p.discountValue + '% OFF') : '$' + p.discountValue + ' OFF';
    var statusPill = YC.pill(p.status);
    var meta = [];
    meta.push('<span class="pill neutral">' + (p.promoType === 'discount' ? 'Direct discount' : 'Coupon code') + '</span>');
    if(p.popupEnabled) meta.push('<span class="pill active">Popup ON</span>');
    if(p.featured) meta.push('<span class="pill active">Featured</span>');
    if(p.countdownEnabled) meta.push('<span class="pill neutral">Countdown</span>');
    if(p.showOnce) meta.push('<span class="pill neutral">Show once</span>');
    meta.push('<span class="pill neutral">' + (p.popupPosition || 'center') + '</span>');
    var codeRow = p.promoType === 'discount'
      ? '<div class="code-row"><span class="pc-code">No code &middot; auto-applied</span></div>'
      : '<div class="code-row"><span class="pc-code">' + YC.esc(p.promoCode || '') + '</span>' +
        '<button type="button" class="btn-link" data-copy-code="' + YC.esc(p.promoCode || '') + '">&#128203; Copy</button></div>';
    return '<div class="card card-pad promo-card">' +
      '<div class="pc-top"><div><h3>' + YC.esc(p.title) + '</h3>' +
      '<div class="pc-service">' + YC.esc(YC.app.svcName(p.serviceId)) + '</div></div>' + statusPill + '</div>' +
      '<div class="pc-discount">' + YC.esc(disc) + '</div>' +
      '<div class="pc-description">' + YC.esc(p.description || '') + '</div>' +
      codeRow +
      '<div class="pc-date"><span class="ic">' + YC.icons.get('calendar') + '</span>' + YC.fmtDate(p.startDate) + ' &rarr; ' + YC.fmtDate(p.endDate) + '</div>' +
      '<div class="pc-meta">' + meta.join('') + '</div>' +
      '<div class="pc-actions">' +
        '<button type="button" class="btn btn-soft btn-sm" data-preview="' + p.id + '">Preview</button>' +
        '<button type="button" class="btn btn-soft btn-sm" data-edit="' + p.id + '">Edit</button>' +
        '<button type="button" class="btn btn-soft btn-sm" data-toggle="' + p.id + '">' + (p.active === false ? 'Enable' : 'Pause') + '</button>' +
        '<button type="button" class="btn btn-soft btn-sm" data-duplicate="' + p.id + '">Duplicate</button>' +
        '<button type="button" class="btn-icon danger" data-del="' + p.id + '" title="Delete"><span class="ic">' + YC.icons.get('trash') + '</span></button>' +
      '</div></div>';
  }

  function grid(){
    var list = svc.allWithStatus();
    if(state.q){
      var q = state.q.toLowerCase();
      list = list.filter(function(p){ return p.title.toLowerCase().indexOf(q) >= 0 || (p.promoCode || '').toLowerCase().indexOf(q) >= 0; });
    }
    if(state.status !== 'all') list = list.filter(function(p){ return p.status === state.status; });
    var host = YC.app.$('#promoGrid');
    var html = list.length ? list.map(pcard).join('')
      : '<div class="empty-state" style="padding:40px;grid-column:1/-1"><span class="empty-ico">' + YC.icons.get('promotions') + '</span><strong>No promotions match your filters.</strong></div>';
    host.innerHTML = '<div class="dash-grid-3">' + html + '</div>';
    wireGrid();
  }

  function wireGrid(){
    function delegate(el, selector, cb){
      var btn = el.closest(selector);
      if(btn) cb(btn);
    }
    YC.app.$$('#promoGrid [data-copy-code]').forEach(function(b){
      b.addEventListener('click', function(){ YC.copyText(b.getAttribute('data-copy-code')); });
    });
    YC.app.$$('#promoGrid [data-copy-code]').forEach(function(b){
      b.removeEventListener('click', b._c);
      b._c = null;
    });
    YC.app.$$('#promoGrid [data-preview]').forEach(function(b){
      b.addEventListener('click', function(){
        var p = svc.getById(b.getAttribute('data-preview'));
        if(p) YC.PromoPopup.preview(Object.assign({}, p, { status: svc.computeStatus(p) }));
      });
    });
    YC.app.$$('#promoGrid [data-edit]').forEach(function(b){
      b.addEventListener('click', function(){ editPromo(svc.getById(b.getAttribute('data-edit'))); });
    });
    YC.app.$$('#promoGrid [data-toggle]').forEach(function(b){
      b.addEventListener('click', function(){
        var p = svc.getById(b.getAttribute('data-toggle'));
        if(!p) return;
        svc.toggleActive(p.id);
        YC.toast.info(p.active === false ? 'Promotion enabled.' : 'Promotion paused.');
        grid(); stats();
      });
    });
    YC.app.$$('#promoGrid [data-duplicate]').forEach(function(b){
      b.addEventListener('click', function(){
        var p = svc.getById(b.getAttribute('data-duplicate'));
        if(!p) return;
        var copy = JSON.parse(JSON.stringify(p));
        delete copy.id;
        copy.title = p.title + ' (copy)';
        copy.featured = false;
        copy.active = false;
        svc.create(copy);
        YC.toast.success('Promotion duplicated.');
        grid(); stats();
      });
    });
    YC.app.$$('#promoGrid [data-del]').forEach(function(b){
      b.addEventListener('click', function(){
        var id = b.getAttribute('data-del');
        YC.app.confirm('Delete this promotion?', function(){
          svc.remove(id);
          YC.toast.success('Promotion deleted.');
          grid(); stats();
        });
      });
    });
  }

  var btnNew = YC.app.$('#btnNewPromo');
  if(btnNew) btnNew.addEventListener('click', function(){ editPromo(null); });

  function editPromo(row){
    var editing = !!row;
    var v = function(k){ return editing && row[k] != null ? row[k] : ''; };
    YC.app.openForm({
      title: editing ? 'Edit promotion' : 'New promotion',
      eyebrow: 'Promotions',
      size: 'lg',
      fields: [
        { t: 'text', name: 'title', label: 'Title', value: v('title'), required: true },
        { t: 'select', name: 'promoType', label: 'Promotion type', value: v('promoType') || 'code', required: true,
          options: [
            { value: 'code', label: 'Coupon code — visitor copies a code' },
            { value: 'discount', label: 'Direct discount — no code needed' }
          ] },
        { t: 'select', name: 'serviceId', label: 'Apply to service', value: v('serviceId') || 'all', required: true,
          options: [{ value: 'all', label: 'All services' }].concat(YC.data.services.map(function(s){ return { value: s.id, label: s.short }; })) },
        { t: 'text', name: 'servicesLabel', label: 'Popup service line (optional)', value: v('servicesLabel'),
          placeholder: 'e.g. Editing & Templates' },
        { t: 'text', name: 'destPage', label: 'Offer button link (optional)', value: v('destPage'),
          placeholder: 'templates.html or index.html#book' },
        { t: 'area', name: 'description', label: 'Description', value: v('description'), rows: 2, required: true },
        { t: 'select', name: 'discountType', label: 'Discount type', value: v('discountType') || 'percentage',
          options: ['percentage', 'fixed'] },
        { t: 'text', name: 'discountValue', label: 'Discount value', value: v('discountValue') || 10, type: 'number', min: 1 },
        { t: 'text', name: 'promoCode', label: 'Promo code (coupon-type promos)', value: v('promoCode') },
        { t: 'text', name: 'startDate', label: 'Start date', value: v('startDate'), type: 'date', required: true },
        { t: 'text', name: 'startTime', label: 'Start time', value: v('startTime') || '09:00', type: 'time' },
        { t: 'text', name: 'endDate', label: 'End date', value: v('endDate'), type: 'date', required: true },
        { t: 'text', name: 'endTime', label: 'End time', value: v('endTime') || '23:59', type: 'time' },
        { t: 'sw', name: 'popupEnabled', label: 'Show as popup', value: v('popupEnabled') },
        { t: 'sw', name: 'countdownEnabled', label: 'Countdown in popup', value: v('countdownEnabled') },
        { t: 'sw', name: 'showOnce', label: 'Show only once per visitor', value: v('showOnce') },
        { t: 'sw', name: 'showEveryVisit', label: 'Show on every visit', value: v('showEveryVisit') },
        { t: 'sw', name: 'closeButton', label: 'Show close button', value: v('closeButton') !== false },
        { t: 'text', name: 'popupDelay', label: 'Popup delay (seconds)', value: v('popupDelay') || 5, type: 'number', min: 0 },
        { t: 'select', name: 'popupPosition', label: 'Popup position', value: v('popupPosition') || 'center',
          options: ['center', 'bottom-right', 'bottom-center'] },
        { t: 'text', name: 'ctaText', label: 'CTA button text', value: v('ctaText') || 'Get This Offer', required: true },
        { t: 'sw', name: 'featured', label: 'Featured', value: v('featured') },
        { t: 'sw', name: 'active', label: 'Active', value: editing ? v('active') : true }
      ],
      onSubmit: function(data, form){
        var missing = YC.app.required(data, ['title', 'description', 'startDate', 'endDate', 'ctaText']);
        if(data.promoType !== 'discount'){
          missing = missing.concat(YC.app.required(data, ['promoCode']));
        }
        if(missing.length){ YC.app.markErrors(form, missing); return; }
        if(data.endDate < data.startDate){
          YC.app.markErrors(form, ['endDate']);
          YC.toast.error('End date must be after the start date.');
          return;
        }
        if(editing){
          svc.update(row.id, data);
          YC.toast.success('Promotion updated.');
        }else{
          svc.create(data);
          YC.toast.success('Promotion created.');
        }
        YC.modal.close(); grid(); stats();
      }
    });
  }

  YC.app.attachSearch('#searchPromos', function(q){ state.q = q; grid(); });
  YC.app.attachSelect('#filterPromoStatus', function(v){ state.status = v; grid(); });
  grid();
  if(location.search.indexOf('new=1') >= 0) editPromo(null);
};

/* ============================================================
   CATEGORIES
   ============================================================ */
YC.app.pages_categories = function(){
  var svc = YC.app.catsService();
  var TYPES = [
    { key: 'ai-prompts', label: 'AI Prompts' },
    { key: 'templates', label: 'Templates' },
    { key: 'video-templates', label: 'Video Templates' },
    { key: 'thumbnail-templates', label: 'Thumbnail Templates' },
    { key: 'files', label: 'Files' },
    { key: 'services', label: 'Services' }
  ];

  function countFor(key, name){
    var map = {
      'ai-prompts': function(){ return YC.services.prompts.all().filter(function(p){ return p.category === name; }).length; },
      'templates': function(){ return YC.services.templates.all().filter(function(t){ return t.category === name; }).length; },
      'video-templates': function(){ return YC.services.videoTemplates.all().filter(function(t){ return t.category === name; }).length; },
      'thumbnail-templates': function(){ return YC.services.thumbnailTemplates.all().filter(function(t){ return t.category === name; }).length; },
      'files': function(){ return YC.services.files ? YC.services.files.all().filter(function(f){ return f.category === name; }).length : 0; },
      'services': function(){ return YC.data.services.filter(function(s){ return s.id === name.toLowerCase().replace(/\s+/g, '-'); }).length || (YC.data.getService(name.replace(/\s+/g, '-') || name) ? 1 : 0); }
    };
    return (map[key] || function(){ return 0; })();
  }

  function slugify(name){
    return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  function tabs(){
    var host = YC.app.$('#catTabs');
    if(!host) return;
    host.innerHTML = TYPES.map(function(t){
      return '<button type="button" class="tab' + (t.key === active ? ' active' : '') + '" data-cat="' + t.key + '">' + t.label + '</button>';
    }).join('');
    host.querySelectorAll('.tab').forEach(function(b){
      b.addEventListener('click', function(){
        active = b.getAttribute('data-cat');
        tabs(); list();
      });
    });
  }

  function list(){
    var host = YC.app.$('#catList');
    if(!host) return;
    var rows = svc.all().filter(function(c){ return c.type === active; });
    if(!rows.length){
      host.innerHTML = '<div class="empty-state" style="padding:40px"><strong>No categories here yet.</strong></div>';
      return;
    }
    host.innerHTML = '<div class="table-scroll"><table class="tbl"><thead><tr>' +
      '<th>Category</th><th>Slug</th><th>Items</th><th>Enabled</th><th></th></tr></thead><tbody>' +
      rows.map(function(c){
        return '<tr data-id="' + c.id + '"><td class="cell-main">' + YC.esc(c.name) + '</td>' +
          '<td class="cell-monster">' + YC.esc(c.slug) + '</td>' +
          '<td>' + countFor(active, c.name) + '</td>' +
          '<td><label class="switch"><input type="checkbox" data-toggle-cat="' + c.id + '"' + (c.enabled ? ' checked' : '') + '><span class="track"></span></label></td>' +
          '<td><button type="button" class="btn-icon danger" data-del-cat="' + c.id + '" title="Delete"><span class="ic">' + YC.icons.get('trash') + '</span></button></td>' +
          '</tr>';
      }).join('') + '</tbody></table></div>';

    host.querySelectorAll('[data-toggle-cat]').forEach(function(inp){
      inp.addEventListener('change', function(){
        svc.update(inp.getAttribute('data-toggle-cat'), { enabled: inp.checked });
        YC.toast.info('Category ' + (inp.checked ? 'enabled.' : 'disabled.'));
        list();
      });
    });
    host.querySelectorAll('[data-del-cat]').forEach(function(b){
      b.addEventListener('click', function(){
        var id = b.getAttribute('data-del-cat');
        YC.app.confirm('Delete this category? Items will keep their category label.', function(){
          svc.remove(id);
          YC.toast.success('Category deleted.');
          list();
        });
      });
    });
  }

  var addBtn = YC.app.$('#btnAddCat');
  var addInput = YC.app.$('#newCatName');
  if(addBtn){
    addBtn.addEventListener('click', function(){
      var name = (addInput.value || '').trim();
      if(!name){ YC.toast.error('Enter a category name.'); return; }
      var slug = slugify(name);
      var existing = svc.all().find(function(c){ return c.type === active && c.slug === slug; });
      if(existing){ YC.toast.error('A category with that name already exists.'); return; }
      svc.create({ name: name, slug: slug, type: active, enabled: true });
      addInput.value = '';
      YC.toast.success('Category added.');
      list();
    });
    addInput.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); addBtn.click(); } });
  }

  var active = TYPES[0].key;
  tabs(); list();
};

/* ============================================================
   ANALYTICS
   ============================================================ */
YC.app.pages_analytics = function(){
  var bookings = YC.services.bookings.all();
  var statuses = { pending: 0, confirmed: 0, cancelled: 0, completed: 0 };
  bookings.forEach(function(b){ statuses[b.status] = (statuses[b.status] || 0) + 1; });
  var totalViews = YC.services.prompts.all().reduce(function(s, p){ return s + (p.views || 0); }, 0);
  var totalDl = ['templates', 'videoTemplates', 'thumbnailTemplates'].reduce(function(s, k){
    return s + YC.services[k].all().reduce(function(a, t){ return a + (t.downloads || 0); }, 0);
  }, 0);

  YC.app.renderStats([
    { icon: 'bookings', num: bookings.length, label: 'Total bookings' },
    { icon: 'check', num: statuses.confirmed, label: 'Confirmed', delta: Math.round((statuses.confirmed / (bookings.length || 1)) * 100) + '% of bookings', dir: 'up' },
    { icon: 'eye', num: YC.abbrNum(totalViews), label: 'Prompt views' },
    { icon: 'download', num: YC.abbrNum(totalDl), label: 'Template downloads' }
  ]);

  var area = YC.app.$('#chartMonthly');
  if(area){
    var months = [];
    var now = new Date();
    for(var i = 5; i >= 0; i--){
      var first = new Date(now.getFullYear(), now.getMonth() - i, 1);
      var last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
      var li = YC.app.iso(last), fi = YC.app.iso(first);
      var c = bookings.filter(function(b){ return b.date >= fi && b.date <= li; }).length;
      var label = first.toLocaleString('en', { month: 'short' });
      months.push({ label: label, value: c });
    }
    YC.charts.area(area, months);
  }

  var bars = YC.app.$('#chartByService');
  if(bars){
    var byService = YC.data.services.map(function(s){
      return { label: s.short, value: bookings.filter(function(b){ return b.serviceId === s.id; }).length };
    });
    YC.charts.bar(bars, byService);
  }

  var donut = YC.app.$('#chartStatusDonut');
  if(donut){
    YC.charts.donut(donut, [
      { label: 'Pending', value: statuses.pending },
      { label: 'Confirmed', value: statuses.confirmed },
      { label: 'Completed', value: statuses.completed },
      { label: 'Cancelled', value: statuses.cancelled || 1 }
    ], { label: 'Bookings' });
  }

  var r1 = YC.app.$('#rankPromptsAnalytics');
  if(r1){
    YC.charts.hbar(r1, YC.services.prompts.popular(5).map(function(p, i){
      return { rank: i + 1, label: p.title, value: p.views || 0 };
    }));
  }
  var r2 = YC.app.$('#rankTemplatesAnalytics');
  if(r2){
    var tops = ['templates', 'videoTemplates', 'thumbnailTemplates'].reduce(function(a, k){
      return a.concat(YC.services[k].all());
    }, []).filter(function(t){ return t.published; })
      .sort(function(a, b){ return (b.downloads || 0) - (a.downloads || 0); })
      .slice(0, 5);
    YC.charts.hbar(r2, tops.map(function(t, i){
      return { rank: i + 1, label: t.title, value: t.downloads || 0 };
    }));
  }
};

/* ============================================================
   SETTINGS
   ============================================================ */
YC.app.pages_settings = function(){
  var current = YC.settings.all();
  var form = YC.app.$('#settingsForm');
  if(!form) return;

  function socialFields(){
    var socials = ['youtube', 'instagram', 'tiktok', 'behance', 'linkedin', 'facebook', 'pinterest', 'x', 'whatsapp'];
    return socials.map(function(s){
      return { t: 'text', name: 'soc_' + s, label: s, value: current.social[s] || '' };
    });
  }

  function render(){
    var groups = [
      { title: 'Branding', fields: [
        { t: 'text', name: 'websiteName', label: 'Website name', value: current.websiteName },
        { t: 'text', name: 'tagline', label: 'Tagline', value: current.tagline },
        { t: 'text', name: 'logoDark', label: 'Logo (dark theme)', value: current.logoDark },
        { t: 'text', name: 'logoLight', label: 'Logo (light theme)', value: current.logoLight },
        { t: 'text', name: 'favicon', label: 'Favicon path', value: current.favicon }
      ]},
      { title: 'Theme', fields: [
        { t: 'select', name: 'defaultTheme', label: 'Default theme', value: current.defaultTheme, options: ['dark', 'light'] },
        { t: 'sw', name: 'enableThemeToggle', label: 'Allow visitors to switch theme', value: current.enableThemeToggle }
      ]},
      { title: 'Contact', fields: [
        { t: 'text', name: 'contactEmail', label: 'Contact email', value: current.contactEmail, type: 'email' },
        { t: 'text', name: 'phone', label: 'Phone', value: current.phone }
      ]},
      { title: 'Announcement', fields: [
        { t: 'area', name: 'announcement', label: 'Site announcement', value: current.announcement, rows: 2 }
      ]},
      { title: 'Bookings', fields: [
        { t: 'sw', name: 'bookingEnabled', label: 'Bookings enabled', value: current.bookingEnabled },
        { t: 'sw', name: 'confirmRequired', label: 'Require admin confirmation', value: current.confirmRequired },
        { t: 'text', name: 'bookingMinPeople', label: 'Minimum people', value: current.bookingMinPeople, type: 'number', min: 1 },
        { t: 'text', name: 'bookingMaxPeople', label: 'Maximum people', value: current.bookingMaxPeople, type: 'number', min: 1 },
        { t: 'text', name: 'bookingBufferHours', label: 'Buffer between bookings (hours)', value: current.bookingBufferHours, type: 'number', min: 0 }
      ]},
      { title: 'Content library', fields: [
        { t: 'sw', name: 'contentPromptsEnabled', label: 'AI prompts visible', value: current.contentPromptsEnabled },
        { t: 'sw', name: 'contentTemplatesEnabled', label: 'Templates visible', value: current.contentTemplatesEnabled },
        { t: 'text', name: 'itemsPerPage', label: 'Items per page', value: current.itemsPerPage, type: 'number', min: 3 },
        { t: 'select', name: 'downloadMethod', label: 'Default download behavior', value: current.downloadMethod, options: ['direct', 'email-confirm', 'link'] }
      ]},
      { title: 'Promotions', fields: [
        { t: 'sw', name: 'promoPopupsEnabled', label: 'Promo popups enabled site-wide', value: current.promoPopupsEnabled },
        { t: 'text', name: 'promoDefaultDelay', label: 'Default popup delay (seconds)', value: current.promoDefaultDelay, type: 'number', min: 0 },
        { t: 'select', name: 'promoDefaultPosition', label: 'Default popup position', value: current.promoDefaultPosition, options: ['center', 'bottom-right', 'bottom-center'] },
        { t: 'sw', name: 'promoDefaultShowOnce', label: 'Default to show-once behavior', value: current.promoDefaultShowOnce }
      ]},
      { title: 'Social links', fields: socialFields() }
    ];

    form.innerHTML = groups.map(function(g){
      return '<div class="card card-pad settings-group"><h3 class="card-title">' + g.title + '</h3>' +
        '<div class="settings-fields">' + g.fields.map(function(f){ return YC.app.fld[f.t](f); }).join('') + '</div></div>';
    }).join('');
  }
  render();

  var save = YC.app.$('#btnSaveSettings');
  if(save){
    save.addEventListener('click', function(){
      var data = YC.app.parseForm(form);
      var social = {};
      ['youtube', 'instagram', 'tiktok', 'behance', 'linkedin', 'facebook', 'pinterest', 'x', 'whatsapp'].forEach(function(s){
        social[s] = data['soc_' + s] || '';
        delete data['soc_' + s];
      });
      data.social = social;
      data.bookingMinPeople = Number(data.bookingMinPeople) || 1;
      data.bookingMaxPeople = Number(data.bookingMaxPeople) || 10;
      data.bookingBufferHours = Number(data.bookingBufferHours) || 1;
      data.itemsPerPage = Number(data.itemsPerPage) || 9;
      data.promoDefaultDelay = Number(data.promoDefaultDelay) || 5;
      YC.settings.save(data);
      current = YC.settings.all();
      YC.toast.success('Settings saved.');
      render();
    });
  }
  var reset = YC.app.$('#btnResetSettings');
  if(reset){
    reset.addEventListener('click', function(){
      YC.app.confirm('Reset all settings to defaults?', function(){
        YC.Store.remove('yc:settings');
        YC.toast.success('Settings reset.');
        setTimeout(function(){ location.reload(); }, 500);
      }, 'Reset');
    });
  }
};

/* ============================================================
   USERS (admin accounts)
   ============================================================ */
YC.app.pages_users = function(){
  var svc = YC.services.admins;

  function activeCount(){
    return svc.all().filter(function(a){ return String(a.status) !== 'disabled'; }).length;
  }
  function isSelf(row){
    var u = YC.auth.user();
    return !!u && String(u.email).toLowerCase() === String(row.email).toLowerCase();
  }

  function stats(){
    var all = svc.all();
    YC.app.renderStats([
      { icon: 'users', num: all.length, label: 'Total users' },
      { icon: 'check', num: activeCount(), label: 'Active' },
      { icon: 'close', num: all.filter(function(a){ return String(a.status) === 'disabled'; }).length, label: 'Disabled' },
      { icon: 'star', num: all.filter(function(a){ return a.role === 'owner'; }).length, label: 'Owners' }
    ]);
  }
  stats();

  var table = YC.app.Table({
    host: '#usersTable',
    empty: 'No users match your filters.',
    keys: ['name', 'email', 'role'],
    sortKey: 'createdAt',
    data: function(){ return svc.all(); },
    columns: [
      { title: 'Admin', key: 'name',
        render: function(r){
          return '<span style="display:inline-flex;align-items:center;gap:10px"><span class="list-avatar">' + YC.avatar(r.name) + '</span>' +
            '<span>' + YC.esc(r.name) + '<div class="cell-sub">' + YC.esc(r.email) + '</div></span></span>';
        } },
      { title: 'Role', key: 'role',
        render: function(r){
          return '<span class="pill ' + (r.role === 'owner' ? 'active' : 'neutral') + '">' + YC.esc(r.role) + '</span>';
        } },
      { title: 'Status', key: 'status',
        render: function(r){ return YC.pill(r.status); } },
      { title: 'Added', key: 'createdAt',
        render: function(r){ return YC.fmtDate(r.createdAt); } },
      { title: '', key: '__a',
        render: function(r){
          var toggle = String(r.status) === 'active' ? 'disable' : 'enable';
          var tIcon = String(r.status) === 'active' ? 'eyeOff' : 'eye';
          return '<span class="row-actions">' +
            YC.app.actBtn('edit', 'edit', 'Edit') +
            YC.app.actBtn(toggle, tIcon, String(r.status) === 'active' ? 'Disable' : 'Enable') +
            YC.app.actBtn('delete', 'trash', 'Delete') + '</span>';
        } }
    ],
    onAction: function(act, id, row){
      if(act === 'edit'){ editUser(row); return; }
      if(act === 'enable'){
        svc.update(id, { status: 'active' });
        YC.toast.success(row.name + ' enabled.');
        table.refresh(); stats(); return;
      }
      if(act === 'disable'){
        if(isSelf(row)){ YC.toast.error('You cannot disable your own account.'); return; }
        if(activeCount() <= 1){ YC.toast.error('You cannot disable the last active user.'); return; }
        svc.update(id, { status: 'disabled' });
        YC.toast.info(row.name + ' disabled.');
        table.refresh(); stats(); return;
      }
      if(act === 'delete'){
        if(isSelf(row)){ YC.toast.error('You cannot delete your own account.'); return; }
        if(activeCount() - (String(row.status) === 'disabled' ? 0 : 1) < 1){
          YC.toast.error('You cannot delete the last active user.');
          return;
        }
        YC.app.confirm('Remove ' + row.name + '? They will no longer be able to sign in.', function(){
          svc.remove(id);
          YC.toast.success('User removed.');
          table.refresh(); stats();
        });
      }
    }
  });

  var btnNew = YC.app.$('#btnNewUser');
  if(btnNew) btnNew.addEventListener('click', function(){ editUser(null); });

  function editUser(row){
    var editing = !!row;
    var v = function(k){ return editing && row[k] != null ? row[k] : ''; };
    YC.app.openForm({
      title: editing ? 'Edit user' : 'Add user',
      eyebrow: 'Users',
      fields: [
        { t: 'text', name: 'name', label: 'Full name', value: v('name'), required: true },
        { t: 'text', name: 'email', label: 'Email address', value: v('email'), type: 'email', required: true },
        { t: 'text', name: 'password', label: editing ? 'Password (blank to keep current)' : 'Password',
          value: '', type: 'password', placeholder: editing ? '••••••••' : 'Set a password', required: !editing },
        { t: 'select', name: 'role', label: 'Role', value: v('role') || 'admin', options: ['admin', 'owner'] },
        { t: 'select', name: 'status', label: 'Status', value: v('status') || 'active', options: ['active', 'disabled'] }
      ],
      onSubmit: function(data, form){
        var missing = YC.app.required(data, ['name', 'email']);
        if(!editing) missing = missing.concat(YC.app.required(data, ['password']));
        if(missing.length){ YC.app.markErrors(form, missing); return; }
        var dup = svc.byEmail(data.email);
        if(dup && (!editing || String(dup.id) !== String(row.id))){
          YC.toast.error('A user with that email already exists.');
          return;
        }
        if(editing){
          if(isSelf(row) && data.status === 'disabled'){
            YC.toast.error('You cannot disable your own account.');
            return;
          }
          var patch = { name: data.name, email: data.email, role: data.role, status: data.status };
          if(String(data.password || '').trim() !== '') patch.password = data.password;
          svc.update(row.id, patch);
          YC.toast.success('User updated.');
        }else{
          svc.create(data);
          YC.toast.success('User added — they can now sign in.');
        }
        YC.modal.close(); table.refresh(); stats();
      }
    });
  }

  YC.app.attachSearch('#searchUsers', function(q){ table.setQ(q); });
  if(location.search.indexOf('new=1') >= 0) editUser(null);
};

/* ============================================================
   DISPATCH
   ============================================================ */
document.addEventListener('DOMContentLoaded', function(){
  var page = document.body ? document.body.getAttribute('data-page') : null;
  var map = {
    login: YC.app.pages_login,
    dashboard: YC.app.pages_dashboard,
    bookings: YC.app.pages_bookings,
    customers: YC.app.pages_customers,
    content: YC.app.pages_content,
    prompts: YC.app.pages_prompts,
    templates: YC.app.pages_templates,
    'video-templates': YC.app.pages_videoTemplates,
    'thumbnail-templates': YC.app.pages_thumbnailTemplates,
    files: YC.app.pages_files,
    promotions: YC.app.pages_promotions,
    categories: YC.app.pages_categories,
    analytics: YC.app.pages_analytics,
    settings: YC.app.pages_settings,
    users: YC.app.pages_users
  };
  if(page && typeof map[page] === 'function'){
    try{
      map[page]();
    }catch(err){
      if(window.console) console.error('Page controller error [' + page + ']:', err);
      YC.toast.error('Something went wrong loading this page.');
    }
  }
});