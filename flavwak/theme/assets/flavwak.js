(function () {
  if (window.__fwInit) return; window.__fwInit = true;
  document.documentElement.classList.add('fw-js');
  // Scroll reveal
  var els = document.querySelectorAll('.fw-reveal');
  if ('IntersectionObserver' in window && els.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    els.forEach(function (el) { io.observe(el); });
  } else {
    els.forEach(function (el) { el.classList.add('is-in'); });
  }

  // Sticky mobile CTA: show after hero, hide near footer or when a buy box is visible
  var sticky = document.querySelector('[data-fw-sticky]');
  if (sticky && 'IntersectionObserver' in window) {
    var hero = document.querySelector('[data-fw-hero]');
    var hide = document.querySelectorAll('[data-fw-hide-sticky], footer');
    var heroGone = !hero, hidden = 0;
    var update = function () { sticky.classList.toggle('is-visible', heroGone && hidden === 0); };
    if (hero) {
      new IntersectionObserver(function (en) { heroGone = !en[0].isIntersecting; update(); }).observe(hero);
    }
    var seen = new Map();
    var hio = new IntersectionObserver(function (en) {
      en.forEach(function (e) { seen.set(e.target, e.isIntersecting); });
      hidden = 0; seen.forEach(function (v) { if (v) hidden++; });
      update();
    });
    hide.forEach(function (el) { hio.observe(el); });
    update();
  }

  // Vertical videos: one plays at a time, and playback pauses once scrolled away
  document.addEventListener('play', function (e) {
    if (!e.target.matches || !e.target.matches('[data-fw-video]')) return;
    document.querySelectorAll('[data-fw-video]').forEach(function (v) { if (v !== e.target && !v.paused) v.pause(); });
  }, true);
  var vids = document.querySelectorAll('[data-fw-video]');
  if (vids.length && 'IntersectionObserver' in window) {
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (!e.isIntersecting && !e.target.paused) e.target.pause(); });
    }, { threshold: 0.2 });
    vids.forEach(function (v) { vio.observe(v); });
  }
})();
