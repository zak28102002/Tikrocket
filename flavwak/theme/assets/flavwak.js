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

  // Vertical videos: muted loop while on screen, tap for sound (one video with sound at a time).
  var frames = [].slice.call(document.querySelectorAll('.fw-videos__frame'));
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var vidState = function (frame) {
    var v = frame.querySelector('[data-fw-video]');
    var snd = frame.querySelector('[data-fw-video-sound]');
    var pause = frame.querySelector('[data-fw-video-pause]');
    frame.classList.toggle('is-unmuted', !v.muted);
    frame.classList.toggle('is-paused', v.paused);
    snd.setAttribute('aria-pressed', String(!v.muted));
    snd.setAttribute('aria-label', frame.classList.contains('no-audio') ? (v.paused ? 'Play video' : 'Pause video') : (v.muted ? 'Turn sound on' : 'Turn sound off'));
    pause.setAttribute('aria-label', v.paused ? 'Play video' : 'Pause video');
  };
  var play = function (v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); };
  // Hide the sound control for clips that have no audio track.
  var checkAudio = function (frame, v) {
    var known = typeof v.mozHasAudio === 'boolean' || typeof v.webkitAudioDecodedByteCount === 'number' || (v.audioTracks && typeof v.audioTracks.length === 'number');
    if (!known) return;
    var has = v.mozHasAudio || v.webkitAudioDecodedByteCount > 0 || (v.audioTracks && v.audioTracks.length > 0);
    frame.classList.toggle('no-audio', !has);
    vidState(frame);
  };
  frames.forEach(function (frame) {
    var v = frame.querySelector('[data-fw-video]');
    if (!v) return;
    var section = frame.closest('[data-fw-videos-autoplay]');
    var auto = !reduce && (!section || section.getAttribute('data-fw-videos-autoplay') !== 'false');
    v.muted = true;
    v.__fwAuto = auto;
    ['play', 'pause', 'volumechange'].forEach(function (ev) { v.addEventListener(ev, function () { vidState(frame); }); });
    v.addEventListener('playing', function () { setTimeout(function () { checkAudio(frame, v); }, 900); }, { once: true });
    frame.querySelector('[data-fw-video-sound]').addEventListener('click', function () {
      if (frame.classList.contains('no-audio')) { if (v.paused) play(v); else v.pause(); return; }
      if (v.muted) {
        frames.forEach(function (f) { var o = f.querySelector('[data-fw-video]'); if (o && o !== v) o.muted = true; });
        if (!v.__fwHeard) { v.__fwHeard = true; try { v.currentTime = 0; } catch (e) {} }
        v.muted = false;
        play(v);
      } else {
        v.muted = true;
      }
    });
    frame.querySelector('[data-fw-video-pause]').addEventListener('click', function () {
      if (v.paused) { v.__fwUserPaused = false; play(v); } else { v.__fwUserPaused = true; v.pause(); }
    });
    vidState(frame);
  });
  var vids = frames.map(function (f) { return f.querySelector('[data-fw-video]'); }).filter(Boolean);
  if (vids.length && 'IntersectionObserver' in window) {
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) {
          if (v.__fwAuto && !v.__fwUserPaused) play(v);
        } else if (!v.paused) {
          v.pause();
          v.muted = true;
        }
      });
    }, { threshold: 0.35 });
    vids.forEach(function (v) { vio.observe(v); });
  }
})();
