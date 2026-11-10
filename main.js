/* Epoch — official site
   One pinned stage, scrubbed by scroll. Each [data-beat] element is a beat of text; consecutive
   beats that share a data-bg share a backdrop, and a change of backdrop is a dithered wipe
   painted on a 2D canvas. No libraries, and nothing here reads pixels back, so the page also
   works when index.html is opened straight from disk. */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);

  const root = document.documentElement;
  const body = document.body;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('js');

  const T = 0.62;   // length of a dithered wipe, in viewports of scroll
  const CELL = 3;   // dither grain, in CSS px

  /* ───────────── backdrops ───────────── */
  // focus: which part of the picture stays in frame · zoom: slow push over the life of the backdrop
  // scrim: darkening under the text corner · tone: flat colour shown until the picture has loaded
  const PICTURES = {
    archipelago: { focus: [0.5, 0.46], zoom: [1.14, 1.0],  scrim: 0.5,  tone: '#1c5f8a' },
    naval:       { focus: [0.62, 0.5], zoom: [1.02, 1.12], scrim: 0.76, tone: '#1a7f92' },
  };
  const SURFACES = {
    sky:   { theme: 'dark',  paint: (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2c62b8'); g.addColorStop(0.55, '#1d4c9b'); g.addColorStop(1, '#183f87'); c.fillStyle = g; c.fillRect(0, 0, w, h); } },
    paper: { theme: 'light', paint: (c, w, h) => { const g = c.createRadialGradient(w * 0.62, h * 0.46, 0, w * 0.62, h * 0.46, Math.hypot(w, h) * 0.7); g.addColorStop(0, '#f5efe1'); g.addColorStop(1, '#e8dfcb'); c.fillStyle = g; c.fillRect(0, 0, w, h); } },
    ink:   { theme: 'dark',  paint: (c, w, h) => { c.fillStyle = '#0b0a09'; c.fillRect(0, 0, w, h); } },
  };

  const drops = {};
  function backdrop(key) {
    if (drops[key]) return drops[key];
    if (SURFACES[key]) return (drops[key] = SURFACES[key]);
    const conf = PICTURES[key];
    const d = { theme: 'dark', conf, img: new Image(), ready: false };
    d.img.decoding = 'async';
    d.img.onload = () => { d.ready = true; kick(true); };
    d.img.src = `assets/img/${key}.webp`;
    return (drops[key] = d);
  }

  /* ───────────── beats ───────────── */
  const track = $('#track');
  const pin = $('.pin');
  const beats = $$('[data-beat]', pin).map(el => ({
    el,
    id: el.dataset.beat,
    bg: el.dataset.bg,
    wipe: el.dataset.wipe || 'noise',
    len: parseFloat(el.dataset.len) || 1,
    rail: el.dataset.rail || '',
    group: el.closest('[data-group]'),
  }));

  let total = 0;
  beats.forEach((b, i) => { b.start = total; total += b.len; b.cut = i > 0 && b.bg !== beats[i - 1].bg; });
  beats.forEach((b, i) => {
    const next = beats[i + 1];
    b.on = i === 0 ? -1 : b.start - (b.cut ? 0.2 : 0);                    // text arrives as the wipe lands…
    b.off = next ? next.start - (next.cut ? T + 0.05 : 0) : Infinity;     // …and leaves before the next one starts
    $$('.rv', b.el).forEach((n, k) => n.style.setProperty('--i', k));
  });
  track.style.setProperty('--total', total.toFixed(3));

  // runs = stretches of consecutive beats on one backdrop
  const runs = [];
  beats.forEach((b, i) => { if (i === 0 || b.cut) runs.push({ from: b.start, wipe: b.wipe, drop: backdrop(b.bg) }); });
  runs.forEach((r, i) => { r.to = runs[i + 1] ? runs[i + 1].from : total; });

  const groups = $$('[data-group]', pin);
  const withs = $$('[data-with]', pin).map(el => ({ el, ids: el.dataset.with.split(' ') }));
  const fors = $$('[data-for]', pin);
  const railLinks = $$('.rail a');
  const sections = $$('[data-section]');

  /* ───────────── canvas ───────────── */
  const canvas = $('.stage');
  const ctx = canvas.getContext('2d', { alpha: false });
  const mix = document.createElement('canvas');
  const mctx = mix.getContext('2d');
  const mask = document.createElement('canvas');
  const kctx = mask.getContext('2d');

  let W = 0, H = 0, vh = 1, trackTop = 0, gw = 0, gh = 0, maskData = null, mask32 = null;
  const thrCache = new Map();

  function mulberry(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function makeNoise(seed) {
    const rnd = mulberry(seed), P = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) P[i] = rnd();
    const h = (x, y) => P[((x * 73) ^ (y * 151)) & 1023];
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), u = smooth(x - xi), v = smooth(y - yi);
      return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
    };
  }

  const BAYER = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
    3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21];

  // A threshold per dither cell: the cell switches to the incoming picture once progress passes it.
  // Geometry decides where the wipe travels; ordered + white noise gives the stippled edge.
  function thresholds(wipe) {
    let t = thrCache.get(wipe);
    if (t) return t;
    t = new Uint8Array(gw * gh);
    const key = wipe.length * 31 + wipe.charCodeAt(0);
    const rnd = mulberry(key), nz = makeNoise(key + 7);
    const soft = wipe === 'noise' ? 1 : 0.4, ar = gw / gh;
    for (let y = 0, i = 0; y < gh; y++) {
      const v = y / (gh - 1);
      for (let x = 0; x < gw; x++, i++) {
        const u = x / (gw - 1);
        let g;
        switch (wipe) {
          case 'column': g = Math.abs(u - 0.5) * 2; break;
          case 'radial': g = Math.hypot((u - 0.6) * ar, v - 0.42) / Math.hypot(0.6 * ar, 0.58); break;
          case 'sweep':  g = u * 0.86 + v * 0.14; break;
          case 'rise':   g = 1 - v; break;
          case 'fall':   g = v; break;
          case 'tide':   g = (1 - v) * 0.9 + 0.05 + 0.05 * Math.sin(u * 9 + v * 3); break;
          default:       g = 0.5;
        }
        g = clamp(g + (nz(u * 3.4 * ar, v * 3.4) - 0.5) * 0.34);
        const n = 0.58 * BAYER[(y & 7) * 8 + (x & 7)] / 64 + 0.42 * rnd();
        t[i] = Math.min(254, ((g * (1 - soft) + n * soft) * 255) | 0);
      }
    }
    thrCache.set(wipe, t);
    return t;
  }

  function paint(c, drop, q) {
    const w = canvas.width, h = canvas.height;
    if (drop.paint) { drop.paint(c, w, h); return; }
    const conf = drop.conf;
    if (!drop.ready) { c.fillStyle = conf.tone; c.fillRect(0, 0, w, h); return; }
    const img = drop.img;
    const z = lerp(conf.zoom[0], conf.zoom[1], reduce ? 0.5 : q);
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight) * z;
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    c.drawImage(img, (w - dw) * conf.focus[0], (h - dh) * conf.focus[1], dw, dh);
    // a vignette out of the text corner, so white type holds on bright ground
    const a = conf.scrim;
    const g = c.createLinearGradient(0, h, w * 0.8, h * 0.05);
    g.addColorStop(0, `rgba(7,11,13,${a})`);
    g.addColorStop(0.4, `rgba(7,11,13,${a * 0.64})`);
    g.addColorStop(0.78, `rgba(7,11,13,${a * 0.14})`);
    g.addColorStop(1, 'rgba(7,11,13,0.03)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  }

  function stageAt(pos) {
    let k = 0;
    for (let i = 0; i < runs.length; i++) if (pos >= runs[i].from - T) k = i;
    const r = runs[k];
    if (k > 0 && pos < r.from) return { a: runs[k - 1], b: r, p: (pos - (r.from - T)) / T };
    return { a: r, b: null, p: 0 };
  }
  const push = (r, pos) => clamp((pos - (r.from - T)) / (r.to - r.from + T));

  function draw(pos, st) {
    paint(ctx, st.a.drop, push(st.a, pos));
    if (!st.b) return;
    const p = smooth(clamp(st.p));
    if (p <= 0) return;
    const thr = thresholds(st.b.wipe), lim = Math.round(p * 255);
    for (let i = 0, n = thr.length; i < n; i++) mask32[i] = thr[i] < lim ? 0xFFFFFFFF : 0;
    kctx.putImageData(maskData, 0, 0);
    mctx.globalCompositeOperation = 'source-over';
    mctx.imageSmoothingEnabled = true;
    paint(mctx, st.b.drop, push(st.b, pos));
    mctx.globalCompositeOperation = 'destination-in';
    mctx.imageSmoothingEnabled = false;
    mctx.drawImage(mask, 0, 0, mix.width, mix.height);
    ctx.drawImage(mix, 0, 0);
  }

  /* ───────────── scene state ───────────── */
  let active, rot = 0, lastBlur = -1, lastRail = null, lastTheme = '', lastZone = '';

  function applyGrid(b) {
    if (!b) return;
    const cs = getComputedStyle(b.el);
    root.style.setProperty('--gy', cs.getPropertyValue('--gy').trim() || '.72');
    root.style.setProperty('--gx', cs.getPropertyValue('--gx').trim() || '.86');
  }

  function setRail(key) {
    if (key === lastRail) return;
    lastRail = key;
    railLinks.forEach(a => a.classList.toggle('on', a.dataset.rail === key));
  }

  function ui(pos, st, inFlow) {
    let act = null;
    for (const b of beats) if (pos >= b.on && pos < b.off) act = b;
    if (act !== active) {
      if (active) active.el.classList.remove('is-on');
      if (act) {
        act.el.classList.add('is-on');
        applyGrid(act);
        rot += 90;
        root.style.setProperty('--rot', rot);
      }
      groups.forEach(g => g.classList.toggle('is-on', !!act && act.group === g));
      withs.forEach(w => w.el.classList.toggle('is-on', !!act && w.ids.includes(act.id)));
      fors.forEach(f => f.classList.toggle('on', !!act && f.dataset.for === act.id));
      if (window.EpochTable) window.EpochTable.phase(act && act.group && act.group.classList.contains('match') ? act.id : null);
      active = act;
    }

    const zone = inFlow ? 'flow' : 'stage';
    if (zone !== lastZone) body.dataset.zone = lastZone = zone;

    const theme = inFlow ? 'dark' : (st.b && st.p > 0.5 ? st.b : st.a).drop.theme;
    if (theme !== lastTheme) body.dataset.theme = lastTheme = theme;

    if (inFlow) {
      let key = sections.length ? sections[0].dataset.section : null;
      const line = innerHeight * 0.5;
      for (const s of sections) if (s.getBoundingClientRect().top <= line) key = s.dataset.section;
      setRail(key);
    } else if (act) {
      setRail(act.rail || null);
    }

    // the hero opens out of focus, the way a held breath does
    const blur = reduce ? 0 : 1 - smooth(clamp(pos / 0.78));
    if (Math.abs(blur - lastBlur) > 0.002) {
      lastBlur = blur;
      canvas.style.filter = blur > 0.004 ? `blur(${(blur * 17).toFixed(2)}px) saturate(${(1 + blur * 0.18).toFixed(3)})` : '';
      canvas.style.transform = blur > 0.004 ? `scale(${(1 + blur * 0.075).toFixed(4)})` : '';
    }
  }

  /* ───────────── loop ───────────── */
  let target = 0, cur = 0, raf = 0, dirty = true, last = 0;

  function measure() { trackTop = track.getBoundingClientRect().top + scrollY; }
  function onScroll() {
    target = clamp((scrollY - trackTop) / vh, 0, total);
    kick(true);
  }
  function kick(force) { if (force) dirty = true; if (!raf) raf = requestAnimationFrame(frame); }
  function frame(now) {
    raf = 0;
    // ease toward the scroll position by elapsed time, so a slow frame rate never leaves the stage behind
    const dt = last ? Math.min(now - last, 2000) : 16;
    last = now;
    const d = target - cur;
    cur = reduce || Math.abs(d) < 0.0006 ? target : cur + d * (1 - Math.exp(-dt / 95));
    const y = scrollY;
    const past = y > trackTop + (total + 1) * vh;        // the stage has scrolled away entirely
    const inFlow = y > trackTop + (total + 0.4) * vh;
    const st = stageAt(cur);
    if (!past && (dirty || cur !== target)) draw(cur, st);
    ui(cur, st, inFlow);
    dirty = false;
    if (cur !== target) kick(); else last = 0;
  }

  function resize() {
    const w = pin.clientWidth, h = pin.clientHeight;
    measure();
    if (w !== W || h !== H) {
      W = w; H = h; vh = h;
      const dpr = Math.min(window.devicePixelRatio || 1, W > 1500 ? 1.25 : 1.5);
      canvas.width = mix.width = Math.round(W * dpr);
      canvas.height = mix.height = Math.round(H * dpr);
      gw = Math.ceil(W / CELL); gh = Math.ceil(H / CELL);
      mask.width = gw; mask.height = gh;
      maskData = kctx.createImageData(gw, gh);
      mask32 = new Uint32Array(maskData.data.buffer);
      thrCache.clear();
      ctx.imageSmoothingQuality = mctx.imageSmoothingQuality = 'high';
      clouds();
    }
    applyGrid(active);
    if (window.EpochTable) window.EpochTable.resize();
    target = clamp((scrollY - trackTop) / vh, 0, total);
    cur = target;
    kick(true);
  }

  /* ───────────── halftone clouds ───────────── */
  function clouds() {
    $$('canvas[data-cloud]').forEach(cv => {
      const cw = cv.clientWidth, ch = cv.clientHeight;
      if (!cw || !ch) return;
      const seed = +cv.dataset.cloud || 1, rnd = mulberry(seed * 9973), nz = makeNoise(seed * 131);
      const d = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(cw * d); cv.height = Math.round(ch * d);
      const c = cv.getContext('2d');
      c.scale(d, d);
      const pitch = clamp(cw / 120, 3.6, 6.4), base = ch * 0.76;
      const blobs = [], n = 5 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const r = cw * (0.085 + 0.1 * Math.sin(Math.PI * t) + rnd() * 0.035);
        blobs.push([cw * (0.15 + 0.7 * t + (rnd() - 0.5) * 0.06), base - r * (0.5 + rnd() * 0.4), r]);
      }
      for (let row = 0, y = pitch / 2; y < ch; y += pitch * 0.866, row++) {
        for (let x = row % 2 ? pitch : pitch / 2; x < cw; x += pitch) {
          let dens = 0;
          for (const [bx, by, br] of blobs) {
            const dd = Math.hypot(x - bx, (y - by) * 1.06) / br;
            if (dd < 1) dens = Math.max(dens, 1 - dd * dd);
          }
          if (y > base) dens *= clamp(1 - (y - base) / (pitch * 1.6));
          dens *= 0.7 + 0.6 * nz(x / cw * 7, y / ch * 4);
          const rad = pitch * 0.56 * Math.pow(clamp(dens * 1.3), 0.72);
          if (rad < 0.3) continue;
          const lit = clamp(1 - (y - (base - ch * 0.56)) / (ch * 0.66));
          c.fillStyle = `rgba(${Math.round(lerp(206, 255, lit))},${Math.round(lerp(204, 250, lit))},${Math.round(lerp(196, 236, lit))},${lerp(0.7, 1, lit).toFixed(3)})`;
          c.beginPath(); c.arc(x, y, rad, 0, 6.2832); c.fill();
        }
      }
    });
  }

  /* ───────────── navigation ───────────── */
  const menuBtn = $('.menu-btn');
  function setMenu(open) {
    body.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
  }
  menuBtn.addEventListener('click', () => setMenu(!body.classList.contains('menu-open')));
  addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    setMenu(false);
    if (!a.getAttribute('href').startsWith('#')) return;
    const beat = a.dataset.goto && beats.find(b => b.id === a.dataset.goto);
    if (beat) {
      e.preventDefault();
      scrollTo({ top: trackTop + (beat.start + 0.02) * vh, behavior: reduce ? 'auto' : 'smooth' });
    }
  });

  /* ───────────── flow reveals ───────────── */
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.12 })
    : null;
  $$('[data-reveal]').forEach((el, i) => {
    el.style.transitionDelay = `${(i % 4) * 70}ms`;
    io ? io.observe(el) : el.classList.add('in');
  });

  // the stage never scrolls inside itself, even if focus or a script asks it to
  pin.addEventListener('scroll', () => { if (pin.scrollTop || pin.scrollLeft) pin.scrollTop = pin.scrollLeft = 0; });

  /* ───────────── go ───────────── */
  let rz = 0;
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(resize, 120); });
  addEventListener('load', resize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); kick(true); });
  resize();
})();
