/* ============================================================
   YallahClick - Promo popup engine
   Public sites call YC.PromoPopup.init(); admin calls
   YC.PromoPopup.preview(promo) to preview a card.
   localStorage holds ONLY display prefs (dismissed / last seen).
   Positions: center (modal), bottom-right / bottom-center place the
   same clean card in a corner or bottom bar area.
   repeatEvery re-opens the popup on an interval (seconds) while
   repeat is enabled; showEveryVisit keeps it appearing on every
   refresh.
   ============================================================ */
window.YC = window.YC || {};
YC.PromoPopup = (function(){
  var PREFS_LAST = 'yc-popup-last';
  var repeatTimer = null;
  var autoTimer = null;

  function clearT(){
    clearTimeout(repeatTimer); clearTimeout(autoTimer);
    repeatTimer = autoTimer = null;
  }

  /* ---------- markup helpers ---------- */
  function div(className){
    var e = document.createElement('div');
    e.className = className;
    return e;
  }

  function span(t, className){
    var e = document.createElement('span');
    e.className = className;
    e.textContent = t;
    return e;
  }

  function discountLabel(p){
    if(p.discountType === 'percentage'){
      return p.discountValue ? p.discountValue + '% OFF' : 'Special Offer';
    }
    if(p.discountType === 'fixed'){
      return '$' + p.discountValue + ' OFF';
    }
    return p.discountLabel || 'Special Offer';
  }

  function serviceName(p){
    if(p.servicesLabel) return p.servicesLabel;
    if(!p.serviceId || p.serviceId === 'all') return 'All Services';
    return YC.data.getServiceName(p.serviceId);
  }

  function ctaDest(p){
    var id = p.serviceId;
    if(p.destPage){
      var base = p.destPage, hash = '';
      var qi = base.indexOf('#');
      if(qi >= 0){ hash = base.slice(qi); base = base.slice(0, qi); }
      if(id && id !== 'all') return base + '?svc=' + encodeURIComponent(id) + hash;
      return base + hash;
    }
    if(id && id !== 'all'){
      var pg = YC.data.getService(id);
      if(pg){
        var b2 = pg.page || 'index.html', h2 = '';
        var qi2 = b2.indexOf('#');
        if(qi2 >= 0){ h2 = b2.slice(qi2); b2 = b2.slice(0, qi2); }
        return b2 + '?svc=' + encodeURIComponent(id) + h2;
      }
    }
    return 'index.html?svc=' + encodeURIComponent(id || 'all') + '#book';
  }

  function codeBox(p){
    var box = div('promo-code-box');
    if(p.promoType === 'discount'){
      box.className += ' auto';
      box.appendChild(span('No code needed', 'promo-code-label'));
      box.appendChild(span('Applied automatically', 'promo-code'));
    }else{
      box.appendChild(span('Use code', 'promo-code-label'));
      var codeEl = span(p.promoCode || '', 'promo-code');
      var copyBtn = document.createElement('button');
      copyBtn.className = 'promo-copy';
      copyBtn.innerHTML = '<span class="ic">' + YC.icons.get('copy') + '</span>Copy';
      copyBtn.addEventListener('click', function(){ YC.copyText(p.promoCode || ''); });
      box.appendChild(codeEl);
      box.appendChild(copyBtn);
    }
    return box;
  }

  function ctaLink(p, className){
    var cta = document.createElement('a');
    cta.className = className;
    cta.href = ctaDest(p);
    cta.textContent = p.ctaText || 'Get This Offer';
    return cta;
  }

  /* ---------- clean single-form card ---------- */
  function buildCard(p){
    var card = div('promo-popup-card' + (p.image ? ' has-image' : ''));
    var inner = div('promo-popup-inner');

    /* optional banner image */
    var imgWrap = null;
    if(p.image){
      imgWrap = div('promo-banner');
      var img = document.createElement('img');
      img.src = p.image;
      img.alt = p.title || 'Promotion';
      img.addEventListener('error', function(){ imgWrap && imgWrap.remove(); });
      imgWrap.appendChild(img);
      inner.appendChild(imgWrap);
    }

    /* tag + service + discount */
    inner.appendChild(span(p.promoType === 'discount' ? 'Auto-applied discount' : 'Limited-time offer', 'promo-tag'));
    inner.appendChild(span(serviceName(p), 'promo-service'));
    inner.appendChild(span(discountLabel(p), 'promo-discount'));
    inner.appendChild(span(p.description || '', 'promo-desc'));

    /* code box or auto-applied note */
    inner.appendChild(codeBox(p));
    inner.appendChild(ctaLink(p, 'btn btn-primary promo-cta'));

    if(p.countdownEnabled && p.endDate) inner.appendChild(countdown(p));

    card.appendChild(inner);

    if(p.closeButton !== false){
      var close = document.createElement('button');
      close.className = 'promo-close';
      close.setAttribute('aria-label', 'Close');
      close.innerHTML = '&times;';
      close.addEventListener('click', function(){ dismiss(); });
      card.appendChild(close);
    }
    return card;
  }

  function countdown(p){
    var box = div('promo-countdown');
    box.appendChild(span('Offer ends in', 'cd-title'));
    var cells = { d: null, h: null, m: null, s: null };
    ['d', 'h', 'm', 's'].forEach(function(k, i){
      if(i) box.appendChild(span(':', 'cd-sep'));
      var c = span('00', 'cd-cell');
      c.dataset.cell = k;
      cells[k] = c;
      box.appendChild(c);
    });
    var end = new Date(p.endDate + 'T' + (p.endTime || '23:59'));
    var pad = function(n){ return (n < 10 ? '0' : '') + n; };
    function tick(){
      var diff = end.getTime() - Date.now();
      if(diff <= 0){
        cells.d.textContent = cells.h.textContent = cells.m.textContent = cells.s.textContent = '00';
        return;
      }
      cells.d.textContent = pad(Math.floor(diff / 86400000));
      cells.h.textContent = pad(Math.floor(diff / 3600000) % 24);
      cells.m.textContent = pad(Math.floor(diff / 60000) % 60);
      cells.s.textContent = pad(Math.floor(diff / 1000) % 60);
    }
    tick();
    setInterval(tick, 1000);
    return box;
  }

  /* ---------- show / hide ---------- */
  var overlay = null;
  var onDismiss = null;

  function dismiss(){
    var ovl = overlay;
    if(!ovl) return;
    overlay = null;
    ovl.classList.remove('show');
    setTimeout((function(el){ return function(){ if(el && el.parentNode) el.remove(); }; })(ovl), 380);
    if(onDismiss){ var cb = onDismiss; onDismiss = null; cb(); }
  }

  function fire(overlayEl){
    overlay = overlayEl;
    requestAnimationFrame(function(){ requestAnimationFrame(function(){
      overlayEl.classList.add('show');
    }); });
  }

  function showCard(p, onClose){
    if(document.querySelector('.promo-popup-overlay')) return;
    var ov = div('promo-popup-overlay');
    if(p.popupPosition && p.popupPosition !== 'center') ov.classList.add('position-' + p.popupPosition);
    ov.appendChild(buildCard(p));
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e){ if(e.target === ov) dismiss(); });
    onDismiss = onClose || null;
    setTimeout(function(){ fire(ov); }, 60);
    return ov;
  }

  function holdMs(p){
    if(!(p.repeatEvery > 0)) return 0;
    return Math.min(9000, Math.max(4000, p.repeatEvery * 1000 * 0.8));
  }

  /* one show + (optional) auto-close + schedule next repeat */
  function cycle(p){
    clearT();
    if(document.querySelector('.promo-popup-overlay')) return;
    if(p.popupEnabled === false || p.active === false) return;
    showCard(p, null);
    markShown(p.id);
    var hold = holdMs(p);
    if(hold > 0) autoTimer = setTimeout(function(){ dismiss(); }, hold);
    if(p.repeatEvery > 0){
      repeatTimer = setTimeout(function(){ cycle(p); }, p.repeatEvery * 1000);
    }
  }

  /* ---------- prefs ---------- */
  function lastShown(){
    var raw = localStorage.getItem(PREFS_LAST);
    try{ return raw ? JSON.parse(raw) : {}; }catch(e){ return {}; }
  }
  function markShown(promoId){
    var now = Date.now();
    var prev = lastShown();
    prev[promoId] = now;
    localStorage.setItem(PREFS_LAST, JSON.stringify(prev));
    return now;
  }
  function shouldShow(p, fireTime){
    if(!p || !p.popupEnabled || p.serviceId === undefined) return false;
    if(p.showOnce){
      var seen = lastShown()[p.id];
      if(seen) return false;
    }
    if(p.showEveryVisit) return true;
    /* cooldown: same popup not shown twice within 6 hours */
    var last = lastShown()[p.id];
    if(last && (fireTime - last) < 6 * 3600 * 1000) return false;
    return true;
  }

  /* ---------- public init ---------- */
  function init(){
    if(!YC.settings || YC.settings.get('promoPopupsEnabled') === false) return;
    if(location.hash) return; // keep promo off deep anchors
    var p = null;
    if(YC.services && YC.services.promotions){
      p = YC.services.promotions.getActiveForPopup();
    }
    if(!p) return;
    if(!shouldShow(p, Date.now())) return;
    var delay = (typeof p.popupDelay === 'number' ? p.popupDelay : 5) * 1000;
    setTimeout(function(){ cycle(p); }, delay);
  }

  /* ---------- admin preview (no prefs, no delay) ---------- */
  function preview(p){
    showCard(p, function(){ onDismiss = null; });
  }

  function close(){
    clearT();
    dismiss();
  }

  return { init: init, preview: preview, close: close };
})();

/* ---------- auto boot on pages flagged data-promo-auto ----------
   Race hydrate() against a 6.5s cap so the popup ALWAYS appears on
   every refresh (cold starts never delay it indefinitely). */
(function(){
  function boot(){
    try{
      if(!document.body || !document.body.hasAttribute('data-promo-auto')) return;
      var readyP = (window.YC && YC.backend && YC.backend.ready) ? YC.backend.ready : Promise.resolve(true);
      Promise.race([readyP, new Promise(function(res){ setTimeout(res, 6500); })])
        .then(function(){ YC.PromoPopup.init(); })
        .catch(function(){ YC.PromoPopup.init(); });
    }catch(_e){}
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  }else{
    boot();
  }
})();