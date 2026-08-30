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
    YC.initReveal();
  }
});