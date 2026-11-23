/* Pierre Bénétreau — portfolio. Vanilla JS, no dependencies. */
(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const lang = () => root.getAttribute('data-l') || 'fr';

  /* ── language ─────────────────────────────── */
  const setLang = l => {
    root.setAttribute('data-l', l); root.lang = l;
    try { localStorage.setItem('pb-lang', l); } catch (e) {}
    $$('.lang button').forEach(b => b.setAttribute('aria-pressed', b.dataset.set === l));
    updateScopeText();
  };
  $$('.lang button').forEach(b => b.addEventListener('click', () => setLang(b.dataset.set)));

  /* ── load-in ──────────────────────────────── */
  requestAnimationFrame(() => setTimeout(() => document.body.classList.add('loaded'), 60));

  /* ── bar: solid after hero, dark over dark sections, hide on scroll down ── */
  const bar = $('#bar');
  let lastY = 0;
  const darkZones = () => $$('.night, .contact');
  const onScroll = () => {
    const y = scrollY;
    bar.classList.toggle('solid', y > 40);
    bar.classList.toggle('hide', y > lastY && y > 500);
    lastY = y;
    const mid = 31;
    bar.classList.toggle('dark', darkZones().some(z => { const r = z.getBoundingClientRect(); return r.top <= mid && r.bottom >= mid; }));
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* ── reveal ───────────────────────────────── */
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  $$('.rv').forEach(el => io.observe(el));

  /* ── manifesto: words light up with scroll ── */
  $$('[data-words]').forEach(p => {
    const nodes = [...p.childNodes]; p.textContent = '';
    nodes.forEach(n => {
      if (n.nodeType === 3) n.textContent.split(/(\s+)/).forEach(t => {
        if (!t) return;
        if (/^\s+$/.test(t)) p.append(t); else { const s = document.createElement('span'); s.className = 'w'; s.textContent = t; p.append(s); }
      }); else { const s = document.createElement('span'); s.className = 'w'; s.append(n); p.append(s); }
    });
  });
  const lightWords = () => {
    $$('[data-words]').forEach(p => {
      if (!p.offsetParent) return;
      const r = p.getBoundingClientRect(), vh = innerHeight;
      const prog = Math.min(1, Math.max(0, (vh * .85 - r.top) / (r.height + vh * .35)));
      const ws = $$('.w', p), n = Math.round(prog * ws.length * 1.15);
      ws.forEach((w, i) => w.classList.toggle('on', reduce || i < n));
    });
  };
  addEventListener('scroll', lightWords, { passive: true }); lightWords();

  /* ── canvas helper ────────────────────────── */
  const fit = (cv) => {
    const r = cv.getBoundingClientRect();
    cv.width = Math.max(1, r.width * DPR); cv.height = Math.max(1, r.height * DPR);
    const ctx = cv.getContext('2d'); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    return { ctx, w: r.width, h: r.height };
  };
  const visible = (el, cb) => new IntersectionObserver(es => cb(es[0].isIntersecting)).observe(el);

  /* ── mycelium growth ──────────────────────── */
  function mycelium(cv, opts) {
    if (!cv) return;
    const o = Object.assign({ ink: '22,23,15', tip: '176,130,58', bg: '241,236,225', alpha: .32, seeds: 5, interactive: true, max: 520 }, opts);
    let { ctx, w, h } = fit(cv), hy = [], on = true, raf, frame = 0;
    const spawn = (x, y, a, life, gen = 0) => { if (hy.length < o.max) hy.push({ x, y, a, life, gen, v: .55 + Math.random() * .5, wob: (Math.random() - .5) * .02 }); };
    const seed = (x, y, n = 7) => { for (let i = 0; i < n; i++) spawn(x, y, Math.random() * Math.PI * 2, 90 + Math.random() * 160); };
    const seedEdges = () => {
      for (let i = 0; i < o.seeds; i++) {
        const side = i % 4, t = Math.random();
        const p = side === 0 ? [t * w, -2, Math.PI / 2] : side === 1 ? [w + 2, t * h, Math.PI] : side === 2 ? [t * w, h + 2, -Math.PI / 2] : [-2, t * h, 0];
        for (let k = 0; k < 4; k++) spawn(p[0], p[1], p[2] + (Math.random() - .5) * 1.2, 220 + Math.random() * 260);
      }
    };
    const step = () => {
      const nx = [];
      ctx.lineCap = 'round';
      for (const f of hy) {
        f.a += f.wob + (Math.random() - .5) * .28; f.wob *= .995;
        const x2 = f.x + Math.cos(f.a) * f.v * 1.6, y2 = f.y + Math.sin(f.a) * f.v * 1.6;
        const wgt = Math.max(.35, 1.5 - f.gen * .28);
        ctx.strokeStyle = `rgba(${o.ink},${o.alpha * (1 - f.gen * .1)})`; ctx.lineWidth = wgt;
        ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(x2, y2); ctx.stroke();
        f.x = x2; f.y = y2; f.life--;
        if (Math.random() < .018 && f.gen < 6) spawn(f.x, f.y, f.a + (Math.random() < .5 ? -1 : 1) * (.4 + Math.random() * .7), f.life * .7, f.gen + 1);
        if (f.life > 0 && f.x > -20 && f.y > -20 && f.x < w + 20 && f.y < h + 20) nx.push(f);
        else if (f.life <= 0) { ctx.fillStyle = `rgba(${o.tip},.55)`; ctx.beginPath(); ctx.arc(f.x, f.y, 1.4, 0, 6.3); ctx.fill(); }
      }
      hy = nx;
    };
    const loop = () => {
      if (!on) return;
      frame++;
      for (let i = 0; i < 2; i++) step();
      if (frame % 4 === 0) { ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = 'rgba(0,0,0,.03)'; ctx.fillRect(0, 0, w, h); ctx.globalCompositeOperation = 'source-over'; }
      if (hy.length < 30 && frame % 90 === 0) seedEdges();
      raf = requestAnimationFrame(loop);
    };
    seedEdges();
    if (reduce) { for (let i = 0; i < 520; i++) step(); return; }
    visible(cv, v => { on = v; cancelAnimationFrame(raf); if (v) loop(); });
    if (o.interactive) {
      let last = 0;
      cv.parentElement.addEventListener('pointermove', e => {
        const now = performance.now(); if (now - last < 70) return; last = now;
        const r = cv.getBoundingClientRect(); seed(e.clientX - r.left, e.clientY - r.top, 2);
      });
      cv.parentElement.addEventListener('pointerdown', e => { const r = cv.getBoundingClientRect(); seed(e.clientX - r.left, e.clientY - r.top, 12); });
    }
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { const old = w; ({ ctx, w, h } = fit(cv)); if (Math.abs(old - w) > 40) seedEdges(); }, 200); });
  }
  const small = innerWidth < 760;
  mycelium($('#myco'), small ? { alpha: .2, max: 240, seeds: 3 } : {});
  mycelium($('#myco2'), { ink: '241,236,225', tip: '70,230,140', bg: '22,23,15', alpha: .3, seeds: 8, max: 420 });

  /* ── ECG model ────────────────────────────── */
  const g = (x, m, s, a) => a * Math.exp(-((x - m) ** 2) / (2 * s * s));
  const beat = ph => g(ph, .18, .025, .12) - g(ph, .285, .009, .14) + g(ph, .31, .011, 1.15) - g(ph, .335, .01, .28) + g(ph, .55, .045, .3);
  const ecg = (t, bpm) => { const per = 60 / bpm; return beat((t % per) / per); };

  /* hero pulse strip */
  (() => {
    const cv = $('#pulse'); if (!cv) return;
    let { ctx, w, h } = fit(cv), x = 0, t = 0, on = true, last = performance.now(), py = null, bpm = 70;
    const bpmEl = $('#bpm');
    addEventListener('resize', () => { ({ ctx, w, h } = fit(cv)); x = 0; py = null; });
    const draw = (now) => {
      if (!on) return;
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      const speed = 150; // px / s
      const steps = Math.max(1, Math.round(dt * speed));
      for (let i = 0; i < steps; i++) {
        t += 1 / speed;
        const y = h * .62 - ecg(t, bpm) * h * .48;
        ctx.clearRect(x + 1, 0, 26, h);
        ctx.strokeStyle = 'rgba(22,23,15,.85)'; ctx.lineWidth = 1.3;
        if (py !== null) { ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(x + 1, y); ctx.stroke(); }
        py = y; x++;
        if (x > w) { x = 0; py = null; }
      }
      if (Math.random() < .004) { bpm = 66 + Math.round(Math.random() * 8); bpmEl.textContent = bpm; }
      requestAnimationFrame(draw);
    };
    if (reduce) { for (let i = 0; i < w; i++) { const y = h * .62 - ecg(i / 150, 70) * h * .48; ctx.lineTo(i, y); } ctx.strokeStyle = 'rgba(22,23,15,.85)'; ctx.stroke(); return; }
    visible(cv, v => { on = v; if (v) { last = performance.now(); requestAnimationFrame(draw); } });
  })();

  /* ECG denoising demo */
  let scopeClean = false;
  function updateScopeText() {
    const s = $('#scope'); if (!s) return;
    s.classList.toggle('clean', scopeClean);
    $('.st-txt', s).textContent = scopeClean ? (lang() === 'fr' ? 'Signal propre' : 'Clean signal') : (lang() === 'fr' ? 'Interférences EMI' : 'EMI interference');
  }
  (() => {
    const cv = $('#ecgdemo'); if (!cv) return;
    let { ctx, w, h } = fit(cv), t0 = performance.now(), on = false, mix = 0;
    const sw = $('#denoise');
    sw.addEventListener('click', () => { scopeClean = !scopeClean; sw.setAttribute('aria-checked', scopeClean); updateScopeText(); });
    updateScopeText();
    addEventListener('resize', () => ({ ctx, w, h } = fit(cv)));
    // deterministic pseudo-noise
    const hash = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
    const burst = t => { const k = Math.floor(t / 1.7); return (hash(k) > .45 && (t % 1.7) < .55) ? 1 : 0; };
    const noisy = t => {
      let v = ecg(t, 70);
      v += .16 * Math.sin(2 * Math.PI * 50 * t) + .07 * Math.sin(2 * Math.PI * .33 * t) + (hash(t * 997) - .5) * .12;
      if (burst(t)) v += Math.sin(2 * Math.PI * 23 * t) * 1.6 + (hash(t * 3331) - .5) * .8;
      return Math.max(-1.1, Math.min(1.6, v));
    };
    const draw = now => {
      if (!on) return;
      const target = scopeClean ? 1 : 0; mix += (target - mix) * .06;
      const T = (now - t0) / 1000, span = 4.2;
      ctx.clearRect(0, 0, w, h);
      // grid
      ctx.strokeStyle = 'rgba(255,255,255,.055)'; ctx.lineWidth = 1;
      for (let gx = 0; gx < w; gx += w / 21) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
      for (let gy = 0; gy < h; gy += h / 8) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }
      const base = h * .64, amp = h * .42;
      // ghost raw trace when clean
      const trace = (fn, col, lw) => {
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
        for (let px = 0; px <= w; px += 1) { const t = T - span + (px / w) * span; const y = base - fn(t) * amp; px ? ctx.lineTo(px, y) : ctx.moveTo(px, y); }
        ctx.stroke();
      };
      if (mix > .02) trace(noisy, `rgba(230,120,100,${.18 * mix})`, 1);
      trace(t => noisy(t) * (1 - mix) + ecg(t, 70) * mix, mix > .5 ? '#46e68c' : '#e7ece7', 1.6);
      // quality band
      const bandY = h - 10;
      for (let px = 0; px < w; px += 3) {
        const t = T - span + (px / w) * span, b = burst(t);
        ctx.fillStyle = mix > .5 ? (b ? 'rgba(70,140,230,.75)' : 'rgba(70,230,140,.75)') : (b ? 'rgba(228,87,74,.8)' : 'rgba(240,190,80,.55)');
        ctx.fillRect(px, bandY, 3, 6);
      }
      requestAnimationFrame(draw);
    };
    if (reduce) { on = true; draw(performance.now()); on = false; sw.addEventListener('click', () => { on = true; setTimeout(() => { draw(performance.now()); on = false; }, 0); }); return; }
    visible(cv, v => { on = v; if (v) requestAnimationFrame(draw); });
  })();

  /* ── parametric tile blueprint ────────────── */
  (() => {
    const svg = $('#tile'); if (!svg) return;
    const NS = 'http://www.w3.org/2000/svg', S = 1.1, O = 45; // 300mm → 330px, offset
    const el = (n, a, p = svg) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); p.appendChild(e); return e; };
    const L = 'rgba(207,224,242,.92)';
    // outline with alternating tenons (+) / mortises (−): 5 per side
    const edge = (x0, y0, dx, dy, nx, ny, sign) => {
      let d = ''; const n = 5, len = 300, seg = len / n, tw = 26, td = 10;
      for (let i = 0; i < n; i++) {
        const s = sign * (i % 2 ? -1 : 1), c = seg * i + seg / 2;
        const p = (u, v) => `${(O + (x0 + dx * u + nx * v) * S).toFixed(1)},${(O + (y0 + dy * u + ny * v) * S).toFixed(1)}`;
        d += ` L${p(c - tw / 2, 0)} L${p(c - tw / 2, td * s)} L${p(c + tw / 2, td * s)} L${p(c + tw / 2, 0)}`;
      }
      return d;
    };
    const path = `M${O},${O}` + edge(0, 0, 1, 0, 0, -1, 1) + ` L${O + 300 * S},${O}` + edge(300, 0, 0, 1, 1, 0, -1) + ` L${O + 300 * S},${O + 300 * S}` + edge(300, 300, -1, 0, 0, 1, 1) + ` L${O},${O + 300 * S}` + edge(0, 300, 0, -1, -1, 0, -1) + ' Z';
    el('path', { d: path, fill: 'rgba(207,224,242,.06)', stroke: L, 'stroke-width': 1.4 });
    const holes = el('g', {});
    const pts = [];
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) { const e = el('circle', { class: 'hole', cx: O + (30 + c * 30) * S, cy: O + (30 + r * 30) * S, r: 5 * S, fill: 'none', stroke: L, 'stroke-width': 1 }, holes); pts.push({ e, r, c }); }
    // dimension lines
    const dim = (x1, y1, x2, y2, txt, tx, ty, rot) => {
      el('line', { x1, y1, x2, y2, stroke: L, 'stroke-width': .8, 'marker-start': 'url(#ar)', 'marker-end': 'url(#ar)' });
      const t = el('text', { x: tx, y: ty, fill: L, 'font-size': 11, 'font-family': 'Geist Mono, monospace', 'text-anchor': 'middle', transform: rot ? `rotate(-90 ${tx} ${ty})` : '' }); t.textContent = txt;
    };
    const defs = el('defs', {}); const m = el('marker', { id: 'ar', viewBox: '0 0 10 10', refX: 5, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }, defs); el('path', { d: 'M0,0 L10,5 L0,10 z', fill: L }, m);
    dim(O, O + 300 * S + 30, O + 300 * S, O + 300 * S + 30, '300', O + 150 * S, O + 300 * S + 26);
    dim(O - 28, O, O - 28, O + 300 * S, '300', O - 33, O + 150 * S, true);
    dim(O + 30 * S, O - 22, O + 60 * S, O - 22, '30', O + 45 * S, O - 27);
    const lab = el('text', { x: O + 300 * S - 2, y: O - 26, fill: L, 'font-size': 10, 'font-family': 'Geist Mono, monospace', 'text-anchor': 'end' }); lab.textContent = 'Ø10 · e = 40';
    const count = $('#holes');
    const setPat = pat => {
      let n = 0;
      pts.forEach(({ e, r, c }) => {
        const shift = pat === 'stag' && r % 2 ? 15 : 0;
        const hide = pat === 'stag' && r % 2 && c === 8;
        e.style.transform = `translateX(${shift * S}px)`; e.style.opacity = hide ? 0 : 1; if (!hide) n++;
      });
      count.textContent = n;
      $$('.seg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.pat === pat));
    };
    $$('.seg button').forEach(b => b.addEventListener('click', () => setPat(b.dataset.pat)));
    setPat('grid');
  })();

  /* ── 7-segment counter ────────────────────── */
  (() => {
    const svg = $('#seg'); if (!svg) return;
    const NS = 'http://www.w3.org/2000/svg';
    const SEG = { a: [6, 0, 28, 0], b: [34, 4, 34, 30], c: [34, 38, 34, 64], d: [6, 68, 28, 68], e: [0, 38, 0, 64], f: [0, 4, 0, 30], g: [6, 34, 28, 34] };
    const DIG = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg'];
    const digits = [62, 118].map(ox => {
      const m = {};
      for (const k in SEG) { const [x1, y1, x2, y2] = SEG[k]; const l = document.createElementNS(NS, 'line'); Object.entries({ x1: x1 + ox, y1: y1 + 22, x2: x2 + ox, y2: y2 + 22, 'stroke-width': 5, 'stroke-linecap': 'round', stroke: 'currentColor' }).forEach(([a, v]) => l.setAttribute(a, v)); svg.appendChild(l); m[k] = l; }
      return m;
    });
    const show = n => [Math.floor(n / 10), n % 10].forEach((d, i) => { for (const k in SEG) digits[i][k].style.opacity = DIG[d].includes(k) ? 1 : .08; });
    let n = 0; show(0);
    const card = svg.closest('.board');
    card.addEventListener('click', () => { n = (n + 1) % 100; show(n); });
    card.style.cursor = 'pointer'; card.title = 'Cliquez pour compter / Click to count';
    if (!reduce) setInterval(() => { if (card.matches(':hover')) return; n = (n + 1) % 100; show(n); }, 900);
  })();

  /* ── index hover preview ──────────────────── */
  (() => {
    const pk = $('#peek'); if (!pk || matchMedia('(hover: none)').matches) return;
    const img = $('img', pk); let tx = 0, ty = 0, x = 0, y = 0, raf;
    const mv = () => { x += (tx - x) * .18; y += (ty - y) * .18; pk.style.left = x + 'px'; pk.style.top = y + 'px'; raf = requestAnimationFrame(mv); };
    $$('.index a').forEach(a => {
      a.addEventListener('mouseenter', e => { img.src = a.dataset.peek; tx = x = e.clientX + 150; ty = y = e.clientY; pk.classList.add('on'); cancelAnimationFrame(raf); mv(); });
      a.addEventListener('mousemove', e => { tx = e.clientX + 150; ty = e.clientY; });
      a.addEventListener('mouseleave', () => { pk.classList.remove('on'); cancelAnimationFrame(raf); });
    });
  })();

  /* ── lightbox ─────────────────────────────── */
  (() => {
    const lb = $('#lb'), li = $('img', lb), lp = $('p', lb), close = $('button', lb);
    let opener = null;
    const shut = () => { lb.classList.remove('on'); opener && opener.focus(); };
    $$('figure.ph').forEach(f => {
      f.tabIndex = 0; f.setAttribute('role', 'button');
      const open = () => {
        const im = $('img', f); li.src = im.currentSrc || im.src; li.alt = im.alt;
        const holder = f.closest('.sketch, .cell, .step, .dish') || f.parentElement;
        const cap = holder && $('.cap', holder);
        lp.textContent = cap ? cap.innerText.replace(/\s*\n\s*/g, ' — ') : im.alt;
        opener = f; lb.classList.add('on'); close.focus();
      };
      f.addEventListener('click', open);
      f.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
    lb.addEventListener('click', e => { if (e.target !== li) shut(); });
    addEventListener('keydown', e => { if (e.key === 'Escape' && lb.classList.contains('on')) shut(); });
  })();
})();
