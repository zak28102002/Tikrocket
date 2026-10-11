/*
 * Flavwak Spin to win — runs entirely in the theme.
 *
 * Prizes are fixed Shopify discount codes (no expiry, one use per customer), set in
 * the theme editor. The outcome is drawn here with the browser's cryptographic RNG
 * using the configured odds, and the wheel animates onto a segment showing it.
 * One spin per browser: the result is remembered and shown again on later visits.
 */
(function () {
  if (window.__fwSpin) return;
  window.__fwSpin = true;

  var cfgEl = document.getElementById('FwSpinConfig');
  var dialog = document.getElementById('FwSpin');
  if (!cfgEl || !dialog) return;
  var cfg;
  try { cfg = JSON.parse(cfgEl.textContent); } catch (e) { return; }

  var KEY_REWARD = 'fw_spin_reward_v2';
  var KEY_RESULT = 'fw_spin_result_v2'; // the one spin this browser gets
  var KEY_SESSION = 'fw_spin_session_v1'; // 'shown' | 'done'
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var $ = function (sel) { return dialog.querySelector(sel); };
  var dock = document.querySelector('[data-fw-spin-dock]');
  var teaser = document.querySelector('[data-fw-spin-teaser]');
  var rewardChip = document.querySelector('[data-fw-spin-reward]');
  var wheelHost = $('[data-fw-spin-wheel]');
  var pointer = $('.fw-spin__pointer');
  var goBtn = $('[data-fw-spin-go]');
  var goLabel = $('[data-fw-spin-go-label]');
  var msg = $('[data-fw-spin-msg]');

  // ---------- storage (all optional: private mode etc. must not break the page) ----------
  function get(store, key) { try { return window[store].getItem(key); } catch (e) { return null; } }
  function set(store, key, val) { try { window[store].setItem(key, val); } catch (e) {} }
  function del(store, key) { try { window[store].removeItem(key); } catch (e) {} }

  function loadReward() {
    try {
      var r = JSON.parse(get('localStorage', KEY_REWARD) || 'null');
      if (r && r.code) return r;
    } catch (e) {}
    del('localStorage', KEY_REWARD);
    return null;
  }
  function saveReward(result) {
    if (!result || !result.won || !result.code) return;
    set('localStorage', KEY_REWARD, JSON.stringify({ code: result.code, percent: result.percent, segmentIndex: result.segmentIndex }));
  }

  // ---------- prizes & odds ----------
  // 14 segments: 6 x 5%, 2 x 10%, 1 x 20%, 1 x 35%, 4 x no prize (red). 35% sits under
  // the pointer at rest, 20% opposite; no two 5% segments touch.
  var LAYOUT = ['p35', 'p5', 'none', 'p10', 'p5', 'none', 'p5', 'p20', 'p5', 'none', 'p10', 'p5', 'none', 'p5'];
  var PCT = { p5: 5, p10: 10, p20: 20, p35: 35, none: 0 };
  var WHEEL = LAYOUT.map(function (k) { return { outcome: k, percent: PCT[k], label: PCT[k] ? PCT[k] + '% off' : 'No prize' }; });

  function decode(v) { try { return v ? atob(v).trim() : ''; } catch (e) { return ''; } }
  var CODES = {};
  for (var k in (cfg.prizes || {})) CODES[k] = decode(cfg.prizes[k]);
  var ODDS = cfg.odds || {};

  // Every prize on the wheel needs a code and odds, or the wheel is not offered at all.
  function configured() {
    return ['p5', 'p10', 'p20', 'p35'].every(function (k) { return CODES[k] && Number(ODDS[k]) > 0; });
  }

  function randomInt(max) {
    var c = window.crypto || window.msCrypto;
    if (c && c.getRandomValues) {
      // rejection sampling: no modulo bias
      var lim = Math.floor(4294967296 / max) * max, buf = new Uint32Array(1);
      do { c.getRandomValues(buf); } while (buf[0] >= lim);
      return buf[0] % max;
    }
    return Math.floor(Math.random() * max);
  }

  function drawOutcome() {
    var keys = ['p5', 'p10', 'p20', 'p35', 'none'];
    var units = keys.map(function (k) { return Math.max(0, Math.round(Number(ODDS[k] || 0) * 100)); });
    var total = units.reduce(function (a, b) { return a + b; }, 0);
    var roll = randomInt(total);
    for (var i = 0; i < keys.length; i++) { if (roll < units[i]) return keys[i]; roll -= units[i]; }
    return 'none';
  }

  function spinResult() {
    var outcome = drawOutcome();
    var options = [];
    LAYOUT.forEach(function (key, i) { if (key === outcome) options.push(i); });
    var won = PCT[outcome] > 0;
    return { won: won, outcome: outcome, percent: PCT[outcome], segmentIndex: options[randomInt(options.length)], code: won ? CODES[outcome] : null };
  }

  // ---------- wheel drawing ----------
  var SVGNS = 'http://www.w3.org/2000/svg';
  var segments = [];
  var segAngle = 0;
  var rotor = null;
  var angle = 0; // current rotation in degrees, clockwise

  function el(name, attrs, parent) {
    var n = document.createElementNS(SVGNS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function polar(r, deg) {
    var a = (deg - 90) * Math.PI / 180;
    return [200 + r * Math.cos(a), 200 + r * Math.sin(a)];
  }

  function drawWheel(wheel) {
    segments = wheel;
    segAngle = 360 / wheel.length;
    wheelHost.innerHTML = '';
    var svg = el('svg', { viewBox: '0 0 400 400', class: 'fw-spin__svg', 'aria-hidden': 'true', focusable: 'false' }, wheelHost);
    var defs = el('defs', {}, svg);
    var grad = el('radialGradient', { id: 'FwSpinShine', cx: '50%', cy: '42%', r: '60%' }, defs);
    el('stop', { offset: '0%', 'stop-color': '#fff', 'stop-opacity': '.22' }, grad);
    el('stop', { offset: '100%', 'stop-color': '#fff', 'stop-opacity': '0' }, grad);

    el('circle', { cx: 200, cy: 200, r: 198, class: 'fw-spin__rim' }, svg);
    rotor = el('g', { class: 'fw-spin__rotor' }, svg);
    var R = 182;
    wheel.forEach(function (seg, i) {
      var a0 = i * segAngle, a1 = (i + 1) * segAngle;
      var p0 = polar(R, a0), p1 = polar(R, a1);
      el('path', {
        d: 'M200 200 L' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) + ' A' + R + ' ' + R + ' 0 0 1 ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2) + ' Z',
        class: 'fw-spin__seg fw-spin__seg--' + seg.outcome
      }, rotor);
      // Labels run along the radius, reading from the rim towards the hub.
      var mid = a0 + segAngle / 2;
      var g = el('g', { transform: 'rotate(' + mid + ' 200 200)' }, rotor);
      var t = el('text', {
        x: 200, y: 200 - R + 16, class: 'fw-spin__label fw-spin__label--' + seg.outcome,
        transform: 'rotate(90 200 ' + (200 - R + 16) + ')', 'text-anchor': 'start', 'dominant-baseline': 'central'
      }, g);
      if (seg.percent > 0) {
        var big = el('tspan', { class: 'fw-spin__label-big' }, t); big.textContent = seg.percent + '%';
        var small = el('tspan', { dx: 6, class: 'fw-spin__label-small' }, t); small.textContent = 'OFF';
      } else {
        t.textContent = 'NO PRIZE';
      }
    });
    // pegs on the rim
    wheel.forEach(function (_s, i) {
      var p = polar(190, i * segAngle);
      el('circle', { cx: p[0].toFixed(2), cy: p[1].toFixed(2), r: 4.2, class: 'fw-spin__peg' }, svg);
    });
    el('circle', { cx: 200, cy: 200, r: R, fill: 'url(#FwSpinShine)', 'pointer-events': 'none' }, svg);
    el('circle', { cx: 200, cy: 200, r: 34, class: 'fw-spin__hub' }, svg);
    el('circle', { cx: 200, cy: 200, r: 14, class: 'fw-spin__hub-dot' }, svg);
    setAngle(angle);
  }

  function setAngle(a) {
    angle = a;
    if (rotor) rotor.setAttribute('transform', 'rotate(' + (a % 360).toFixed(3) + ' 200 200)');
  }

  // Segment currently under the pointer at 12 o'clock.
  function segmentAt(a) {
    var rel = ((360 - (a % 360)) % 360 + 360) % 360;
    return Math.floor(rel / segAngle) % segments.length;
  }

  var lastTickSeg = -1;
  function tick(velocity) {
    var s = segmentAt(angle);
    if (s === lastTickSeg) return;
    lastTickSeg = s;
    // Only "click" once the wheel is slow enough for individual pegs to be visible.
    if (velocity < 0.75 && pointer.animate) {
      pointer.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(-16deg)' }, { transform: 'rotate(0deg)' }], { duration: 160, easing: 'ease-out' });
    }
  }

  // ---------- spin animation ----------
  // Accelerate → cruise while the server answers → one smooth ease-out (cubic) whose
  // starting speed equals the cruise speed, so there is no visible jolt, ending on
  // the exact segment the server chose.
  var V = 1.45;          // cruise speed, deg/ms (~4 turns/s)
  var ACCEL_MS = 650;
  var MIN_DECEL_TURNS = 5;

  function spinTo(getTarget) {
    return new Promise(function (resolve) {
      var start = performance.now();
      var a0 = angle;
      var phase = 'accel';
      var cruiseFrom = 0, cruiseAngle = 0;
      var dec = null;

      function frame(now) {
        if (phase === 'accel') {
          var t = Math.min(now - start, ACCEL_MS);
          setAngle(a0 + 0.5 * V * t * t / ACCEL_MS);
          tick(V * t / ACCEL_MS);
          if (t >= ACCEL_MS) { phase = 'cruise'; cruiseFrom = now; cruiseAngle = angle; }
        } else if (phase === 'cruise') {
          setAngle(cruiseAngle + V * (now - cruiseFrom));
          var target = getTarget();
          if (target !== undefined) {
            var from = angle;
            var minD = MIN_DECEL_TURNS * 360;
            var dest;
            if (target === null) { // error: just coast to a stop
              dest = from + 540;
            } else {
              var rest = ((target - (from + minD)) % 360 + 360) % 360;
              dest = from + minD + rest;
            }
            var D = dest - from;
            dec = { from: from, D: D, T: 3 * D / V, t0: now };
            phase = 'decel';
          }
        } else {
          var p = Math.min((now - dec.t0) / dec.T, 1);
          var inv = 1 - p;
          setAngle(dec.from + dec.D * (1 - inv * inv * inv));
          tick(V * inv * inv);
          if (p >= 1) { resolve(); return; }
        }
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  }

  function reducedSpinTo(target) {
    return new Promise(function (resolve) {
      var from = angle;
      // Reduced motion: no full turns, just a short ease onto the result.
      var dest = target === null ? from : from + ((target - from) % 360 + 360) % 360;
      var start = performance.now();
      function frame(now) {
        var p = Math.min((now - start) / 600, 1);
        setAngle(from + (dest - from) * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(frame); else resolve();
      }
      requestAnimationFrame(frame);
    });
  }

  // Wheel rotation that puts segment `index` under the pointer, slightly off-centre
  // so it looks natural but never near a boundary.
  function targetAngleFor(index) {
    var jitter = (Math.random() - 0.5) * segAngle * 0.5;
    var mid = index * segAngle + segAngle / 2 + jitter;
    return ((360 - mid) % 360 + 360) % 360;
  }

  // ---------- result UI ----------
  var currentResult = null;

  function showResult(result, opts) {
    currentResult = result;
    opts = opts || {};
    $('[data-fw-spin-intro]').hidden = true;
    var box = $('[data-fw-spin-result]');
    box.hidden = false;
    box.classList.remove('is-in');
    void box.offsetWidth;
    box.classList.add('is-in');
    var win = $('[data-fw-spin-win]'), lose = $('[data-fw-spin-lose]');
    if (result.won && result.code) {
      win.hidden = false; lose.hidden = true;
      $('[data-fw-spin-win-eyebrow]').textContent = opts.already ? 'Your prize from your spin' : (cfg.text.winEyebrow || 'You won');
      $('[data-fw-spin-result-title]').textContent = result.percent + '% off';
      $('[data-fw-spin-code]').textContent = result.code;
      $('[data-fw-spin-expiry]').textContent = cfg.text.codeNote || '';
      $('[data-fw-spin-status]').textContent = '';
      var applyBtn = $('[data-fw-spin-apply]');
      applyBtn.textContent = 'Apply discount'; applyBtn.disabled = false; delete applyBtn.dataset.mode;
      dialog.classList.add('is-win');
      $('[data-fw-spin-result-title]').focus({ preventScroll: true });
      saveReward(result);
      renderDock();
    } else {
      win.hidden = true; lose.hidden = false;
      $('[data-fw-spin-lose-title]').textContent = cfg.text.loseHeading || 'Not this time';
      $('[data-fw-spin-lose-text]').textContent = cfg.text.loseText || '';
      $('[data-fw-spin-lose-title]').focus({ preventScroll: true });
    }
  }

  function showMessage(text) {
    msg.textContent = text;
    msg.hidden = !text;
  }

  // ---------- copy & apply ----------
  function copyCode() {
    var code = currentResult && currentResult.code;
    var status = $('[data-fw-spin-status]');
    var btn = $('[data-fw-spin-copy]');
    if (!code) return;
    var done = function (ok) {
      status.textContent = ok ? 'Copied ' + code + ' to your clipboard.' : 'Select the code above to copy it.';
      if (ok) {
        btn.textContent = 'Copied ✓';
        setTimeout(function () { btn.textContent = 'Copy code'; }, 2200);
      }
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(code).then(function () { done(true); }, function () { done(fallbackCopy(code)); });
    } else {
      done(fallbackCopy(code));
    }
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    dialog.appendChild(ta); ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    ta.remove();
    return ok;
  }

  // Applies the code to the cart, then checks the cart response before saying so.
  function applyCode(code, statusEl, btn) {
    if (!code) return;
    var fallback = '/discount/' + encodeURIComponent(code) + '?redirect=' + encodeURIComponent(cfg.cartUrl);
    if (btn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); }
    var say = function (t) { if (statusEl) statusEl.textContent = t; };
    say('Applying your code…');
    fetch(cfg.cartUpdateUrl, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ discount: code })
    }).then(function (res) {
      if (!res.ok) throw new Error('cart ' + res.status);
      return res.json();
    }).then(function (cart) {
      var entry = (cart.discount_codes || []).filter(function (d) { return String(d.code).toUpperCase() === code.toUpperCase(); })[0];
      if (!entry) { window.location.href = fallback; return; }
      if (entry.applicable) {
        say('Applied to your cart ✓ Taking you there…');
        markApplied(code);
        setTimeout(function () { window.location.href = cfg.cartUrl; }, 700);
      } else if (!cart.item_count) {
        say('Saved to your cart ✓ It will apply automatically when you add miswak.');
        markApplied(code);
        if (btn) { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.textContent = 'Choose your miswak'; btn.dataset.mode = 'shop'; }
      } else {
        say("Saved to your cart, but it can't be combined with the discount already on your order (such as multi-pack savings).");
        if (btn) { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.textContent = 'View cart'; btn.dataset.mode = 'cart'; }
      }
    }).catch(function () {
      // Shopify's discount link also applies the code at checkout.
      window.location.href = fallback;
    });
  }
  function markApplied(code) {
    try {
      var r = JSON.parse(get('localStorage', KEY_REWARD) || 'null');
      if (r && r.code === code) { r.applied = true; set('localStorage', KEY_REWARD, JSON.stringify(r)); }
    } catch (e) {}
  }

  // ---------- dock: teaser + saved reward ----------
  var eligible = false;
  function renderDock() {
    if (!dock) return;
    var reward = loadReward();
    var showTeaser = cfg.teaser && eligible && !reward && get('sessionStorage', KEY_SESSION) === 'shown' && !dialog.open;
    if (teaser) teaser.hidden = !showTeaser;
    if (rewardChip) {
      rewardChip.hidden = !reward || dialog.open;
      if (reward) {
        rewardChip.querySelector('[data-fw-spin-reward-pct]').textContent = reward.percent + '% off';
        rewardChip.querySelector('[data-fw-spin-reward-code]').textContent = reward.applied ? reward.code + ' · applied' : reward.code;
        rewardChip.setAttribute('aria-label', 'Your ' + reward.percent + '% discount code ' + reward.code + '. Show details');
      }
    }
    dock.hidden = (!teaser || teaser.hidden) && (!rewardChip || rewardChip.hidden);
  }

  // ---------- dialog lifecycle ----------
  var state = null;
  var spinning = false;

  function open() {
    if (dialog.open) return;
    if (state && !segments.length) drawWheel(state.wheel);
    dialog.classList.toggle('fw-spin--nowheel', !segments.length);
    $('[data-fw-spin-terms]').textContent = cfg.text.terms || '';
    try { dialog.showModal(); } catch (e) { dialog.setAttribute('open', ''); }
    document.documentElement.classList.add('fw-spin-open');
    if (get('sessionStorage', KEY_SESSION) !== 'done') set('sessionStorage', KEY_SESSION, 'shown');
    renderDock();
  }
  function close() {
    if (dialog.open) { try { dialog.close(); } catch (e) { dialog.removeAttribute('open'); } }
    document.documentElement.classList.remove('fw-spin-open');
    renderDock();
  }
  dialog.addEventListener('close', function () {
    document.documentElement.classList.remove('fw-spin-open');
    renderDock();
  });
  dialog.addEventListener('click', function (e) {
    if (e.target === dialog) close(); // backdrop
    if (e.target.closest && e.target.closest('[data-fw-spin-close]')) close();
  });
  $('[data-fw-spin-copy]').addEventListener('click', copyCode);
  $('[data-fw-spin-apply]').addEventListener('click', function (e) {
    var btn = e.currentTarget;
    if (btn.dataset.mode === 'shop') { window.location.href = cfg.shopUrl; return; }
    if (btn.dataset.mode === 'cart') { window.location.href = cfg.cartUrl; return; }
    applyCode(currentResult && currentResult.code, $('[data-fw-spin-status]'), btn);
  });
  if (teaser) teaser.addEventListener('click', open);
  if (rewardChip) rewardChip.addEventListener('click', function () {
    var r = loadReward();
    if (!r) return renderDock();
    if (!segments.length && state) drawWheel(state.wheel);
    if (segments.length && r.segmentIndex !== undefined) setAngle(targetAngleFor(r.segmentIndex));
    open();
    showResult({ won: true, code: r.code, percent: r.percent, segmentIndex: r.segmentIndex }, { already: true });
  });

  goBtn.addEventListener('click', function () {
    if (spinning || !state) return;
    if (cfg.designMode) { showMessage('Spinning is disabled in the theme editor.'); return; }
    spinning = true;
    goBtn.disabled = true;
    goBtn.setAttribute('aria-busy', 'true');
    goLabel.textContent = 'Spinning…';
    showMessage('');
    dialog.classList.add('is-spinning');

    // Drawn once, before the wheel moves, and stored straight away so a refresh
    // mid-spin can't be used to spin again.
    var result = spinResult();
    set('localStorage', KEY_RESULT, JSON.stringify(result));
    saveReward(result);
    var target = targetAngleFor(result.segmentIndex);

    var anim = reduceMotion ? reducedSpinTo(target) : spinTo(function () { return target; });

    anim.then(function () {
      spinning = false;
      dialog.classList.remove('is-spinning');
      goBtn.removeAttribute('aria-busy');
      set('sessionStorage', KEY_SESSION, 'done');
      eligible = false;
      showResult(result);
    });
  });

  // ---------- boot ----------
  function loadResult() {
    try { var r = JSON.parse(get('localStorage', KEY_RESULT) || 'null'); return r && typeof r.won === 'boolean' ? r : null; } catch (e) { return null; }
  }

  function boot() {
    renderDock();
    if (!configured()) return; // missing codes/odds: never show a wheel that can't pay out
    state = { wheel: WHEEL };
    if (cfg.designMode) {
      if (cfg.editorPreview) { eligible = true; open(); }
      return;
    }
    eligible = !loadResult();
    renderDock();
    if (!eligible || !cfg.autoOpen || get('sessionStorage', KEY_SESSION)) return;
    setTimeout(function () {
      // Don't interrupt someone already in another dialog or the menu.
      if (document.querySelector('dialog[open]:not(#FwSpin), details[open].modal, .menu-drawer-container details[open]')) return;
      open();
    }, cfg.delayMs || 0);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
