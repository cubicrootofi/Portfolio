/* Binary I-beam: an isometric wide-flange beam set in 0s and 1s.
   The pointer is a point load on a simply supported span. Each bit's brightness follows its
   von Mises stress, so the flanges light up with moment and the web with shear, and each
   support lights up with the share of the load it carries.
   Every face is 8-bit ASCII, read along the span. */
(() => {
  const canvas = document.getElementById('ibeam');
  const ctx = canvas && canvas.getContext('2d');
  if (!ctx) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const readout = document.querySelector('[data-beam-readout]');
  const spanOut = document.querySelector('[data-beam-span]');

  // The section in cells, proportioned on a W360x551 (W14x370): 455 deep, 418 wide,
  // 68 flanges, 42 web. One cell is 455 / 14 = 32.5 mm. Few, large cells keep the digits legible.
  const D = 14, BF = 13, TF = 2, TW = 1;
  const HB = BF / 2, HW = TW / 2, NA = D / 2;
  const MM = 455 / D;
  const SX = 9.95e6;          // elastic section modulus, mm³
  const P_MAX = 2400;         // kN at full load
  const C30 = Math.cos(Math.PI / 6);
  const HEAD = 9, FOOT = 5;   // room for the load arrow above and the supports below, in cells
  const IDLE = 0.75;          // load while nobody is pointing at the beam
  const LEVELS = 24;          // brightness steps in the glyph atlas

  // Bearings under the bottom flange, in cells: a steel wedge on a base plate (pin), and the
  // same wedge on two rollers (roller). Both stand 4 cells tall; the span runs between wedge tips.
  const SUP = 3;              // wedge tip, measured in from each end of the beam
  const WEDGE = 1.8;          // half-width of the wedge at its base
  const PLATE = 3;            // half-length of the base plate
  const PLATE_TOP = -3, PLATE_BOT = -4;
  const ROLL_R = 0.55;

  // Stress per unit moment (bending) and per unit shear (VQ / It) at height z.
  const I = (BF * D ** 3 - (BF - TW) * (D - 2 * TF) ** 3) / 12;
  const bendAt = z => Math.abs(z - NA) / I;
  const shearAt = z => {
    const e = Math.abs(z - NA);
    if (e >= NA - TF) return (NA * NA - e * e) / (2 * I);
    return (BF * TF * (NA - TF / 2) + TW * ((NA - TF) ** 2 - e * e) / 2) / (I * TW);
  };

  // stress → colour: dim ink at rest, violet under load, near-white at the peak
  const STOPS = [
    [0, 236, 233, 227, 0.16],
    [0.3, 236, 233, 227, 0.4],
    [0.6, 169, 150, 226, 0.92],
    [1, 214, 204, 250, 1],
  ];
  const colour = u => {
    let i = 1;
    while (i < STOPS.length - 1 && u > STOPS[i][0]) i++;
    const A = STOPS[i - 1], B = STOPS[i], t = (u - A[0]) / (B[0] - A[0]);
    const m = k => A[k] + (B[k] - A[k]) * t;
    return `rgba(${m(1) | 0}, ${m(2) | 0}, ${m(3) | 0}, ${m(4).toFixed(3)})`;
  };
  const FILL = { top: '#141417', slope: '#121215', side: '#0c0c0e', end: '#111114' };
  const SHADE = { top: 1, slope: 0.95, side: 0.8, end: 0.9 };
  const EDGE = 'rgba(236, 233, 227, 0.2)';
  const ACCENT = '#a996e2';

  const X = [1, 0, 0], Y = [0, 1, 0], NY = [0, -1, 0], DOWN = [0, 0, -1];
  const add = (p, v, k) => [p[0] + v[0] * k, p[1] + v[1] * k, p[2] + v[2] * k];
  const unit = v => { const l = Math.hypot(...v); return v.map(c => c / l); };
  const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

  let W = 1, H = 1, dpr = 1, s = 8, L = 120, ox = 0, oy = 0;
  let xA = SUP, xB = L - SUP, Ls = xB - xA;
  let items = [], atlas = null, g = 0, ref = 1;
  let aPos = 60, aTarget = 60, load = IDLE, loadTarget = IDLE;
  let grow = reduce ? 1 : 0, seenAt = 0, hover = false;
  let running = false, visible = false, raf = 0, last = 0, lastReadout = 0;
  let cost = 0, odd = false, pending = 0; // draw time (ms, smoothed); halve the rate when it runs long
  const t0 = performance.now();

  // isometric projection: x runs down-right along the span, y down-left across it, z up
  const lin = (x, y, z) => [(x - y) * C30 * s, ((x + y) * 0.5 - z) * s];
  const at = (x, y, z) => { const p = lin(x, y, z); return [ox + p[0], oy + p[1]]; };

  // A face is a flat polygon carrying a grid of glyph cells (origin o, unit axes U and V).
  // `react` ties a support's faces to its reaction instead of to the beam's stress.
  const makeFace = d => {
    const cells = [];
    for (let j = 0; j < Math.ceil(d.nv); j++) {
      for (let i = 0; i < Math.ceil(d.nu); i++) {
        const p = add(add(d.o, d.U, i + 0.5), d.V, j + 0.5);
        if (d.hide && d.hide(p[0], p[1], p[2])) continue;
        const b = j * 56 + i; // each row starts seven characters further into the message
        const ch = d.msg.charCodeAt((b >> 3) % d.msg.length);
        cells.push([i, j, p[0], p[2], (ch >> (7 - (b & 7))) & 1]);
      }
    }
    const pts = d.pts || [d.o, add(d.o, d.U, d.nu), add(add(d.o, d.U, d.nu), d.V, d.nv), add(d.o, d.V, d.nv)];
    const n = cells.length;
    const f = {
      kind: d.kind, n, react: d.react || 0, clip: !!d.clip,
      iu: new Float32Array(n), jv: new Float32Array(n), xs: new Float32Array(n),
      bend: new Float32Array(n), shear: new Float32Array(n), jit: new Float32Array(n),
      bit: new Uint8Array(n), flip: new Float64Array(n),
      u2: lin(...d.U), v2: lin(...d.V), o2: at(...d.o),
      poly: pts.map(p => at(...p)),
    };
    cells.forEach(([i, j, x, z, bit], k) => {
      f.iu[k] = i; f.jv[k] = j; f.xs[k] = x;
      f.bend[k] = bendAt(z); f.shear[k] = shearAt(z);
      f.bit[k] = bit; f.jit[k] = Math.random();
    });
    return f;
  };

  // plate, then rollers, then wedge: back to front within one bearing
  const bearing = (x0, roller, react, msg) => {
    const h = roller ? -PLATE_TOP - 2 * ROLL_R : -PLATE_TOP; // wedge height
    const w = PLATE, yb = HB + 1;
    const out = [
      { o: [x0 - w, -yb, PLATE_TOP], U: X, V: Y, nu: 2 * w, nv: 2 * yb, kind: 'top' },
      { o: [x0 - w, yb, PLATE_TOP], U: X, V: DOWN, nu: 2 * w, nv: PLATE_TOP - PLATE_BOT, kind: 'side' },
      { o: [x0 + w, yb, PLATE_TOP], U: NY, V: DOWN, nu: 2 * yb, nv: PLATE_TOP - PLATE_BOT, kind: 'end' },
    ].map(d => makeFace({ ...d, msg, react }));
    if (roller) [x0 - 1, x0 + 1].forEach(cx => out.push({ cyl: true, cx, cz: -h - ROLL_R, r: ROLL_R }));
    const slope = [WEDGE, 0, -h];
    out.push(
      makeFace({ o: [x0, HB, 0], U: NY, V: unit(slope), nu: BF, nv: Math.hypot(...slope), kind: 'slope', clip: true, msg, react }),
      makeFace({
        o: [x0 - WEDGE, HB, 0], U: X, V: DOWN, nu: 2 * WEDGE, nv: h, kind: 'end', clip: true, msg, react,
        pts: [[x0, HB, 0], [x0 + WEDGE, HB, -h], [x0 - WEDGE, HB, -h]],
      }),
    );
    return out;
  };

  // The beam: three boxes drawn back to front (bottom flange, web, top flange), each showing
  // its +y side, +z top and +x end. Cells that a later box fully covers are skipped.
  const build = () => {
    const beam = [
      { o: [0, HB, TF], U: X, V: DOWN, nu: L, nv: TF, kind: 'side', msg: "LET'S TALK / " },
      { o: [0, -HB, TF], U: X, V: Y, nu: L, nv: BF, kind: 'top', msg: 'W360x551 / PIN + ROLLER / ',
        hide: (x, y) => Math.abs(y) < HW || (y < -HW && x + (-HW - y) < L - 1) },
      { o: [L, HB, TF], U: NY, V: DOWN, nu: BF, nv: TF, kind: 'end', msg: 'IIII' },

      { o: [0, HW, D - TF], U: X, V: DOWN, nu: L, nv: D - 2 * TF, kind: 'side', msg: 'sigma = M*y/I; tau = V*Q/(I*t); ',
        hide: (x, y, z) => { const t = D - TF - z; return t < HB - HW - 0.5 && x + t < L - 1; } },
      { o: [L, HW, D - TF], U: NY, V: DOWN, nu: TW, nv: D - 2 * TF, kind: 'end', msg: 'I' },

      { o: [0, HB, D], U: X, V: DOWN, nu: L, nv: TF, kind: 'side', msg: 'M = P*a*b/L / ' },
      { o: [0, -HB, D], U: X, V: Y, nu: L, nv: BF, kind: 'top', msg: 'YOUSEF SEDIK / STRUCTURAL ENGINEER / WRITES THE SOFTWARE / ' },
      { o: [L, HB, D], U: NY, V: DOWN, nu: BF, nv: TF, kind: 'end', msg: 'IIII' },
    ].map(makeFace);

    // the bearings sit wholly below the beam, so they go first and the beam overlaps them
    items = [
      ...bearing(xA, false, 1, 'PIN / R = P*b/L / '),
      ...bearing(xB, true, 2, 'ROLLER / R = P*a/L / '),
      ...beam,
    ];
  };

  // '0' and '1' pre-drawn at every brightness step, then stamped onto the faces
  const buildAtlas = () => {
    g = Math.max(8, Math.ceil(s * dpr * 1.25));
    atlas = atlas || document.createElement('canvas');
    atlas.width = g * 2;
    atlas.height = g * LEVELS;
    const a = atlas.getContext('2d');
    // digits fill most of the cell so they still read as 0 and 1 at a few pixels
    a.font = `500 ${Math.round(g * 1.12)}px "Geist Mono", ui-monospace, Consolas, monospace`;
    a.textAlign = 'center';
    a.textBaseline = 'middle';
    for (let k = 0; k < LEVELS; k++) {
      a.fillStyle = colour(k / (LEVELS - 1));
      a.fillText('0', g * 0.5, g * (k + 0.55));
      a.fillText('1', g * 1.5, g * (k + 0.55));
    }
  };

  const fit = () => {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width);
    H = Math.max(1, r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);

    // largest cell size that still gives a beam-like span (L/d) inside the box
    const wide = W >= 820;
    const box = wide
      ? { x: W * 0.1, y: H * 0.06, w: W * 0.86, h: H * 0.88 }
      : { x: W * 0.04, y: H * 0.03, w: W * 0.92, h: H * 0.94 };
    const goal = (wide ? 5.5 : 4) * D;
    s = wide ? 10 : 8;
    for (;;) {
      const lw = box.w / (s * C30) - BF - 2;
      const lh = (box.h / s - D - HEAD - FOOT) * 2 - BF - 1;
      L = Math.floor(Math.min(lw, lh, 9 * D));
      if (L >= goal || s <= 3.5) break;
      s -= 0.25;
    }
    L = Math.max(L, 2 * D);
    xA = SUP;
    xB = L - SUP;
    Ls = xB - xA;

    // the base plates reach one cell past the flange, hence the extra cell across
    const bw = (L + BF + 2) * C30 * s;
    const bh = ((L + BF + 1) / 2 + D + HEAD + FOOT) * s;
    ox = box.x + (box.w - bw) / 2 + (HB + 1) * C30 * s;
    oy = box.y + (box.h - bh) / 2 + (HB / 2 + D + HEAD) * s;

    // full brightness = the worst stress anywhere with the full load at midspan
    ref = Math.max((Ls / 4) * NA / I, Math.sqrt(3) * 0.5 * shearAt(NA));
    build();
    buildAtlas();
    if (spanOut) spanOut.textContent = `${(Ls * MM / 1000).toFixed(2)} m`;
  };

  const outline = f => {
    const p = f.poly;
    ctx.beginPath();
    ctx.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
    ctx.closePath();
  };

  // circle in the vertical plane y, drawn in that plane so it projects to the right ellipse
  const cap = (c, y) => {
    const u = lin(...X), v = lin(...DOWN), o = at(0, y, 0);
    ctx.save();
    ctx.setTransform(u[0] * dpr, u[1] * dpr, v[0] * dpr, v[1] * dpr, o[0] * dpr, o[1] * dpr);
    ctx.beginPath();
    ctx.arc(c.cx, -c.cz, c.r, 0, Math.PI * 2);
    ctx.restore();
  };

  // a roller: a steel rod across the flange width
  const cylinder = c => {
    // silhouette lines touch each end circle where its tangent runs along the rod
    const q = Math.SQRT1_2 * c.r;
    const f1 = at(c.cx - q, HB, c.cz + q), f2 = at(c.cx + q, HB, c.cz - q);
    const b1 = at(c.cx - q, -HB, c.cz + q), b2 = at(c.cx + q, -HB, c.cz - q);
    ctx.strokeStyle = EDGE;
    ctx.lineWidth = 1;
    cap(c, -HB);
    ctx.fillStyle = FILL.side;
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(...f1); ctx.lineTo(...b1); ctx.lineTo(...b2); ctx.lineTo(...f2);
    ctx.closePath();
    ctx.fillStyle = FILL.top;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(...f1); ctx.lineTo(...b1);
    ctx.moveTo(...f2); ctx.lineTo(...b2);
    ctx.stroke();
    cap(c, HB);
    ctx.fillStyle = FILL.end;
    ctx.fill();
    ctx.stroke();
  };

  const arrow = a => {
    const [tx, ty] = at(a, 0, D);
    const len = (4 + 4.5 * load) * s;
    ctx.globalAlpha = 0.35 + 0.65 * load;
    ctx.strokeStyle = ctx.fillStyle = ACCENT;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(tx, ty - len);
    ctx.lineTo(tx, ty - 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tx, ty - 1);
    ctx.lineTo(tx - 4, ty - 9);
    ctx.lineTo(tx + 4, ty - 9);
    ctx.closePath();
    ctx.fill();
    ctx.font = '500 11px "Geist Mono", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('P', tx, ty - len - 8);
    ctx.globalAlpha = 1;
  };

  const draw = (now, dt = 0) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.lineJoin = 'round';
    const a = Math.min(Math.max(aPos, xA + 0.01), xB - 0.01);
    const ap = a - xA, bp = xB - a;
    const k = load / ref;
    const reveal = 1 - (1 - grow) ** 3;
    const flicker = !reduce && dt > 0;
    // reactions as a share of the full load: the bearing nearer the load carries more of it
    const react = [0, ((load * bp) / Ls) ** 1.2, ((load * ap) / Ls) ** 1.2];

    for (const f of items) {
      if (f.cyl) { cylinder(f); continue; }

      outline(f);
      ctx.fillStyle = FILL[f.kind];
      ctx.fill();
      if (f.clip) { ctx.save(); ctx.clip(); }

      const [ux, uy] = f.u2, [vx, vy] = f.v2, [px, py] = f.o2;
      ctx.setTransform(ux * dpr, uy * dpr, vx * dpr, vy * dpr, px * dpr, py * dpr);
      ctx.globalAlpha = SHADE[f.kind];
      const ur = f.react ? react[f.react] : -1;
      for (let n = 0; n < f.n; n++) {
        const x = f.xs[n];
        if (reveal < 1 && x / L > reveal * 1.3 - f.jit[n] * 0.3) continue;
        let u = ur;
        if (u < 0) {
          // simply supported between the bearings, point load P at a: M and V per unit P.
          // The short overhangs past each bearing carry nothing.
          const xr = x - xA;
          let M = 0, V = 0;
          if (xr > 0 && xr < Ls) {
            M = xr <= ap ? (bp * xr) / Ls : (ap * (Ls - xr)) / Ls;
            V = xr < ap ? bp / Ls : ap / Ls;
          }
          const sb = M * f.bend[n], ss = V * f.shear[n];
          u = k * Math.sqrt(sb * sb + 3 * ss * ss);
          u = u >= 1 ? 1 : u ** 1.2;
        }
        // hot bits flip more often, then settle back to the message
        if (flicker && now > f.flip[n] && Math.random() < (0.03 + 2.6 * u * u * u) * dt) {
          f.flip[n] = now + 70 + Math.random() * 170;
        }
        const bit = now < f.flip[n] ? f.bit[n] ^ 1 : f.bit[n];
        ctx.drawImage(atlas, bit * g, Math.round(u * (LEVELS - 1)) * g, g, g, f.iu[n], f.jv[n], 1, 1);
      }
      ctx.globalAlpha = 1;
      if (f.clip) ctx.restore();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      outline(f);
      ctx.strokeStyle = EDGE;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    arrow(a);
  };

  const writeReadout = () => {
    if (!readout) return;
    const span = Ls * MM / 1000;
    const am = Math.min(Math.max((aPos - xA) / Ls, 0), 1) * span, bm = span - am;
    const P = load * P_MAX;
    const M = (P * am * bm) / span;
    const sig = (M * 1e6) / SX;
    const pad = (v, n) => String(Math.round(v)).padStart(n, '0');
    // non-breaking inside each value, so a narrow screen wraps only between them
    readout.textContent = [`a ${am.toFixed(2)} m`, `P ${pad(P, 4)} kN`, `M ${pad(M, 4)} kN·m`, `σ ${pad(sig, 3)} MPa`]
      .map(v => v.replace(/ /g, ' '))
      .join(' · ');
  };

  const frame = now => {
    raf = 0;
    const dt = Math.min(0.1, (now - last) / 1000 || 0);
    last = now;
    if (!fine || !hover) {
      // no pointer on the beam: the load walks the span on its own
      const t = (now - t0) / 1000;
      aTarget = xA + Ls * (0.5 + 0.34 * Math.sin(t * 0.3));
      loadTarget = IDLE;
    }
    aPos += (aTarget - aPos) * Math.min(1, dt * 7);
    load += (loadTarget - load) * Math.min(1, dt * 3);
    if (seenAt && grow < 1) grow = Math.min(1, (now - seenAt) / 1800);

    pending += dt;
    odd = !odd;
    if (cost < 7 || odd) {
      const t1 = performance.now();
      draw(now, pending);
      cost += (performance.now() - t1 - cost) * 0.1;
      pending = 0;
    }
    if (now - lastReadout > 100) { lastReadout = now; writeReadout(); }
    if (running) raf = requestAnimationFrame(frame);
  };

  const start = () => {
    if (running || reduce) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  window.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    hover = x >= 0 && y >= 0 && x <= r.width && y <= r.height;
    if (!hover) return;
    // the load sits where the pointer projects onto the span, and grows as it nears the beam
    const [x0, y0] = at(xA, 0, NA), [x1, y1] = at(xB, 0, NA);
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
    const t = Math.min(1, Math.max(0, ((x - x0) * dx + (y - y0) * dy) / (len * len)));
    const dist = Math.abs((x - x0) * dy - (y - y0) * dx) / len;
    aTarget = xA + t * Ls;
    loadTarget = 0.25 + 0.75 * (1 - smooth(D * s * 0.5, D * s * 2.4, dist));
    if (reduce) { aPos = aTarget; load = loadTarget; draw(0); writeReadout(); }
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { hover = false; });

  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (e.intersectionRatio >= 0.25 && !seenAt) seenAt = performance.now();
    visible && !document.hidden ? start() : stop();
  }, { threshold: [0, 0.25, 0.5] }).observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden || !visible ? stop() : start()));

  new ResizeObserver(() => {
    const rel = (aPos - xA) / Ls;
    fit();
    aPos = aTarget = xA + rel * Ls;
    if (!running) draw(0);
  }).observe(canvas);

  if (document.fonts) {
    document.fonts.load('500 12px "Geist Mono"').then(() => { buildAtlas(); if (!running) draw(0); }).catch(() => {});
  }

  fit();
  aPos = aTarget = xA + Ls * 0.5;
  if (reduce) load = loadTarget = 0.85;
  draw(0);
  writeReadout();
})();
