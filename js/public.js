/* ============================================================
   YallahClick — Public page bootstrap (library pages)
   Builds the site header/footer, wires theme toggle + mobile
   drawer, then reveals content and (optionally) promo popups.
   ============================================================ */
window.YC = window.YC || {};

document.addEventListener('DOMContentLoaded', function(){
  if(document.body.hasAttribute('data-public-page')){

    var active = document.body.getAttribute('data-active-link') || null;
    YC.buildChrome({ active: active });

    if(YC.ambience) YC.ambience.init();

    /* command palette (Cmd/Ctrl+K) + cross-page transitions */
    if(YC.palette) YC.palette.init();
    document.addEventListener('click', function(e){
      var a = e.target.closest ? e.target.closest('a[href]') : null;
      if(!a) return;
      var href = a.getAttribute('href');
      if(!href || href.charAt(0) === '#' || /^(https?:)?\/\//.test(href) || href.indexOf('mailto:') === 0) return;
      if(a.target && a.target === '_blank') return;
      e.preventDefault();
      YC.transition.go(href);
    });

    YC.initReveal();
  }
});