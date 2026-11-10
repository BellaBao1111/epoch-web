/* Epoch — the war table.
   An illustrated match drawn in ink on the paper backdrop: scout, build, order, fight.
   Every frame is a pure function of (phase, time), so each phase loops cleanly and can be
   posed at any moment with EpochTable.at(phase, seconds). It is a drawing of the rules, not
   captured footage, and the page says so. */
(() => {
  'use strict';

  const cv = document.querySelector('.table');
  if (!cv) return;
  const c = cv.getContext('2d');
  const plate = cv.closest('.match-plate');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const INK = '#2e2109', BLUE = '#1d4c9b', RUST = '#a8452b', PAPER = '#f2ebdc', GILT = '#c39a3c';
  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ss = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  /* ───────────── the map ───────────── */
  const HQ = { x: 300, y: 720 }, EHQ = { x: 1330, y: 270 }, VIL = { x: 830, y: 520 }, SEAM = { x: 506, y: 546 };
  const FARM = { x: 404, y: 846 }, CAMP = { x: 170, y: 620 }, BARR = { x: 470, y: 750 };
  const FORD = { x: 585, y: 612 };
  const RIVER = [[700, -40], [655, 150], [560, 330], [602, 500], [574, 640], [604, 800], [660, 1040]];
  const HILLS = [[1120, 566, 20], [1196, 528, 26], [1264, 604, 20], [330, 172, 24], [250, 210, 18], [90, 880, 22], [1500, 186, 22], [1440, 884, 24], [770, 150, 20], [1010, 620, 16]];

  function mkPath(pts) {
    const L = [0];
    for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { pts, L, len: L[L.length - 1] };
  }
  function at(path, d) {
    d = clamp(d, 0, path.len);
    let i = 1;
    while (i < path.L.length - 1 && path.L[i] < d) i++;
    const a = path.pts[i - 1], b = path.pts[i], u = (d - path.L[i - 1]) / ((path.L[i] - path.L[i - 1]) || 1);
    return { x: lerp(a[0], b[0], u), y: lerp(a[1], b[1], u), a: Math.atan2(b[1] - a[1], b[0] - a[0]) };
  }
  // march along a path between two moments, easing a little at both ends
  function march(path, t, t0, t1) {
    const u = clamp((t - t0) / (t1 - t0)), p = at(path, path.len * (u * 0.6 + ss(0, 1, u) * 0.4));
    p.moving = u > 0 && u < 1;
    return p;
  }
  function trail(path, d, r, step = 55) {
    const out = [];
    for (let q = 0; q <= d; q += step) { const p = at(path, q); out.push({ x: p.x, y: p.y, r }); }
    return out;
  }

  const ROAD = mkPath([[318, 712], [430, 676], [585, 612], [700, 560], [818, 524], [980, 440], [1140, 360], [1312, 280]]);
  const P_SCOUT = mkPath([[352, 704], [430, 676], [585, 612], [700, 566], [754, 558]]);
  const P_SWORD = mkPath([[468, 706], [585, 612], [700, 560], [788, 538]]);
  const P_ARCH = mkPath([[416, 724], [585, 616], [682, 574], [728, 580]]);
  const P_E1 = mkPath([[1230, 318], [1140, 360], [1012, 428]]);
  const P_E2 = mkPath([[1290, 290], [1180, 342], [1070, 398]]);
  const P_S1 = mkPath([[896, 494], [968, 452]]);
  const P_S2 = mkPath([[968, 452], [1036, 414]]);
  const P_S3 = mkPath([[1036, 414], [1140, 360], [1262, 306]]);
  const P_A1 = mkPath([[858, 550], [924, 508]]);
  const P_A2 = mkPath([[924, 508], [1010, 440], [1180, 336]]);
  const P_C1 = mkPath([[790, 584], [886, 540]]);
  const P_C2 = mkPath([[886, 540], [1010, 462], [1116, 396]]);
  const EXPLORED = trail(P_SCOUT, P_SCOUT.len, 150);

  // woods: scattered once, kept clear of the road, the river and every building site
  const TREES = (() => {
    const keep = [HQ, EHQ, VIL, SEAM, FARM, CAMP, BARR, { x: 468, y: 706 }, { x: 416, y: 724 }, { x: 542, y: 672 }, { x: 352, y: 704 }];
    const lines = [];
    for (let q = 0; q <= ROAD.len; q += 18) lines.push(at(ROAD, q));
    const rv = mkPath(RIVER);
    for (let q = 0; q <= rv.len; q += 18) lines.push(at(rv, q));
    const woods = [[150, 500, 128, 80, 30], [430, 296, 96, 70, 17], [938, 316, 118, 60, 20], [1085, 772, 150, 88, 26], [1474, 600, 80, 112, 13], [706, 904, 112, 60, 13], [1180, 92, 124, 52, 11], [60, 250, 70, 90, 8]];
    const out = [];
    let k = 1;
    for (const [cx, cy, rx, ry, n] of woods) {
      for (let i = 0, placed = 0; i < n * 4 && placed < n; i++) {
        const a = hash(k++) * TAU, r = Math.sqrt(hash(k++));
        const x = cx + Math.cos(a) * rx * r, y = cy + Math.sin(a) * ry * r;
        if (keep.some(p => Math.hypot(p.x - x, p.y - y) < 46)) continue;
        if (lines.some(p => Math.hypot(p.x - x, p.y - y) < 30)) continue;
        if (out.some(p => Math.hypot(p.x - x, p.y - y) < 13)) continue;
        out.push({ x, y });
        placed++;
      }
    }
    return out.sort((a, b) => a.y - b.y);
  })();

  /* ───────────── view ───────────── */
  let W = 0, H = 0, dpr = 1, s = 1, g = 1;
  const cam = { x: 0, y: 0 };
  const SX = x => (x - cam.x) * s + W / 2;
  const SY = y => (y - cam.y) * s + H / 2;

  function size() {
    const w = plate.clientWidth, h = plate.clientHeight;
    if (!w || !h) return false;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w !== W || h !== H || cv.width !== Math.round(w * dpr)) {
      W = w; H = h;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    }
    return true;
  }

  const line = (w, col = INK) => { c.lineWidth = w; c.strokeStyle = col; c.stroke(); };
  const fill = col => { c.fillStyle = col; c.fill(); };
  function sym(x, y, fn, scale = 1) {
    c.save(); c.translate(SX(x), SY(y)); c.scale(g * scale, g * scale); fn(); c.restore();
  }
  function star(r) {
    const k = r * 0.16;
    c.beginPath(); c.moveTo(0, -r);
    c.bezierCurveTo(k, -k, k, -k, r, 0); c.bezierCurveTo(k, k, k, k, 0, r);
    c.bezierCurveTo(-k, k, -k, k, -r, 0); c.bezierCurveTo(-k, -k, -k, -k, 0, -r);
    c.closePath();
  }
  function text(str, x, y, o = {}) {
    c.save();
    c.font = `${o.w || 500} ${o.size || 8.5}px "Geist Mono", ui-monospace, Menlo, monospace`;
    if ('letterSpacing' in c) c.letterSpacing = '1.7px';
    c.textAlign = o.align || 'center'; c.textBaseline = 'middle';
    c.globalAlpha *= o.a == null ? 1 : o.a;
    c.lineJoin = 'round'; c.lineWidth = 3.2; c.strokeStyle = PAPER; c.strokeText(str.toUpperCase(), x, y);
    c.fillStyle = o.col || INK; c.fillText(str.toUpperCase(), x, y);
    c.restore();
  }

  /* ───────────── map symbols (drawn about their base point) ───────────── */
  function gTree() {
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -3.6); line(1.1);
    c.beginPath(); c.arc(0, -7.4, 4.3, 0, TAU); fill(PAPER); line(1.05);
    c.beginPath(); c.arc(0.7, -7, 2.3, -0.8, 1.2); line(0.8);
  }
  function gHouse(x, w, h, roof, col, door) {
    c.beginPath(); c.rect(x - w / 2, -h, w, h); fill(PAPER); line(1.15);
    c.beginPath(); c.moveTo(x - w / 2 - 1.6, -h); c.lineTo(x, -h - roof); c.lineTo(x + w / 2 + 1.6, -h); c.closePath(); fill(col); line(1.15);
    if (door) { c.beginPath(); c.moveTo(x - 1.7, 0); c.lineTo(x - 1.7, -3.4); c.arc(x, -3.4, 1.7, Math.PI, 0); c.lineTo(x + 1.7, 0); line(0.9); }
  }
  function gFlag(x, y, col, t, len = 9.5) {
    const w = Math.sin(t * 5 + x) * 0.9;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 11); line(1);
    c.beginPath(); c.moveTo(x, y - 11); c.quadraticCurveTo(x + len * 0.5, y - 10.4 + w, x + len, y - 8.4 - w); c.lineTo(x, y - 6); c.closePath(); fill(col); line(0.7);
  }
  function gCapital(side, hp, t) {
    const col = side ? RUST : BLUE;
    if (hp <= 0) {                                             // rubble
      c.beginPath(); c.moveTo(-15, 0); c.lineTo(-15, -5); c.lineTo(-9, -3); c.lineTo(-6, -8); c.lineTo(-1, -2); c.lineTo(4, -6); c.lineTo(8, -1); c.lineTo(13, -9); c.lineTo(17, -4); c.lineTo(17, 0); c.closePath(); fill(PAPER); line(1.15);
      c.beginPath(); c.moveTo(-11, 0); c.lineTo(-7, -2.4); c.moveTo(1, 0); c.lineTo(5, -2.6); c.moveTo(9, 0); c.lineTo(12, -3); line(0.9);
      for (let i = 0; i < 4; i++) {                             // smoke
        const u = (t * 0.45 + i * 0.25) % 1;
        c.save(); c.globalAlpha *= 1 - u; c.beginPath(); c.arc(-4 + i * 5 + Math.sin(u * 6 + i) * 2, -8 - u * 22, 2 + u * 4, 0, TAU); line(0.9); c.restore();
      }
      return;
    }
    gHouse(-4, 21, 11, 9, col, true);
    c.beginPath(); c.rect(8, -22, 9, 22); fill(PAPER); line(1.15);
    c.beginPath(); c.rect(8, -24.4, 2.2, 2.4); c.rect(11.4, -24.4, 2.2, 2.4); c.rect(14.8, -24.4, 2.2, 2.4); fill(PAPER); line(0.9);
    c.beginPath(); c.moveTo(11, -15); c.lineTo(11, -11); c.moveTo(14, -15); c.lineTo(14, -11); line(0.9);
    if (side) { c.beginPath(); c.rect(-11, -22, 3.2, 5.4); fill(PAPER); line(1); }
    gFlag(12.5, -24.4, col, t);
    if (hp < 0.6) {                                              // burning
      for (let i = 0; i < 3; i++) {
        const u = (t * 0.7 + i * 0.33) % 1;
        c.save(); c.globalAlpha *= (1 - u) * 0.9; c.beginPath(); c.arc(-6 + i * 6, -19 - u * 16, 1.6 + u * 3.4, 0, TAU); line(0.9); c.restore();
      }
    }
  }
  function gVillage(own, t) {
    gHouse(-8, 10, 6, 5, PAPER, true);
    gHouse(5, 12, 7, 6, PAPER, true);
    c.beginPath(); c.moveTo(-1, 0); c.lineTo(-1, -17); line(1);
    c.beginPath(); c.moveTo(-1, -17); c.lineTo(8.5, -14.6); c.lineTo(-1, -11.4); c.closePath(); fill(PAPER); line(0.8);
    if (own > 0) { c.save(); c.globalAlpha *= own; c.beginPath(); c.moveTo(-1, -17); c.lineTo(8.5, -14.6); c.lineTo(-1, -11.4); c.closePath(); fill(BLUE); line(0.8); c.restore(); }
  }
  function gFarm() {
    c.beginPath(); c.moveTo(-17, 3); c.lineTo(8, 3); c.lineTo(14, -7); c.lineTo(-11, -7); c.closePath(); fill('rgba(195,154,60,.2)'); line(1);
    c.beginPath(); for (let i = 1; i < 5; i++) { c.moveTo(-17 + i * 5, 3); c.lineTo(-11 + i * 5, -7); } line(0.7);
    c.save(); c.translate(15, -7); gHouse(0, 8, 5, 4.4, BLUE, false); c.restore();
  }
  function gCamp() {
    gHouse(3, 13, 6.5, 5.4, BLUE, false);
    for (const [x, y] of [[-11, -1.9], [-14.6, -1.9], [-12.8, -5]]) { c.beginPath(); c.arc(x, y, 1.9, 0, TAU); fill(PAPER); line(0.95); }
    c.beginPath(); c.moveTo(-7, 0); c.lineTo(-7, -4.4); line(1.1);
  }
  function gBarracks(t) {
    gHouse(0, 25, 8, 6.4, BLUE, true);
    c.beginPath(); c.moveTo(-15, 4); c.lineTo(15, 4); for (let i = -15; i <= 15; i += 5) { c.moveTo(i, 4); c.lineTo(i, 1.2); } line(0.9);
    gFlag(-12.5, -8, BLUE, t, 8);
  }
  function gSeam() {
    c.beginPath(); c.moveTo(-9, 0); c.lineTo(-4.5, -8); c.lineTo(-0.5, -3.6); c.lineTo(4, -10); c.lineTo(9.5, 0); c.closePath(); fill(PAPER); line(1.1);
    for (const [x, y] of [[-3.6, -3], [3.4, -4.8], [5.4, -1.8]]) { c.beginPath(); c.arc(x, y, 1.25, 0, TAU); fill(GILT); }
  }

  /* ───────────── soldiers ───────────── */
  const KINDS = {
    sword:  { n: 12, cols: 4, cg: 6.6, rg: 6.4, name: 'Swordsmen' },
    spear:  { n: 12, cols: 4, cg: 6.6, rg: 6.4, name: 'Spearmen' },
    bow:    { n: 10, cols: 5, cg: 6.4, rg: 6.8, name: 'Archers' },
    xbow:   { n: 8,  cols: 4, cg: 6.6, rg: 6.8, name: 'Crossbowmen' },
    knight: { n: 6,  cols: 3, cg: 10.5, rg: 12, name: 'Knights' },
    cat:    { n: 3,  cols: 3, cg: 17, rg: 12, name: 'Catapults' },
  };
  function figure(kind, col, dir, t, mode, i, fire) {
    c.lineCap = 'round';
    if (kind === 'cat') {
      c.beginPath(); c.moveTo(-6.4, -1.8); c.lineTo(6.4, -1.8); line(1.6);
      c.beginPath(); c.moveTo(-2.4 * dir, -1.8); c.lineTo(0.6 * dir, -8.6); c.lineTo(3.6 * dir, -1.8); line(1.1);
      for (const x of [-4.4, 4.4]) { c.beginPath(); c.arc(x, -1.9, 2.1, 0, TAU); fill(PAPER); line(1.05); }
      const a = lerp(2.52, 5.36, fire);                          // arm: cocked low behind → swung up and over
      const ax = 0.6 * dir + Math.cos(a) * 8.6 * dir, ay = -8.6 + Math.sin(a) * 8.6;
      c.beginPath(); c.moveTo(0.6 * dir, -8.6); c.lineTo(ax, ay); line(1.25);
      c.beginPath(); c.arc(ax, ay, 1.3, 0, TAU); fill(col);
      return;
    }
    if (kind === 'knight') {
      const gal = mode === 'march' ? Math.sin(t * 11 + i * 1.3) : 0;
      c.beginPath();
      c.moveTo(-3 * dir, -3.2); c.lineTo((-3.6 - gal * 1.6) * dir, 0); c.moveTo(-1.6 * dir, -3.2); c.lineTo((-1.4 + gal * 1.4) * dir, 0);
      c.moveTo(2 * dir, -3.2); c.lineTo((2.2 - gal * 1.5) * dir, 0); c.moveTo(3.2 * dir, -3.2); c.lineTo((4 + gal * 1.7) * dir, 0);
      line(0.95);
      c.beginPath(); c.ellipse(0, -4.6, 4.5, 2.2, 0, 0, TAU); fill(INK);
      c.beginPath(); c.rect(-1.7, -6.2, 3.4, 2.6); fill(col);
      c.beginPath(); c.moveTo(3.2 * dir, -5.4); c.lineTo(5.5 * dir, -8.6); c.lineTo(7.2 * dir, -7.6); line(1.9);
      c.beginPath(); c.moveTo(-4.4 * dir, -5); c.lineTo(-6.2 * dir, -2.8); line(1);
      c.beginPath(); c.moveTo(-0.4 * dir, -6.4); c.lineTo(-0.4 * dir, -9.8); line(1.25);
      c.beginPath(); c.arc(-0.4 * dir, -11.1, 1.45, 0, TAU); fill(INK);
      const lz = mode === 'fight' ? Math.max(0, Math.sin(t * 6 + i * 2)) * 2 : 0;
      c.beginPath(); c.moveTo((0.6 + lz) * dir, -8.2); c.lineTo((8 + lz) * dir, -13.4); line(0.9);
      return;
    }
    const pulse = mode === 'fight' ? Math.pow(Math.max(0, Math.sin(t * 6.4 + i * 2.1)), 3) : 0;
    const stride = mode === 'march' ? Math.sin(t * 10 + i * 1.7) * 1.4 : 0;
    c.beginPath(); c.moveTo(0, -3.5); c.lineTo(-stride, 0); c.moveTo(0, -3.5); c.lineTo(stride, 0); line(1.05);
    c.beginPath(); c.moveTo(0, -3.5); c.lineTo(0, -7.2); line(1.3);
    c.beginPath(); c.arc(0, -8.7, 1.55, 0, TAU); fill(INK);
    if (kind === 'worker') { c.beginPath(); c.arc(1.6 * dir, -6.2, 1.2, 0, TAU); fill(GILT); return; }
    if (kind === 'bow' || kind === 'xbow') {
      const base = dir > 0 ? 0 : Math.PI;
      c.beginPath(); c.arc(2.2 * dir, -5.8, 3, base - 1.15, base + 1.15); line(1.2, col);
      c.beginPath(); c.moveTo(2.2 * dir + Math.cos(base - 1.15) * 3, -5.8 + Math.sin(base - 1.15) * 3); c.lineTo(2.2 * dir + Math.cos(base + 1.15) * 3, -5.8 + Math.sin(base + 1.15) * 3); line(0.6);
      return;
    }
    if (kind === 'spear') { c.beginPath(); c.moveTo(-1.2 * dir + pulse * 3 * dir, -1.4); c.lineTo(0.6 * dir + pulse * 4.4 * dir, -13); line(0.9); }
    else { const a = lerp(1.3, 0.05, pulse); c.beginPath(); c.moveTo(-0.6 * dir, -6.4); c.lineTo((-0.6 + Math.cos(a) * 4.4) * dir, -6.4 - Math.sin(a) * 4.4); line(1); }
    c.beginPath(); c.arc(1.7 * dir, -4.9, 2.05, 0, TAU); fill(col); line(0.6);
  }

  function army(a, t) {
    const K = KINDS[a.kind], col = a.side ? RUST : BLUE;
    const fx = Math.cos(a.face), fy = Math.sin(a.face), dir = fx >= 0 ? 1 : -1;
    const alive = Math.max(a.hp > 0 ? 1 : 0, Math.ceil(K.n * a.hp));
    const rows = Math.ceil(K.n / K.cols);
    const slots = [];
    for (let i = 0; i < K.n; i++) {
      if (rankOf(a.seed, i, K.n) >= alive) continue;
      const row = Math.floor(i / K.cols), colm = i % K.cols;
      let lx = -row * K.rg - 3, ly = (colm - (K.cols - 1) / 2) * K.cg;
      if (a.mode === 'fight' && a.kind !== 'bow' && a.kind !== 'xbow' && a.kind !== 'cat') {
        lx += Math.pow(Math.max(0, Math.sin(t * 6.4 + i * 2.1)), 3) * (row === 0 ? 3.4 : 1.4);
      }
      slots.push({ i, x: fx * lx - fy * ly, y: (fy * lx + fx * ly) * 0.78 });
    }
    slots.sort((p, q) => p.y - q.y);
    c.save();
    c.translate(SX(a.x), SY(a.y)); c.scale(g, g);
    c.globalAlpha *= a.alpha == null ? 1 : a.alpha;
    if (a.sel > 0) {                                             // selection ring on the ground
      c.save(); c.globalAlpha *= a.sel; c.beginPath(); c.ellipse(-fx * rows * K.rg * 0.4, -fy * rows * K.rg * 0.3, K.cols * K.cg * 0.72 + 6, (K.cols * K.cg * 0.72 + 6) * 0.62, 0, 0, TAU); c.setLineDash([3, 3]); line(1, col); c.restore();
    }
    for (const p of slots) {
      c.save(); c.translate(p.x, p.y);
      const bob = a.mode === 'march' && a.kind !== 'cat' ? Math.abs(Math.sin(t * 10 + p.i * 1.7)) * -0.8 : 0;
      c.translate(0, bob);
      figure(a.kind, col, dir, t, a.mode, p.i, a.fire ? a.fire(p.i) : 0);
      c.restore();
    }
    // the banner: what the player actually holds and drags
    const bx = -fx * (rows * K.rg * 0.5 + 2), by = -fy * (rows * K.rg * 0.5 + 2) * 0.78 - 1;
    const tilt = a.hp <= 0 ? 1.1 : 0;
    c.save(); c.translate(bx, by); c.rotate(tilt * dir);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -22); line(1.2);
    const wv = Math.sin(t * 4.6 + a.seed) * 1.1;
    c.beginPath(); c.moveTo(0, -22); c.quadraticCurveTo(6 * dir, -21.4 + wv, 12.5 * dir, -19.4 - wv); c.lineTo(8.6 * dir, -17.4); c.lineTo(12.5 * dir, -15 + wv); c.quadraticCurveTo(6 * dir, -14.4 - wv, 0, -15); c.closePath(); fill(col); line(0.8);
    c.restore();
    if (a.hp > 0 && a.hp < 1 || a.mode === 'fight') {              // health, only once it matters
      c.beginPath(); c.rect(bx - 9, by - 28, 18, 2.6); fill(PAPER); line(0.7);
      c.beginPath(); c.rect(bx - 9, by - 28, 18 * clamp(a.hp), 2.6); fill(col);
    }
    c.restore();
  }
  // a fixed order in which each army loses its soldiers
  const RANKS = {};
  function rankOf(seed, i, n) {
    const key = seed + ':' + n;
    if (!RANKS[key]) {
      const idx = Array.from({ length: n }, (_, k) => k).sort((p, q) => hash(seed * 17 + p) - hash(seed * 17 + q));
      RANKS[key] = idx.reduce((m, v, k) => (m[v] = k, m), []);
    }
    return RANKS[key][i];
  }

  /* ───────────── fog of war: a halftone screen that parts where you can see ───────────── */
  function clearAt(x, y, src) {
    let m = 0;
    for (let k = 0; k < src.length; k++) {
      const q = src[k], dx = x - q.x, dy = y - q.y, r = q.r;
      if (dx > r || dx < -r || dy > r || dy < -r) continue;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d >= r) continue;
      const v = 1 - ss(r * 0.6, r, d);
      if (v > m) { m = v; if (m >= 1) break; }
    }
    return m;
  }
  function fog(src, mem) {
    const P = 8.5 / s, row = P * 0.866;
    const x0 = cam.x - W / 2 / s - P, x1 = cam.x + W / 2 / s + P, y0 = cam.y - H / 2 / s - P, y1 = cam.y + H / 2 / s + P;
    c.beginPath();
    for (let j = Math.floor(y0 / row); j * row < y1; j++) {
      const wy = j * row, off = j & 1 ? P / 2 : 0;
      for (let i = Math.floor(x0 / P); i * P < x1; i++) {
        const wx = i * P + off;
        let cl = clearAt(wx, wy, src);
        if (mem && cl < 0.62) cl = Math.max(cl, memAt(mem, wx, wy) * 0.62);
        if (cl > 0.95) continue;
        const r = P * s * 0.42 * Math.pow(1 - cl, 0.9);
        if (r < 0.3) continue;
        const px = SX(wx), py = SY(wy);
        c.moveTo(px + r, py); c.arc(px, py, r, 0, TAU);
      }
    }
    c.fillStyle = 'rgba(46,33,9,.3)';
    c.fill();
  }

  /* ───────────── terrain ───────────── */
  function smooth(pts) {
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) c.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
    c.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
  }
  function terrain(sc) {
    const px = n => n / s;
    c.lineCap = 'round'; c.lineJoin = 'round';
    if (sc.terr > 0) {                                           // your territory: you may only build inside it
      c.save(); c.globalAlpha = sc.terr; c.setLineDash([px(5), px(5)]);
      c.beginPath(); c.arc(HQ.x, HQ.y, 212, 0, TAU); line(px(1.1), BLUE);
      c.globalAlpha = sc.terr * 0.035; fill(BLUE); c.restore();
    }
    for (const [x, y, r] of HILLS) {
      c.beginPath(); c.arc(x, y, r, Math.PI * 1.06, Math.PI * 1.94); line(px(1.1), 'rgba(46,33,9,.7)');
      c.beginPath();
      for (let i = 0; i < 6; i++) { const a = Math.PI * (1.14 + i * 0.145); c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); c.lineTo(x + Math.cos(a) * (r - 7), y + Math.sin(a) * (r - 7) + 4); }
      line(px(0.8), 'rgba(46,33,9,.55)');
    }
    smooth(RIVER);
    c.lineWidth = 17; c.strokeStyle = 'rgba(46,33,9,.85)'; c.stroke();
    c.globalCompositeOperation = 'destination-out'; c.lineWidth = 17 - px(2.4); c.strokeStyle = '#000'; c.stroke();
    c.globalCompositeOperation = 'source-over'; c.strokeStyle = 'rgba(29,76,155,.15)'; c.stroke();
    c.setLineDash([4, 15]); c.lineWidth = px(1); c.strokeStyle = 'rgba(29,76,155,.55)'; c.stroke(); c.setLineDash([]);
    // the ford
    const fa = Math.atan2(612 - 676, 585 - 430);
    c.save(); c.translate(FORD.x, FORD.y); c.rotate(fa);
    c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000'; c.fillRect(-17, -5, 34, 10); c.globalCompositeOperation = 'source-over';
    c.beginPath(); c.moveTo(-17, -5); c.lineTo(17, -5); c.moveTo(-17, 5); c.lineTo(17, 5); line(px(1.2));
    c.restore();
    c.beginPath(); c.moveTo(ROAD.pts[0][0], ROAD.pts[0][1]); for (const p of ROAD.pts) c.lineTo(p[0], p[1]);
    c.setLineDash([7, 6]); line(px(1.1), 'rgba(46,33,9,.5)'); c.setLineDash([]);
  }

  /* ───────────── things in flight ───────────── */
  function volley(out, t, from, to, t0, t1, every, n, seed, lift, side) {
    for (let k = 0, tk = t0; tk < t1; k++, tk = t0 + k * every) {
      for (let i = 0; i < n; i++) {
        const h1 = hash(seed + k * 13 + i), h2 = hash(seed * 3 + k * 7 + i * 5);
        const st = tk + h1 * 0.28, du = 0.55 + h2 * 0.2;
        if (t < st || t > st + du) continue;
        const u = (t - st) / du, u2 = Math.min(1, u + 0.07);
        const ax = from[0] + (h1 - 0.5) * 26, ay = from[1] + (h2 - 0.5) * 16, bx = to[0] + (h2 - 0.5) * 34, by = to[1] + (h1 - 0.5) * 22;
        out.push({ k: 'arrow', side, x: lerp(ax, bx, u), y: lerp(ay, by, u), z: Math.sin(u * Math.PI) * lift, x2: lerp(ax, bx, u2), y2: lerp(ay, by, u2), z2: Math.sin(u2 * Math.PI) * lift });
      }
    }
  }
  const ROCK_FLIGHT = 1.05;
  function rocks(out, t, from, to, t0, t1, every, seed) {
    for (let i = 0; i < 3; i++) {
      for (let k = 0, tk = t0 + i * every / 3; tk < t1; k++, tk = t0 + i * every / 3 + k * every) {
        const h = hash(seed + i * 11 + k * 5), bx = to[0] + (h - 0.5) * 30, by = to[1] + (hash(seed + k * 3 + i) - 0.5) * 18;
        const ax = from[0] + (i - 1) * 17, ay = from[1];
        if (t >= tk && t <= tk + ROCK_FLIGHT) {
          const u = (t - tk) / ROCK_FLIGHT;
          out.push({ k: 'rock', x: lerp(ax, bx, u), y: lerp(ay, by, u), z: Math.sin(u * Math.PI) * 52, u, ax, ay, bx, by });
        } else if (t > tk + ROCK_FLIGHT && t < tk + ROCK_FLIGHT + 0.5) {
          out.push({ k: 'hit', x: bx, y: by, u: (t - tk - ROCK_FLIGHT) / 0.5 });
        }
      }
    }
  }
  // how far through its throw catapult i is (0 cocked … 1 released), for the arm
  const throwOf = (t, t0, t1, every) => i => {
    if (t < t0 || t > t1 + 0.4) return 0;
    const ph = ((t - t0 - i * every / 3) % every + every) % every;
    return ph < 0.16 ? ph / 0.16 : 1 - ss(0.3, every * 0.8, ph);
  };
  function sparks(out, t, at_, t0, t1, seed, spread = 30) {
    for (let k = 0, tk = t0; tk < t1; k++, tk = t0 + k * 0.17) {
      if (t < tk || t > tk + 0.22) continue;
      out.push({ k: 'spark', x: at_[0] + (hash(seed + k) - 0.5) * spread, y: at_[1] + (hash(seed * 2 + k) - 0.5) * spread * 0.7, u: (t - tk) / 0.22 });
    }
  }
  function fallen(out, t, at_, t0, t1, n, seed, spread = 44) {
    for (let i = 0; i < n; i++) {
      const ti = lerp(t0, t1, hash(seed + i * 3));
      if (t > ti) out.push({ k: 'x', x: at_[0] + (hash(seed + i) - 0.5) * spread, y: at_[1] + (hash(seed * 5 + i) - 0.5) * spread * 0.7, a: ss(ti, ti + 0.3, t) });
    }
  }
  function workers(out, t, a, b, n, seed) {
    for (let i = 0; i < n; i++) {
      const u = (t * 0.16 + i / n + hash(seed + i)) % 1, v = u < 0.5 ? u * 2 : 2 - u * 2;
      out.push({ x: lerp(a.x, b.x, v), y: lerp(a.y, b.y, v) + 10, dir: (u < 0.5 ? 1 : -1) * Math.sign(b.x - a.x || 1), i: seed + i });
    }
  }
  const sel = (t, a, b) => Math.min(ss(a - 0.2, a, t), 1 - ss(b, b + 0.4, t));
  const stock = (t, f, w, gd, st) => ({ food: Math.floor(f + t * 0.5), wood: Math.floor(w + t * 0.5), gold: Math.floor(gd + t * 0.5), stone: Math.floor(st + t * 0.5) });

  /* ───────────── the four phases ───────────── */
  const SCRIPT = {
    explore: {
      dur: 11.5, poster: 6.4,
      run(t) {
        const k = march(P_SCOUT, t, 1.7, 7.6), d = P_SCOUT.len * clamp((t - 1.7) / 5.9), f = ss(1.7, 7.6, t);
        return {
          cam: [lerp(424, 704, f), lerp(690, 582, f)], span: [560, 400],
          src: [{ x: HQ.x, y: HQ.y, r: 245 }, ...trail(P_SCOUT, d, 150), { x: k.x, y: k.y, r: 172 }],
          armies: [{ seed: 3, side: 0, kind: 'knight', x: k.x, y: k.y, face: k.moving ? k.a : -0.3, mode: k.moving ? 'march' : 'idle', hp: 1, sel: sel(t, 0.4, 2) }],
          builds: [], workers: [], fx: [], vil: 0, ehq: 1, terr: 0.28,
          gest: [{ t0: 0.4, t1: 1.0, t2: 1.7, t3: 7.8, from: [352, 704], to: [770, 552], word: 'Scout', to2: k.moving ? [k.x, k.y] : null }],
          res: stock(t, 80, 105, 95, 105), era: 'I',
          rack: [['Knights', t < 1.7 ? 'Guard' : k.moving ? 'Marching' : 'Holding', 1, k.moving]],
        };
      },
    },
    build: {
      dur: 12.5, poster: 9.2,
      run(t) {
        const pf = clamp((t - 1.9) / 2.5), pc = clamp((t - 4.9) / 2.7), pb = clamp((t - 6.6) / 3.6);
        const r = stock(t, 80, 196, 95, 135);
        if (t > 1.9) r.wood -= 40;
        if (t > 4.9) r.wood -= 50;
        if (t > 6.6) { r.wood -= 60; r.stone -= 30; }
        if (pf >= 1) r.food += Math.floor((t - 4.4) * 2);
        if (pc >= 1) r.wood += Math.floor((t - 7.6) * 2);
        const wk = [];
        if (pf >= 1) workers(wk, t, FARM, HQ, 2, 11);
        if (pc >= 1) workers(wk, t, CAMP, HQ, 2, 23);
        const slots = (pf > 0 && pf < 1 ? 1 : 0) + (pc > 0 && pc < 1 ? 1 : 0) + (pb > 0 && pb < 1 ? 1 : 0);
        return {
          cam: [330 + Math.sin(t * 0.5) * 3, 730], span: [470, 350],
          src: [{ x: HQ.x, y: HQ.y, r: 300 }, ...EXPLORED],
          armies: [{ seed: 3, side: 0, kind: 'knight', x: 352, y: 704, face: -0.3, mode: 'idle', hp: 1 }],
          builds: [{ k: 'farm', at: FARM, p: pf, t0: 1.9, cost: '−40 wood' }, { k: 'camp', at: CAMP, p: pc, t0: 4.9, cost: '−50 wood' }, { k: 'barracks', at: BARR, p: pb, t0: 6.6, cost: '−60 wood · −30 stone' }],
          workers: wk, fx: [], vil: 0, ehq: 1, terr: 0.62, slots,
          gest: [
            { t0: 0.5, t1: 1.2, t2: 1.9, t3: 2.9, from: [336, 752], to: [FARM.x, FARM.y], word: 'Farm' },
            { t0: 3.5, t1: 4.2, t2: 4.9, t3: 5.9, from: [280, 690], to: [CAMP.x, CAMP.y], word: 'Lumber camp' },
            { t0: 5.2, t1: 5.9, t2: 6.6, t3: 7.6, from: [340, 728], to: [BARR.x, BARR.y], word: 'Barracks' },
          ],
          res: r, era: 'I',
          rack: [['Knights', 'Guard', 1, false]],
        };
      },
    },
    command: {
      dur: 13.5, poster: 10.9,
      run(t) {
        const S = march(P_SWORD, t, 4.9, 10), A = march(P_ARCH, t, 6.8, 11.6), f = ss(5.2, 9.6, t);
        const own = ss(10, 12.2, t);
        const armies = [{ seed: 3, side: 0, kind: 'knight', x: 542, y: 672, face: -0.3, mode: 'idle', hp: 1 }];
        if (t > 1.4) armies.push({ seed: 5, side: 0, kind: 'sword', x: S.x, y: S.y, face: S.moving ? S.a : -0.4, mode: S.moving ? 'march' : 'idle', hp: 1, alpha: ss(1.4, 1.9, t), sel: sel(t, 3.6, 5.2) });
        if (t > 2.8) armies.push({ seed: 7, side: 0, kind: 'bow', x: A.x, y: A.y, face: A.moving ? A.a : -0.4, mode: A.moving ? 'march' : 'idle', hp: 1, alpha: ss(2.8, 3.3, t), sel: sel(t, 5.6, 7.1) });
        const wk = [];
        workers(wk, t, FARM, HQ, 2, 11); workers(wk, t, CAMP, HQ, 2, 23);
        const r = stock(t, 150, 120, 110, 110);
        if (t > 0.2) { r.food -= 50; r.gold -= 20; }
        if (t > 1.6) { r.food -= 40; r.wood -= 30; }
        const rack = [['Knights', 'Guard', 1, false]];
        if (t > 1.4) rack.push(['Swordsmen', t < 4.9 ? 'Holding' : S.moving ? 'Marching' : own < 1 ? 'Capturing' : 'Holding', 1, t >= 4.9 && own < 1]);
        if (t > 2.8) rack.push(['Archers', t < 6.8 ? 'Holding' : A.moving ? 'Marching' : 'Guard', 1, A.moving]);
        return {
          cam: [lerp(470, 692, f), lerp(708, 598, f)], span: [590, 415],
          src: [{ x: HQ.x, y: HQ.y, r: 300 }, ...EXPLORED, { x: S.x, y: S.y, r: 160 }, { x: A.x, y: A.y, r: 150 }, { x: VIL.x, y: VIL.y, r: 120 + own * 110 }],
          armies,
          builds: [{ k: 'farm', at: FARM, p: 1 }, { k: 'camp', at: CAMP, p: 1 }, { k: 'barracks', at: BARR, p: 1, train: t < 0.2 ? 0 : t < 1.4 ? (t - 0.2) / 1.2 : t < 1.6 ? 0 : t < 2.8 ? (t - 1.6) / 1.2 : 0, trainWord: t < 1.5 ? 'Swordsmen' : 'Archers' }],
          workers: wk, fx: [], vil: own, capture: t > 10 && own < 1 ? own : 0, ehq: 1, terr: 0.3,
          gest: [
            { t0: 3.6, t1: 4.2, t2: 4.9, t3: 10, from: [468, 706], to: [812, 528], word: 'Capture', to2: S.moving ? [S.x, S.y] : null },
            { t0: 5.6, t1: 6.1, t2: 6.8, t3: 11.6, from: [416, 724], to: [728, 580], word: 'Hold here', to2: A.moving ? [A.x, A.y] : null },
          ],
          res: r, era: 'I', rack,
          note: own >= 1 ? ['Village captured', VIL.x, VIL.y - 62, ss(12.2, 12.6, t)] : null,
        };
      },
    },
    finish: {
      dur: 17, poster: 6,
      run(t) {
        // the line
        let S, sMode, sFace;
        if (t < 3.6) { S = march(P_S1, t, 1.9, 3.6); sMode = S.moving ? 'march' : 'idle'; sFace = S.moving ? S.a : -0.45; }
        else if (t < 7.2) { S = at(P_S1, 1e9); sMode = 'fight'; sFace = -0.47; }
        else if (t < 8) { S = march(P_S2, t, 7.2, 8); sMode = 'march'; sFace = S.a; }
        else if (t < 8.7) { S = at(P_S2, 1e9); sMode = 'fight'; sFace = -0.47; }
        else if (t < 11.6) { S = march(P_S3, t, 8.8, 11.6); sMode = S.moving ? 'march' : 'idle'; sFace = S.moving ? S.a : -0.45; }
        else { S = at(P_S3, 1e9); sMode = t < 14.4 ? 'fight' : 'idle'; sFace = -0.4; }
        const sHp = 1 - 0.3 * clamp((t - 3.6) / 3.6) - 0.08 * clamp((t - 8) / 0.7) - 0.14 * clamp((t - 11.6) / 2.8);
        // the archers behind it
        let A, aMode;
        if (t < 3.8) { A = march(P_A1, t, 2.2, 3.8); aMode = A.moving ? 'march' : 'idle'; }
        else if (t < 8.9) { A = at(P_A1, 1e9); aMode = t < 8.6 ? 'fight' : 'idle'; }
        else { A = march(P_A2, t, 8.9, 11.8); aMode = A.moving ? 'march' : t > 12 && t < 14.4 ? 'fight' : 'idle'; }
        // the catapults, brought up for the capital
        let C, cMode;
        if (t < 9.5) { C = march(P_C1, t, 4.5, 7.5); cMode = C.moving ? 'march' : 'idle'; }
        else { C = march(P_C2, t, 9.5, 12); cMode = C.moving ? 'march' : 'idle'; }
        // the enemy
        const E1 = march(P_E1, t, 0, 3.6), E2 = march(P_E2, t, 0.4, 4);
        const e1Hp = 1 - clamp((t - 3.6) / 3.6), e2Hp = 1 - 0.25 * clamp((t - 7.2) / 0.8) - 0.75 * clamp((t - 8) / 0.66);
        const ehq = 1 - clamp((t - 11.6) / 2.8);
        const pan = ss(8.6, 11.4, t);

        const fx = [];
        volley(fx, t, [A.x, A.y], t < 7.2 ? [1012, 428] : [1070, 398], 3.9, 8.5, 0.95, 6, 41, 26, 0);
        volley(fx, t, [1070, 398], [968, 452], 4.2, 7, 1.1, 4, 67, 22, 1);
        volley(fx, t, [1180, 336], [EHQ.x - 10, EHQ.y - 6], 12, 14.3, 0.95, 6, 83, 28, 0);
        rocks(fx, t, [1116, 396], [EHQ.x, EHQ.y], 12.1, 14.3 - ROCK_FLIGHT, 1.15, 97);
        sparks(fx, t, [992, 440], 3.7, 7.2, 5); sparks(fx, t, [1054, 406], 8, 8.66, 9, 22); sparks(fx, t, [1292, 292], 11.7, 14.4, 13, 26);
        fallen(fx, t, [996, 442], 3.9, 7.2, 13, 21); fallen(fx, t, [1058, 404], 8, 8.66, 6, 33, 34); fallen(fx, t, [1286, 300], 11.9, 14.4, 5, 45, 36);

        const armies = [
          { seed: 5, side: 0, kind: 'sword', x: S.x, y: S.y, face: sFace, mode: sMode, hp: sHp, sel: sel(t, 0.6, 2.3) },
          { seed: 7, side: 0, kind: 'bow', x: A.x, y: A.y, face: -0.45, mode: aMode, hp: 1 },
          { seed: 9, side: 0, kind: 'cat', x: C.x, y: C.y, face: -0.4, mode: cMode, hp: 1, sel: sel(t, 8.3, 9.9), fire: throwOf(t, 12.1, 14.3 - ROCK_FLIGHT, 1.15) },
        ];
        if (e1Hp > 0 || t < 8.2) armies.push({ seed: 11, side: 1, kind: 'spear', x: E1.x, y: E1.y, face: E1.moving ? E1.a : 2.68, mode: E1.moving ? 'march' : e1Hp > 0 ? 'fight' : 'idle', hp: e1Hp, alpha: 1 - ss(7.3, 8.1, t), foe: true });
        if (e2Hp > 0 || t < 9.6) armies.push({ seed: 13, side: 1, kind: 'xbow', x: E2.x, y: E2.y, face: E2.moving ? E2.a : 2.68, mode: E2.moving ? 'march' : e2Hp > 0 && t > 4.2 && t < 8.66 ? 'fight' : 'idle', hp: e2Hp, alpha: 1 - ss(8.7, 9.5, t), foe: true });

        const src = [{ x: VIL.x, y: VIL.y, r: 235 }, ...EXPLORED, { x: S.x, y: S.y, r: 178 }, { x: A.x, y: A.y, r: 165 }, { x: C.x, y: C.y, r: 150 }];
        const r = stock(t, 210, 160, 150, 120);
        return {
          cam: [lerp(978, 1182, pan), lerp(468, 360, pan)], span: [510, 362],
          src, armies, builds: [], workers: [], fx, vil: 1, ehq, ehqShake: t > 11.7 && ehq > 0 ? 1 - ehq * 0.5 : 0, terr: 0, quiet: true,
          gest: [
            { t0: 0.6, t1: 1.2, t2: 1.9, t3: 3.6, from: [896, 494], to: [1006, 432], word: 'Attack', to2: t < 3.6 ? [S.x, S.y] : null },
            { t0: 8.3, t1: 8.9, t2: 9.5, t3: 12, from: [886, 540], to: [EHQ.x - 14, EHQ.y + 8], word: 'Siege', to2: t < 12 ? [C.x, C.y] : null },
          ],
          res: r, era: 'II',
          alert: t > 0.2 && t < 3.4 && Math.sin(t * 9) > -0.3,
          win: t > 14.5,
          rack: [
            ['Swordsmen', sMode === 'fight' ? (t > 11.6 ? 'Sieging' : 'Fighting') : sMode === 'march' ? 'Marching' : 'Holding', sHp, sMode === 'fight'],
            ['Archers', aMode === 'fight' ? 'Loosing' : aMode === 'march' ? 'Marching' : 'Guard', 1, aMode === 'fight'],
            ['Catapults', t > 12.1 && t < 14.4 ? 'Sieging' : cMode === 'march' ? 'Marching' : 'Holding', 1, t > 12.1 && t < 14.4],
            ['Knights', 'Guard', 1, false],
          ],
        };
      },
    },
  };

  /* ───────────── one frame ───────────── */
  function gestures(list, t) {
    for (const q of list) {
      if (t < q.t0 - 0.25 || t > q.t3 + 0.5) continue;
      const fx = SX(q.from[0]), fy = SY(q.from[1]), tx = SX(q.to[0]), ty = SY(q.to[1]);
      c.save(); c.lineCap = 'round';
      if (t < q.t1) {                                            // hold
        const k = ss(q.t0 - 0.25, q.t0, t), r = 12 + Math.sin(t * 9) * 1.4;
        c.globalAlpha = k;
        c.beginPath(); c.arc(fx, fy, r, 0, TAU); fill('rgba(46,33,9,.1)'); line(1.3);
        const u = ((t - q.t0) * 1.6) % 1;
        if (t > q.t0) { c.globalAlpha = k * (1 - u); c.beginPath(); c.arc(fx, fy, r + u * 12, 0, TAU); line(1); }
        c.globalAlpha = k; text('Hold', fx, fy - 24);
      } else if (t < q.t2) {                                     // drag
        const u = (t - q.t1) / (q.t2 - q.t1), e = u * u * (3 - 2 * u), px = lerp(fx, tx, e), py = lerp(fy, ty, e);
        c.beginPath(); c.moveTo(fx, fy); c.lineTo(px, py); line(1.1);
        c.beginPath(); c.arc(fx, fy, 2.2, 0, TAU); fill(INK);
        c.beginPath(); c.arc(px, py, 12, 0, TAU); fill('rgba(46,33,9,.1)'); line(1.3);
        text('Drag', px, py - 24);
      } else {                                                   // release: the order now stands
        const k = t - q.t2, out = 1 - ss(q.t3, q.t3 + 0.5, t);
        c.globalAlpha = out;
        if (k < 0.5) { c.save(); c.globalAlpha = out * (1 - k / 0.5); c.beginPath(); c.arc(tx, ty, 12 + k * 44, 0, TAU); line(1.1); c.restore(); }
        if (q.to2) {
          c.save(); c.setLineDash([2, 5]); c.globalAlpha = out * 0.8;
          c.beginPath(); c.moveTo(SX(q.to2[0]), SY(q.to2[1])); c.lineTo(tx, ty); line(1); c.restore();
        } else if (k < 0.7) {
          c.save(); c.globalAlpha = out * (1 - k / 0.7); c.beginPath(); c.moveTo(fx, fy); c.lineTo(tx, ty); line(1); c.restore();
        }
        const sc = ss(0, 0.28, k) * (1 + 0.45 * (1 - ss(0.1, 0.6, k)));
        c.save(); c.translate(tx, ty); c.rotate((1 - ss(0, 0.5, k)) * -1.2); star(8.5 * sc); fill(INK); c.restore();
        text(k < 1 ? 'Release' : q.word, tx, ty - 21, { a: k < 1 ? 1 : ss(1, 1.25, k) });
      }
      c.restore();
    }
  }

  function draw(sc, t) {
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    const m = W < 480 ? 0.76 : 1;
    s = sc.playing ? playScale() : Math.min(W / (sc.span[0] * m), H / (sc.span[1] * m));
    g = clamp(s * 1.12, sc.playing ? 0.74 : 0.9, 1.75);     // a little smaller in play, so armies standing together stay distinct
    cam.x = sc.cam[0]; cam.y = sc.cam[1] - 12 / s;                // leave room for the strip of numbers on top

    c.save(); c.translate(W / 2 - cam.x * s, H / 2 - cam.y * s); c.scale(s, s);
    terrain(sc);
    c.restore();

    const x0 = cam.x - W / 2 / s - 30, x1 = cam.x + W / 2 / s + 30, y0 = cam.y - H / 2 / s - 20, y1 = cam.y + H / 2 / s + 40;
    const seen = (x, y) => clearAt(x, y, sc.src);
    const known = (x, y) => (sc.mem ? Math.max(seen(x, y), memAt(sc.mem, x, y)) : seen(x, y));

    // everything standing on the map, back to front
    const items = [];
    for (const p of TREES) if (p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1) items.push({ y: p.y, f: () => sym(p.x, p.y, gTree) });
    const kSeam = known(SEAM.x, SEAM.y), kVil = known(VIL.x, VIL.y);
    if (kSeam > 0.04) items.push({ y: SEAM.y, f: () => { c.save(); c.globalAlpha = kSeam; sym(SEAM.x, SEAM.y, gSeam); c.restore(); } });
    items.push({ y: HQ.y, f: () => sym(HQ.x, HQ.y, () => gCapital(0, sc.hq == null ? 1 : sc.hq, t), 1.25) });
    if (kVil > 0.04) items.push({ y: VIL.y, f: () => { c.save(); c.globalAlpha = kVil; sym(VIL.x, VIL.y, () => gVillage(sc.vil, t), 1.15); c.restore(); } });
    const eSeen = known(EHQ.x, EHQ.y);
    if (eSeen > 0.02) items.push({ y: EHQ.y, f: () => {
      c.save(); c.globalAlpha = eSeen;
      const sh = sc.ehqShake ? (hash(Math.floor(t * 30)) - 0.5) * 2.2 * sc.ehqShake : 0;
      c.translate(sh, 0); sym(EHQ.x, EHQ.y, () => gCapital(1, sc.ehq, t), 1.25); c.restore();
    } });
    for (const b of sc.builds) {
      if (b.p <= 0) continue;
      items.push({ y: b.at.y, f: () => {
        const done = b.p >= 1;
        sym(b.at.x, b.at.y, () => {
          if (!done) {
            c.save(); c.setLineDash([2.5, 3]); c.beginPath(); c.ellipse(0, -1, 21, 9, 0, 0, TAU); line(0.9); c.restore();
            c.beginPath(); c.arc(0, -8, 23, -Math.PI / 2, -Math.PI / 2 + TAU * b.p); line(1.7);
            c.beginPath(); c.arc(0, -8, 23, 0, TAU); line(0.5, 'rgba(46,33,9,.35)');
          }
          c.save(); c.globalAlpha *= done ? 1 : 0.2 + 0.6 * b.p;
          if (b.k === 'farm') gFarm(); else if (b.k === 'camp') gCamp(); else gBarracks(t);
          c.restore();
          if (b.train > 0) { c.beginPath(); c.arc(0, -9, 21, -Math.PI / 2, -Math.PI / 2 + TAU * b.train); line(1.7, BLUE); }
        }, 1.1);
      } });
    }
    for (const w of sc.workers) items.push({ y: w.y, f: () => sym(w.x, w.y, () => figure('worker', GILT, w.dir, t, 'march', w.i, 0), 0.85) });
    for (const q of sc.fx) if (q.k === 'x') items.push({ y: q.y - 1000, f: () => {
      const px = SX(q.x), py = SY(q.y); c.save(); c.globalAlpha = q.a * 0.6;
      c.beginPath(); c.moveTo(px - 2.4, py - 2.4); c.lineTo(px + 2.4, py + 2.4); c.moveTo(px + 2.4, py - 2.4); c.lineTo(px - 2.4, py + 2.4); line(1); c.restore();
    } });
    for (const a of sc.armies) {
      const vis = a.foe ? seen(a.x, a.y) : 1;
      if (vis < 0.03) continue;
      items.push({ y: a.y + 6, f: () => { c.save(); c.globalAlpha = vis; army(a, t); c.restore(); } });
    }
    items.sort((p, q) => p.y - q.y);
    for (const it of items) it.f();

    // things in the air, and where they land
    c.lineCap = 'round';
    for (const q of sc.fx) {
      if (q.k === 'arrow') {
        c.beginPath(); c.moveTo(SX(q.x), SY(q.y) - q.z * g); c.lineTo(SX(q.x2), SY(q.y2) - q.z2 * g); line(1.05, q.side ? RUST : INK);
      } else if (q.k === 'rock') {
        c.save(); c.setLineDash([1.5, 4]); c.globalAlpha = 0.5; c.beginPath();
        for (let u = Math.max(0, q.u - 0.3); u <= q.u; u += 0.03) { const X = SX(lerp(q.ax, q.bx, u)), Y = SY(lerp(q.ay, q.by, u)) - Math.sin(u * Math.PI) * 52 * g; u === Math.max(0, q.u - 0.3) ? c.moveTo(X, Y) : c.lineTo(X, Y); }
        line(1); c.restore();
        c.beginPath(); c.arc(SX(q.x), SY(q.y) - q.z * g, 2.3 * g, 0, TAU); fill(INK);
      } else if (q.k === 'hit') {
        const px = SX(q.x), py = SY(q.y);
        c.save(); c.globalAlpha = 1 - q.u;
        c.beginPath(); c.ellipse(px, py, (4 + q.u * 15) * g, (2.5 + q.u * 9) * g, 0, 0, TAU); line(1.2);
        c.beginPath(); for (let i = 0; i < 6; i++) { const a = i * 1.05 + 0.4; c.moveTo(px + Math.cos(a) * 5 * g, py - Math.abs(Math.sin(a)) * 4 * g); c.lineTo(px + Math.cos(a) * (8 + q.u * 12) * g, py - Math.abs(Math.sin(a)) * (7 + q.u * 13) * g); } line(1);
        c.restore();
      } else if (q.k === 'plus') {
        const px = SX(q.x), py = SY(q.y) - (8 + q.u * 16) * g, r = 3 * g;
        c.save(); c.globalAlpha = 1 - q.u; c.beginPath(); c.moveTo(px - r, py); c.lineTo(px + r, py); c.moveTo(px, py - r); c.lineTo(px, py + r); line(1.3, BLUE); c.restore();
      } else if (q.k === 'ring') {
        c.save(); c.globalAlpha = 1 - q.u; c.beginPath(); c.arc(SX(q.x), SY(q.y), 12 + q.u * 40, 0, TAU); line(1.1); c.restore();
      } else if (q.k === 'spark') {
        const px = SX(q.x), py = SY(q.y) - 6 * g;
        c.save(); c.globalAlpha = 1 - q.u; c.beginPath();
        for (let i = 0; i < 4; i++) { const a = i * (Math.PI / 4) + 0.3; const r0 = (1 + q.u * 2) * g, r1 = (3.4 + q.u * 3) * g; c.moveTo(px + Math.cos(a) * r0, py + Math.sin(a) * r0); c.lineTo(px + Math.cos(a) * r1, py + Math.sin(a) * r1); c.moveTo(px - Math.cos(a) * r0, py - Math.sin(a) * r0); c.lineTo(px - Math.cos(a) * r1, py - Math.sin(a) * r1); }
        line(1); c.restore();
      }
    }

    fog(sc.src, sc.mem);

    // names on the map appear as the ground under them is seen
    const names = [
      ['Capital', HQ.x, HQ.y, 0, 22, 'center', 1, INK],
      [sc.vil >= 1 ? 'Village · yours' : 'Village · unclaimed', VIL.x, VIL.y, 26, -8, 'left', sc.quiet ? 0 : known(VIL.x, VIL.y), sc.vil >= 1 ? BLUE : INK],
      ['Gold', SEAM.x, SEAM.y, 0, 15, 'center', known(SEAM.x, SEAM.y), INK],
      ['Ford', FORD.x, FORD.y, 30, 20, 'center', known(FORD.x, FORD.y) * 0.8, INK],
      ['Enemy capital', EHQ.x, EHQ.y, 32, -10, 'left', eSeen, RUST],
    ];
    for (const [str, x, y, dx, dy, align, a, col] of names) if (a > 0.05) text(str, SX(x) + dx * g, SY(y) + dy * g, { a: a * a, col, align });
    if (sc.terr > 0.5) text('Your territory', SX(HQ.x + 184), SY(HQ.y + 126), { a: 0.85, col: BLUE });
    if (sc.slots) text(`Building ${sc.slots}/2`, SX(HQ.x), SY(HQ.y) - 50 * g, { a: 0.9 });
    for (const b of sc.builds) {
      if (b.cost && t > b.t0 && t < b.t0 + 1.5) { const u = (t - b.t0) / 1.5; text(b.cost, SX(b.at.x), SY(b.at.y) - 44 * g - u * 14, { a: 1 - u * u, col: RUST }); }
      if (b.train > 0) text('Training · ' + b.trainWord, SX(b.at.x), SY(b.at.y) + 20 * g);
    }
    if (sc.capture > 0) { const px = SX(VIL.x), py = SY(VIL.y) - 6 * g; c.beginPath(); c.arc(px, py, 30 * g, -Math.PI / 2, -Math.PI / 2 + TAU * sc.capture); line(1.8, BLUE); c.beginPath(); c.arc(px, py, 30 * g, 0, TAU); line(0.5, 'rgba(29,76,155,.4)'); }
    if (sc.note && sc.note[3] > 0) text(sc.note[0], SX(sc.note[1]), SY(sc.note[2]), { a: sc.note[3], col: BLUE });

    gestures(sc.gest, t);

    // play: standing orders, and the order being drawn right now
    if (sc.orders) for (const o of sc.orders) {
      const ax = SX(o.from[0]), ay = SY(o.from[1]), bx = SX(o.to[0]), by = SY(o.to[1]);
      c.save(); c.setLineDash([2, 5]); c.globalAlpha = 0.75; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); line(1); c.restore();
      c.save(); c.translate(bx, by); star(6.5); fill(INK); c.restore();
    }
    if (sc.drag) {
      const q = sc.drag, ax = SX(q.wx), ay = SY(q.wy);
      c.save(); c.lineCap = 'round';
      c.beginPath(); c.moveTo(ax, ay); c.lineTo(q.x, q.y); line(1.1);
      c.beginPath(); c.arc(ax, ay, 2.2, 0, TAU); fill(INK);
      c.beginPath(); c.arc(q.x, q.y, 13, 0, TAU); fill('rgba(46,33,9,.1)'); line(1.3);
      if (q.word) text(q.word, q.x, q.y - 26);
      c.restore();
    }
  }

  /* ───────────── the readouts around the map ───────────── */
  const el = {
    food: plate.querySelector('[data-res="food"]'), wood: plate.querySelector('[data-res="wood"]'), gold: plate.querySelector('[data-res="gold"]'), stone: plate.querySelector('[data-res="stone"]'),
    armies: plate.querySelector('[data-res="armies"]'), era: plate.querySelector('[data-res="era"]'),
    rack: plate.querySelector('.tb-rack ul'), alert: plate.querySelector('.tb-alert'), win: plate.querySelector('.tb-victory'),
    winB: plate.querySelector('.tb-victory b'), winS: plate.querySelector('.tb-victory span'), hint: plate.querySelector('.tb-hint'),
    play: plate.querySelector('.tb-play'), playWord: plate.querySelector('.tb-play span'), again: plate.querySelector('.tb-again'),
    goals: Array.from(document.querySelectorAll('[data-goal]')),
  };
  const shown = {};
  function put(key, node, val) { if (node && shown[key] !== val) { shown[key] = val; node.textContent = val; } }
  function hud(sc) {
    put('food', el.food, sc.res.food); put('wood', el.wood, sc.res.wood); put('gold', el.gold, sc.res.gold); put('stone', el.stone, sc.res.stone);
    put('armies', el.armies, (sc.count == null ? sc.rack.length : sc.count) + '/12'); put('era', el.era, sc.era);
    const sig = sc.rack.map(r => r[0] + r[1] + Math.round(r[2] * 20) + (r[3] ? 1 : 0)).join('|');
    if (el.rack && shown.rack !== sig) {
      shown.rack = sig;
      el.rack.innerHTML = sc.rack.map(r => `<li class="${r[3] ? 'hot' : ''}"><b>${r[0]}</b><em>${r[1]}</em><u style="--hp:${clamp(r[2]).toFixed(2)}"></u></li>`).join('');
    }
    if (el.alert) el.alert.classList.toggle('on', !!sc.alert);
    if (el.win) el.win.classList.toggle('on', !!(sc.win || sc.lose));
    put('winB', el.winB, sc.lose ? 'Defeat' : 'Victory'); put('winS', el.winS, sc.lose ? 'Your armies are gone' : 'Enemy capital destroyed');
    put('hint', el.hint, sc.hint || '');
    if (sc.goals) for (const n of el.goals) n.classList.toggle('done', !!sc.goals[n.dataset.goal]);
  }

  /* ───────────── play: a small live skirmish on the same map ─────────────
     The film above is scripted; this is not. Armies are simulated the way the game does it,
     as whole armies with one order each, and the visitor gives those orders by holding a
     banner, dragging and releasing. Dragging open ground moves the map. */
  const MAPW = 1600, MAPH = 1000, CELL = 32, MC = MAPW / CELL, MR = Math.ceil(MAPH / CELL);
  const PLAY_SPAN = [1040, 720];
  const STATS = {
    knight: { speed: 104, range: 36, dps: 0.105, vs: 0.02, sight: 178 },
    sword:  { speed: 66, range: 34, dps: 0.085, vs: 0.022, sight: 160 },
    spear:  { speed: 62, range: 36, dps: 0.068, vs: 0.02, sight: 160 },
    bow:    { speed: 64, range: 150, dps: 0.05, vs: 0.012, sight: 186 },
    xbow:   { speed: 58, range: 140, dps: 0.05, vs: 0.012, sight: 176 },
    cat:    { speed: 46, range: 215, dps: 0.012, vs: 0.1, sight: 150 },
  };
  const ARMOR = { knight: 0.9, sword: 0.85, spear: 1, bow: 1.3, xbow: 1.25, cat: 1.5 };
  const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // what has been seen stays on the map, lightly screened, after the army moves on
  function memAt(mem, x, y) {
    const gx = clamp(x / CELL - 0.5, 0, MC - 1.001), gy = clamp(y / CELL - 0.5, 0, MR - 1.001);
    const i = Math.floor(gx), j = Math.floor(gy), u = gx - i, v = gy - j, k = j * MC + i;
    return lerp(lerp(mem[k], mem[k + 1], u), lerp(mem[k + MC], mem[k + MC + 1], u), v);
  }
  function remember(mem, src) {
    for (const q of src) {
      const r = q.r * 0.86;
      const i0 = Math.max(0, Math.floor((q.x - r) / CELL)), i1 = Math.min(MC - 1, Math.floor((q.x + r) / CELL));
      const j0 = Math.max(0, Math.floor((q.y - r) / CELL)), j1 = Math.min(MR - 1, Math.floor((q.y + r) / CELL));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        if (Math.hypot((i + 0.5) * CELL - q.x, (j + 0.5) * CELL - q.y) < r) mem[j * MC + i] = 1;
      }
    }
  }

  // the river can only be crossed at the ford
  function riverX(y) {
    for (let i = 1; i < RIVER.length; i++) {
      if (y <= RIVER[i][1] || i === RIVER.length - 1) { const a = RIVER[i - 1], b = RIVER[i]; return lerp(a[0], b[0], clamp((y - a[1]) / (b[1] - a[1]))); }
    }
  }
  const bank = (x, y) => (x < riverX(y) ? -1 : 1);
  const FORD_W = [556, 624], FORD_E = [614, 600];
  function stepTo(a, tx, ty, d) {
    if (bank(a.x, a.y) !== bank(tx, ty)) {
      const west = bank(a.x, a.y) < 0, own = west ? FORD_W : FORD_E, far = west ? FORD_E : FORD_W;
      if (!a.cross && Math.hypot(a.x - own[0], a.y - own[1]) < 8) a.cross = 1;
      [tx, ty] = a.cross ? far : own;
    } else a.cross = 0;
    const dx = tx - a.x, dy = ty - a.y, L = Math.hypot(dx, dy) || 1, k = Math.min(1, Math.max(0, d) / L);
    a.x += dx * k; a.y += dy * k;
    if (L > 1) a.face = Math.atan2(dy, dx);
  }

  let game = null, lastNow = 0;
  function newGame() {
    const mk = (id, side, kind, x, y, role, home) => ({ id, seed: id * 2 + 1, side, kind, x, y, hp: 1, face: side ? 2.7 : -0.4, mode: 'idle', order: null, cd: 0.3 + hash(id) * 0.5, role, home, thrown: [-9, -9, -9], ti: 0, cross: 0 });
    return {
      t: 0, result: null, over: 0,
      armies: [
        mk(1, 0, 'knight', 552, 664), mk(2, 0, 'sword', 474, 700), mk(3, 0, 'bow', 404, 730), mk(4, 0, 'cat', 348, 802),
        mk(5, 1, 'spear', 1176, 346, 'raid'), mk(6, 1, 'xbow', 1226, 320, 'raid'), mk(7, 1, 'spear', 1268, 320, 'guard', { x: 1268, y: 320 }),
      ],
      vil: 0, hq: 1, ehq: 1, mem: new Float32Array(MC * MR), src: [],
      shots: [], sparks: [], marks: [], plus: [], flash: null,
      cam: [560, 664], follow: true, sel: 0, drag: null, pan: null, orders: 0, raid: 0, stage: 0, tower: 0, alert: -9,
      goals: { scout: false, village: false, line: false, capital: false },
    };
  }
  function playScale() { const m = W < 480 ? 0.6 : 1; return Math.min(W / (PLAY_SPAN[0] * m), H / (PLAY_SPAN[1] * m)); }
  function clampCam(G) {
    const k = playScale(), hw = W / 2 / k, hh = H / 2 / k;
    G.cam[0] = hw * 2 >= MAPW + 80 ? MAPW / 2 : clamp(G.cam[0], hw - 40, MAPW - hw + 40);
    G.cam[1] = hh * 2 >= MAPH + 100 ? MAPH / 2 : clamp(G.cam[1], hh - 60, MAPH - hh + 40);
  }
  function hurt(G, tg, amt) {
    const n = KINDS[tg.kind].n, before = Math.ceil(n * tg.hp);
    tg.hp = Math.max(0, tg.hp - amt);
    if (Math.ceil(n * tg.hp) < before && G.marks.length < 90) G.marks.push({ x: tg.x + (Math.random() - 0.5) * 34, y: tg.y + (Math.random() - 0.5) * 22, t: G.t });
    if (tg.hp <= 0 && tg.dead == null) tg.dead = G.t;
  }
  function strike(G, a, tx, ty) {
    if (a.cd > 0) return;
    const T = G.t, r = () => Math.random() - 0.5;
    if (a.kind === 'bow' || a.kind === 'xbow') {
      a.cd = 0.95;
      for (let i = 0; i < 5; i++) G.shots.push({ k: 'arrow', side: a.side, ax: a.x + r() * 26, ay: a.y + r() * 16, bx: tx + r() * 34, by: ty + r() * 22, t0: T + Math.random() * 0.28, du: 0.55 + Math.random() * 0.2, lift: 26 });
    } else if (a.kind === 'cat') {
      a.cd = 0.4;
      const i = a.ti++ % 3;
      a.thrown[i] = T;
      G.shots.push({ k: 'rock', ax: a.x + (i - 1) * 17, ay: a.y, bx: tx + r() * 30, by: ty + r() * 18, t0: T + 0.1, du: ROCK_FLIGHT, lift: 52 });
    } else {
      a.cd = 0.17;
      G.sparks.push({ x: (a.x + tx) / 2 + r() * 26, y: (a.y + ty) / 2 + r() * 18, t: T });
    }
  }

  function stepGame(G, dt) {
    G.t += dt;
    const T = G.t, live = G.armies.filter(a => a.hp > 0), blue = live.filter(a => !a.side), red = live.filter(a => a.side);
    const byId = id => G.armies.find(a => a.id === id);
    const nearest = (a, list) => { let best = null, bd = 1e9; for (const q of list) { const d = D(a, q); if (d < bd) { bd = d; best = q; } } return [best, bd]; };
    const fighting = !G.result;

    G.src = [{ x: HQ.x, y: HQ.y, r: 245 }, ...blue.map(a => ({ x: a.x, y: a.y, r: STATS[a.kind].sight }))];
    if (G.vil >= 1) G.src.push({ x: VIL.x, y: VIL.y, r: 230 });
    remember(G.mem, G.src);

    // the enemy's small brain: hold the capital, and after a while come for the village, then for you
    if (!G.raid && (T > 26 || G.vil >= 1)) G.raid = T + 2;
    for (const e of red) {
      const [b, bd] = nearest(e, blue);
      if (b && bd < (e.role === 'guard' ? 215 : 240) && (e.role !== 'guard' || D(b, EHQ) < 300)) e.order = { type: 'attack', id: b.id };
      else if (e.role === 'guard') e.order = D(e, e.home) > 10 ? { type: 'move', x: e.home.x, y: e.home.y } : null;
      else if (G.raid && T > G.raid) e.order = G.stage ? { type: 'siege' } : { type: 'move', x: VIL.x + (e.kind === 'xbow' ? 64 : 34), y: VIL.y - (e.kind === 'xbow' ? 30 : 12) };
      else e.order = null;
    }
    if (G.raid && !G.stage && G.vil <= 0 && T > G.raid + 6 && red.some(e => e.role === 'raid' && D(e, VIL) < 90)) G.stage = 1;

    // your armies defend themselves when left alone, then go back to what you told them
    for (const b of blue) {
      const o = b.order;
      if (o && o.type === 'attack') { const tg = byId(o.id); if (!tg || tg.hp <= 0 || (o.auto && D(b, tg) > 300)) b.order = o.then || null; }
      if (b.kind === 'cat' || (b.order && b.order.type !== 'hold')) continue;
      const [e, ed] = nearest(b, red);
      if (e && ed < Math.max(200, STATS[b.kind].range + 60)) b.order = { type: 'attack', id: e.id, auto: true, then: b.order };
    }

    for (const a of live) {
      const st = STATS[a.kind], o = a.order;
      let mode = 'idle';
      a.cd -= dt;
      if (o && o.type === 'attack') {
        const tg = byId(o.id);
        if (tg && tg.hp > 0) {
          const d = D(a, tg);
          if (d > st.range) { stepTo(a, tg.x, tg.y, Math.min(d - st.range * 0.9, st.speed * dt)); mode = 'march'; }
          else if (fighting) { mode = 'fight'; a.face = Math.atan2(tg.y - a.y, tg.x - a.x); hurt(G, tg, st.dps * ARMOR[tg.kind] * dt); strike(G, a, tg.x, tg.y); }
        }
      } else if (o && o.type === 'siege') {
        const tg = a.side ? HQ : EHQ, d = D(a, tg), reach = Math.max(st.range, 62);
        if (d > reach) { stepTo(a, tg.x, tg.y, Math.min(d - reach * 0.92, st.speed * dt)); mode = 'march'; }
        else if (fighting) {
          mode = 'fight'; a.face = Math.atan2(tg.y - a.y, tg.x - a.x);
          if (a.side) G.hq = Math.max(0, G.hq - st.vs * dt); else G.ehq = Math.max(0, G.ehq - st.vs * dt);
          strike(G, a, tg.x, tg.y - 8);
        }
      } else if (o && o.type === 'move') {
        const d = Math.hypot(o.x - a.x, o.y - a.y);
        if (d < 3) a.order = o.capture ? { type: 'hold' } : null;
        else { stepTo(a, o.x, o.y, Math.min(d, st.speed * dt)); mode = 'march'; }
      }
      a.mode = mode;
    }

    // the capital's own tower
    if (fighting && G.ehq > 0) {
      const [b, bd] = nearest(EHQ, blue);
      G.tower -= dt;
      if (b && bd < 150) {
        hurt(G, b, 0.026 * ARMOR[b.kind] * dt);
        if (G.tower <= 0) { G.tower = 1.1; for (let i = 0; i < 4; i++) G.shots.push({ k: 'arrow', side: 1, ax: EHQ.x + 10, ay: EHQ.y - 10, bx: b.x + (Math.random() - 0.5) * 30, by: b.y + (Math.random() - 0.5) * 20, t0: T + Math.random() * 0.25, du: 0.6, lift: 30 }); }
      }
    }

    // the village changes hands while one side stands on it alone; friendly ground heals
    const bNear = blue.some(b => b.kind !== 'cat' && D(b, VIL) < 62), rNear = red.some(e => D(e, VIL) < 84);
    if (bNear && !rNear) G.vil = Math.min(1, G.vil + dt / 2.6); else if (rNear && !bNear) G.vil = Math.max(0, G.vil - dt / 3);
    for (const b of blue) {
      if (b.mode === 'idle' && b.hp < 1 && (D(b, HQ) < 120 || (G.vil >= 1 && D(b, VIL) < 96))) {
        b.hp = Math.min(1, b.hp + 0.04 * dt);
        if (Math.random() < dt * 2.4) G.plus.push({ x: b.x + (Math.random() - 0.5) * 30, y: b.y - 6, t: T });
      }
    }
    // friends keep a little distance
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const p = live[i], q = live[j];
      if (p.side !== q.side) continue;
      const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 0.01;
      if (d < 38) { const k = (38 - d) / d * 0.5 * Math.min(1, dt * 6); p.x -= dx * k; p.y -= dy * k; q.x += dx * k; q.y += dy * k; }
    }

    if (red.some(e => D(e, HQ) < 280 || (G.vil >= 1 && D(e, VIL) < 150)) && T - G.alert > 9) G.alert = T;
    if (!G.result) {
      if (G.ehq <= 0) { G.result = 'win'; G.over = T; }
      else if (!blue.length || G.hq <= 0) { G.result = 'lose'; G.over = T; }
    }
    const gl = G.goals;
    if (memAt(G.mem, VIL.x, VIL.y) > 0.5) gl.scout = true;
    if (G.vil >= 1) gl.village = true;
    if (!G.armies.some(e => e.role === 'raid' && e.hp > 0)) gl.line = true;
    if (G.result === 'win') gl.capital = true;

    if (G.drag) { const a = byId(G.drag.id); if (a && a.hp > 0) { G.drag.wx = a.x; G.drag.wy = a.y; } else G.drag = null; }
    if (G.follow && !G.pan && !G.drag && blue.length) {
      let cx = 0, cy = 0, cw = 0;
      for (const b of blue) {
        let px = b.x, py = b.y;
        const o = b.order, q = !o ? null : o.type === 'move' ? o : o.type === 'attack' ? byId(o.id) : o.type === 'siege' ? EHQ : null;
        if (q) { px = (px + q.x) / 2; py = (py + q.y) / 2; }
        const w = b.mode === 'idle' ? 0.25 : 1;
        cx += px * w; cy += py * w; cw += w;
      }
      const k = 1 - Math.exp(-dt * 1.1);
      G.cam[0] += (cx / cw - G.cam[0]) * k; G.cam[1] += (cy / cw - G.cam[1]) * k;
    }
    clampCam(G);
    G.shots = G.shots.filter(q => T < q.t0 + q.du + 0.5);
    G.sparks = G.sparks.filter(q => T < q.t + 0.22);
    G.plus = G.plus.filter(q => T < q.t + 0.9);
  }

  function gameScene(G) {
    const T = G.t, fx = [], armies = [], rack = [], orders = [], wk = [];
    for (const q of G.shots) {
      const u = (T - q.t0) / q.du;
      if (u < 0) continue;
      if (u <= 1) {
        const x = lerp(q.ax, q.bx, u), y = lerp(q.ay, q.by, u), z = Math.sin(u * Math.PI) * q.lift;
        if (q.k === 'arrow') { const u2 = Math.min(1, u + 0.07); fx.push({ k: 'arrow', side: q.side, x, y, z, x2: lerp(q.ax, q.bx, u2), y2: lerp(q.ay, q.by, u2), z2: Math.sin(u2 * Math.PI) * q.lift }); }
        else fx.push({ k: 'rock', x, y, z, u, ax: q.ax, ay: q.ay, bx: q.bx, by: q.by });
      } else if (q.k === 'rock') fx.push({ k: 'hit', x: q.bx, y: q.by, u: clamp((T - q.t0 - q.du) / 0.5) });
    }
    for (const q of G.sparks) fx.push({ k: 'spark', x: q.x, y: q.y, u: (T - q.t) / 0.22 });
    for (const q of G.marks) fx.push({ k: 'x', x: q.x, y: q.y, a: ss(q.t, q.t + 0.3, T) });
    for (const q of G.plus) fx.push({ k: 'plus', x: q.x, y: q.y, u: (T - q.t) / 0.9 });
    if (G.flash && T - G.flash.t < 0.5) fx.push({ k: 'ring', x: G.flash.x, y: G.flash.y, u: (T - G.flash.t) / 0.5 });
    const nudge = !G.orders ? 0.45 + 0.45 * Math.sin(T * 5) : 0;       // until the first order, the banners ask to be held
    for (const a of G.armies) {
      const gone = a.hp <= 0 ? ss(a.dead, a.dead + 0.9, T) : 0;
      if (!a.side) {
        const word = a.hp <= 0 ? 'Lost' : a.mode === 'fight' ? (a.order && a.order.type === 'siege' ? 'Sieging' : 'Fighting') : a.mode === 'march' ? 'Marching' : G.vil > 0 && G.vil < 1 && D(a, VIL) < 62 ? 'Capturing' : 'Holding';
        rack.push([KINDS[a.kind].name, word, a.hp, a.mode === 'fight']);
      }
      if (gone >= 1) continue;
      const held = G.sel === a.id || (G.drag && G.drag.id === a.id);
      armies.push({
        seed: a.seed, side: a.side, kind: a.kind, x: a.x, y: a.y, face: a.face, mode: a.mode, hp: a.hp, alpha: 1 - gone, foe: !!a.side,
        sel: a.side || a.hp <= 0 ? 0 : held ? 1 : nudge,
        fire: a.kind === 'cat' ? i => { const ph = T - a.thrown[i]; return ph < 0.16 ? ph / 0.16 : 1 - ss(0.3, 0.9, ph); } : null,
      });
      const o = a.order;
      if (!a.side && a.hp > 0 && o && !o.auto && o.type !== 'hold') {
        const q = o.type === 'move' ? o : o.type === 'attack' ? G.armies.find(e => e.id === o.id) : EHQ;
        if (q) orders.push({ from: [a.x, a.y], to: [q.x, q.y] });
      }
    }
    workers(wk, T, FARM, HQ, 2, 11); workers(wk, T, CAMP, HQ, 2, 23);
    const gl = G.goals, foeKnown = memAt(G.mem, EHQ.x, EHQ.y) > 0.5;
    const hint = G.result ? '' : !G.orders ? 'Hold a blue banner, drag, release' : !gl.scout ? 'Scout past the ford' : !gl.village ? 'Stand an army on the village' : !foeKnown ? 'Follow the road north-east' : !gl.line ? 'Break their line' : 'Bring the catapults to their capital';
    return {
      cam: G.cam, span: PLAY_SPAN, src: G.src, mem: G.mem, armies, orders, drag: G.drag, playing: true,
      builds: [{ k: 'farm', at: FARM, p: 1 }, { k: 'camp', at: CAMP, p: 1 }, { k: 'barracks', at: BARR, p: 1 }],
      workers: wk, fx, vil: G.vil, capture: G.vil > 0 && G.vil < 1 ? G.vil : 0, ehq: G.ehq, hq: G.hq, terr: 0.22,
      ehqShake: G.ehq > 0 && G.armies.some(a => !a.side && a.mode === 'fight' && a.order && a.order.type === 'siege') ? 1 - G.ehq * 0.5 : 0,
      gest: [], res: stock(T, 210, 160, 150, 120), era: 'II', rack, count: G.armies.filter(a => !a.side && a.hp > 0).length,
      alert: T - G.alert < 2.6 && Math.sin(T * 9) > -0.3,
      win: G.result === 'win' && T > G.over + 0.8, lose: G.result === 'lose' && T > G.over + 0.8, hint, goals: gl,
    };
  }

  /* holding, dragging, releasing */
  function local(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  function pick(G, x, y) {
    let best = null, bd = 36 * Math.max(1, g);
    for (const a of G.armies) {
      if (a.side || a.hp <= 0) continue;
      const d = Math.hypot(SX(a.x) - x, SY(a.y) - 9 * g - y);
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }
  function aim(G, x, y, a) {                                   // what letting go here would mean
    if (Math.hypot(SX(a.x) - x, SY(a.y) - 6 * g - y) < 22) return { word: 'Cancel' };
    for (const e of G.armies) {
      if (e.side && e.hp > 0 && clearAt(e.x, e.y, G.src) > 0.3 && Math.hypot(SX(e.x) - x, SY(e.y) - 8 * g - y) < 34) return { word: 'Attack', order: { type: 'attack', id: e.id } };
    }
    if (G.ehq > 0 && memAt(G.mem, EHQ.x, EHQ.y) > 0.5 && Math.hypot(SX(EHQ.x) - x, SY(EHQ.y) - 12 * g - y) < 40) return { word: 'Siege', order: { type: 'siege' } };
    if (Math.hypot(SX(VIL.x) - x, SY(VIL.y) - 6 * g - y) < 34) return { word: G.vil >= 1 ? 'Garrison' : 'Capture', order: { type: 'move', x: VIL.x - 30 + (a.id - 1) * 16, y: VIL.y + 34, capture: true } };
    let tx = clamp((x - W / 2) / s + cam.x, 40, MAPW - 40);
    const ty = clamp((y - H / 2) / s + cam.y, 60, MAPH - 40), rx = riverX(ty);
    if (Math.abs(tx - rx) < 24 && Math.hypot(tx - FORD.x, ty - FORD.y) > 30) tx = rx + (tx < rx ? -26 : 26);
    return { word: 'Move', order: { type: 'move', x: tx, y: ty } };
  }
  cv.addEventListener('pointerdown', e => {
    if (e.button) return;
    if (!game) { if (e.pointerType === 'mouse') startPlay(); return; }
    const G = game, [x, y] = local(e), a = pick(G, x, y);
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events have no capture */ }
    if (a) { G.sel = a.id; G.drag = { id: a.id, pid: e.pointerId, wx: a.x, wy: a.y, x, y, word: 'Hold' }; }
    else G.pan = { pid: e.pointerId, x, y, cx: G.cam[0], cy: G.cam[1] };
    e.preventDefault();
  });
  cv.addEventListener('pointermove', e => {
    const G = game;
    if (!G) return;
    const [x, y] = local(e);
    if (G.drag && G.drag.pid === e.pointerId) {
      const a = G.armies.find(q => q.id === G.drag.id);
      G.drag.x = x; G.drag.y = y; G.drag.word = a ? aim(G, x, y, a).word : '';
    } else if (G.pan && G.pan.pid === e.pointerId) {
      const k = playScale();
      G.cam[0] = G.pan.cx - (x - G.pan.x) / k; G.cam[1] = G.pan.cy - (y - G.pan.y) / k;
      G.follow = false; clampCam(G);
    }
  });
  function letGo(e) {
    const G = game;
    if (!G) return;
    if (G.drag && G.drag.pid === e.pointerId) {
      const a = G.armies.find(q => q.id === G.drag.id), [x, y] = local(e);
      if (a && a.hp > 0 && e.type === 'pointerup' && !G.result) {
        const r = aim(G, x, y, a);
        if (r.order) {
          a.order = r.order; a.cross = 0; G.orders++; G.follow = true;
          G.flash = { x: (x - W / 2) / s + cam.x, y: (y - H / 2) / s + cam.y, t: G.t };
        }
      }
      G.drag = null;
    }
    if (G.pan && G.pan.pid === e.pointerId) G.pan = null;
  }
  cv.addEventListener('pointerup', letGo);
  cv.addEventListener('pointercancel', letGo);

  const matchEl = cv.closest('.match');
  function startPlay() {
    if (game || !size()) return;
    game = newGame(); lastNow = 0;
    clampCam(game);
    matchEl.classList.add('playing');
    if (el.playWord) el.playWord.textContent = 'Back to the demo';
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  }
  function stopPlay() {
    if (!game) return;
    game = null;
    matchEl.classList.remove('playing');
    if (el.playWord) el.playWord.textContent = 'Take command';
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    t0 = performance.now();
    if (!phase) return;
    if (reduce) render(phase, SCRIPT[phase].poster); else raf = requestAnimationFrame(tick);
  }
  if (el.play) el.play.addEventListener('click', () => (game ? stopPlay() : startPlay()));
  if (el.again) el.again.addEventListener('click', () => { if (game) { game = newGame(); clampCam(game); } });
  addEventListener('keydown', e => { if (e.key === 'Escape' && game) stopPlay(); });

  /* ───────────── running it ───────────── */
  let phase = null, t0 = 0, raf = 0;
  function render(id, t) {
    if (!size()) return;
    const sp = SCRIPT[id], sc = sp.run(t);
    cv.style.opacity = reduce ? 1 : Math.min(ss(0, 0.45, t), 1 - ss(sp.dur - 0.5, sp.dur, t)).toFixed(3);
    draw(sc, t);
    hud(sc);
  }
  function tick(now) {
    raf = 0;
    if (game) {
      if (size()) {
        const dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 0.016;
        lastNow = now;
        stepGame(game, dt);
        const sc = gameScene(game);
        cv.style.opacity = 1;
        draw(sc, game.t);
        hud(sc);
      }
      raf = requestAnimationFrame(tick);
      return;
    }
    if (!phase) return;
    render(phase, ((now - t0) / 1000) % SCRIPT[phase].dur);
    raf = requestAnimationFrame(tick);
  }
  window.EpochTable = {
    phase(id) {
      if (!SCRIPT[id]) id = null;
      if (game) { phase = id; if (!id) stopPlay(); return; }      // a game in progress survives scrolling between the four steps
      if (id === phase) return;
      phase = id;
      t0 = performance.now();
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (!id) return;
      if (reduce) render(id, SCRIPT[id].poster); else raf = requestAnimationFrame(tick);
    },
    resize() { if (phase && reduce && !game) render(phase, SCRIPT[phase].poster); },
    at(id, t) { if (raf) { cancelAnimationFrame(raf); raf = 0; } phase = null; render(id, t); },   // pose a moment (for checking)
    play: startPlay, stop: stopPlay,
    get game() { return game; },                                                                   // for checking
    spot(x, y) { const r = cv.getBoundingClientRect(); return [Math.round(SX(x) + r.left), Math.round(SY(y) + r.top)]; },   // where a map point is on screen (for checking)
  };
})();
