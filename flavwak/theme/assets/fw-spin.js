/*
 * Flavwak Spin to win.
 *
 * The browser never decides anything: it asks the spin service (via the Shopify App
 * Proxy) for the wheel layout, sends "spin", and animates the wheel onto the segment
 * the server picked. Discount codes shown here were created in Shopify by the server.
 */
(function () {
  if (window.__fwSpin) return;
  window.__fwSpin = true;

  var cfgEl = document.getElementById('FwSpinConfig');
  var dialog = document.getElementById('FwSpin');
  if (!cfgEl || !dialog) return;
  var cfg;
  try { cfg = JSON.parse(cfgEl.textContent); } catch (e) { return; }

  var KEY_VISITOR = 'fw_spin_visitor_v1';
  var KEY_REWARD = 'fw_spin_reward_v1';
  var KEY_SESSION = 'fw_spin_session_v1'; // 'shown' | 'done'
  var KEY_STATE = 'fw_spin_state_v1';
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
      if (r && r.code && r.expiresAt && new Date(r.expiresAt).getTime() > Date.now()) return r;
    } catch (e) {}
    del('localStorage', KEY_REWARD);
    return null;
  }
  function saveReward(result) {
    if (!result || !result.won || !result.code || result.expired) return;
    set('localStorage', KEY_REWARD, JSON.stringify({ code: result.code, percent: result.percent, expiresAt: result.expiresAt, segmentIndex: result.segmentIndex }));
  }

  // ---------- network ----------
  function proxyUrl(path, params) {
    var q = [];
    for (var k in params) if (params[k]) q.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
    return cfg.proxy.replace(/\/$/, '') + path + (q.length ? '?' + q.join('&') : '');
  }

  function fetchState() {
    var cached = get('sessionStorage', KEY_STATE);
    if (cached) { try { return Promise.resolve(JSON.parse(cached)); } catch (e) {} }
    return fetch(proxyUrl('/state', { visitor: get('localStorage', KEY_VISITOR) }), {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    }).then(function (res) {
      if (!res.ok) throw new Error('state ' + res.status);
      return res.json();
    }).then(function (data) {
      if (!data || !data.ok || !data.wheel || !data.wheel.length) throw new Error('bad state');
      if (data.visitor) set('localStorage', KEY_VISITOR, data.visitor);
      set('sessionStorage', KEY_STATE, JSON.stringify(data));
      return data;
    });
  }

  function requestSpin() {
    return fetch(proxyUrl('/spin', {}), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ visitor: get('localStorage', KEY_VISITOR) })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (res.ok && body.ok && body.result) return body;
        var err = new Error(body.error || 'http_' + res.status);
        err.status = res.status;
        err.retryable = body.retryable !== false;
        throw err;
      });
    });
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
      var dest = target === null ? from : from + 360 + ((target - from - 360) % 360 + 360) % 360;
      var start = performance.now();
      function frame(now) {
        var p = Math.min((now - start) / 900, 1);
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

  function fmtExpiry(iso) {
    var d = new Date(iso);
    var hours = Math.max(0, Math.round((d.getTime() - Date.now()) / 3600000));
    var when;
    try {
      when = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);
    } catch (e) { when = d.toLocaleString(); }
    return 'Valid until ' + when + (hours >= 1 ? ' (' + hours + ' hour' + (hours === 1 ? '' : 's') + ' left)' : ' (less than an hour left)');
  }

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
    if (result.won && result.code && !result.expired) {
      win.hidden = false; lose.hidden = true;
      $('[data-fw-spin-win-eyebrow]').textContent = opts.already ? 'Your prize from your spin' : (cfg.text.winEyebrow || 'You won');
      $('[data-fw-spin-result-title]').textContent = result.percent + '% off';
      $('[data-fw-spin-code]').textContent = result.code;
      $('[data-fw-spin-expiry]').textContent = fmtExpiry(result.expiresAt);
      $('[data-fw-spin-status]').textContent = '';
      var applyBtn = $('[data-fw-spin-apply]');
      applyBtn.textContent = 'Apply discount'; applyBtn.disabled = false; delete applyBtn.dataset.mode;
      dialog.classList.add('is-win');
      $('[data-fw-spin-result-title]').focus({ preventScroll: true });
      saveReward(result);
      renderDock();
    } else {
      win.hidden = true; lose.hidden = false;
      $('[data-fw-spin-lose-title]').textContent = result.won && result.expired ? 'Your code has expired' : (cfg.text.loseHeading || 'Not this time');
      $('[data-fw-spin-lose-text]').textContent = result.won && result.expired
        ? 'Your ' + result.percent + '% code from your earlier spin has expired.'
        : (cfg.text.loseText || '');
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
    var terms = (cfg.text.terms || '').replace('{hours}', state ? state.codeValidHours : 48);
    $('[data-fw-spin-terms]').textContent = terms;
    try { dialog.showModal(); } catch (e) { dialog.setAttribute('open', ''); }
    document.documentElement.classList.add('fw-spin-open');
    if (get('sessionStorage', KEY_SESSION) !== 'done') set('sessionStorage', KEY_SESSION, 'shown');
    renderDock();
  }
  function close() {
    if (dialog.open) { try { dialog.close(); } catch (e) { dialog.removeAttribute('open'); } }
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
    showResult({ won: true, code: r.code, percent: r.percent, expiresAt: r.expiresAt, expired: false, segmentIndex: r.segmentIndex }, { already: true });
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

    var outcome; // undefined = waiting, null = failed, number = target angle
    var response = null, failure = null;
    requestSpin().then(function (body) {
      response = body;
      outcome = targetAngleFor(body.result.segmentIndex);
    }, function (err) {
      failure = err;
      outcome = null;
    });

    var anim = reduceMotion
      ? new Promise(function (resolve) {
          var wait = setInterval(function () {
            if (outcome !== undefined) { clearInterval(wait); reducedSpinTo(outcome).then(resolve); }
          }, 50);
        })
      : spinTo(function () { return outcome; });

    anim.then(function () {
      spinning = false;
      dialog.classList.remove('is-spinning');
      goBtn.removeAttribute('aria-busy');
      if (response) {
        set('sessionStorage', KEY_SESSION, 'done');
        del('sessionStorage', KEY_STATE);
        eligible = false;
        showResult(response.result, { already: response.alreadySpun });
        return;
      }
      goBtn.disabled = false;
      if (failure && failure.status === 429) {
        goBtn.disabled = true;
        goLabel.textContent = 'Spin unavailable';
        showMessage("This connection has reached today's spin limit. Please try again tomorrow.");
      } else if (failure && failure.status === 503 && failure.retryable) {
        goLabel.textContent = 'Try again';
        showMessage("We couldn't create your discount just now, so nothing was awarded yet. Please try again in a moment.");
      } else {
        goLabel.textContent = 'Try again';
        showMessage('Something went wrong and no discount was created. Please try again.');
      }
    });
  });

  // ---------- boot ----------
  function editorPreview() {
    state = {
      wheel: ['p35', 'p5', 'none', 'p10', 'p5', 'none', 'p5', 'p20', 'p5', 'none', 'p10', 'p5', 'none', 'p5'].map(function (k) {
        var pct = { p5: 5, p10: 10, p20: 20, p35: 35, none: 0 }[k];
        return { outcome: k, percent: pct, label: pct ? pct + '% off' : 'No prize' };
      }),
      codeValidHours: 48
    };
    open();
  }

  function boot() {
    renderDock();
    if (cfg.designMode) {
      if (cfg.editorPreview) editorPreview();
      return;
    }
    fetchState().then(function (s) {
      state = s;
      eligible = !!s.eligible;
      if (s.result) {
        set('sessionStorage', KEY_SESSION, 'done');
        if (s.result.won && s.result.code && !s.result.expired) saveReward(s.result);
        else if (!s.result.won || s.result.expired) del('localStorage', KEY_REWARD);
      }
      renderDock();
      if (!eligible || !cfg.autoOpen || get('sessionStorage', KEY_SESSION)) return;
      setTimeout(function () {
        // Don't interrupt someone who is typing or already in another dialog.
        if (document.querySelector('dialog[open]:not(#FwSpin), details[open].modal, .menu-drawer-container details[open]')) return;
        open();
      }, cfg.delayMs || 0);
    }).catch(function () {
      // Spin service not connected or unreachable: show nothing (no fake wheel).
      renderDock();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
