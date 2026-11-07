/* Contact interlude: Claude Code's pixel mascot suits up. A lilac hard hat drops on, a T-square
   comes up into its hand and is leaned aside, a laptop opens, and 0s and 1s stream from the
   laptop to the email button. Plays once when the contact section scrolls in.
   The markup is the finished pose, so without GSAP (or with reduced motion) the scene is still. */
(() => {
  const stage = document.querySelector('[data-clawd]');
  if (!stage) return;
  const section = stage.closest('section');
  const svg = stage.querySelector('svg');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gsap = window.gsap, ST = window.ScrollTrigger;
  const motion = !!(gsap && ST) && !reduce;

  // ---- pixel art: one character per pixel, '.' is empty --------------------------------------
  const COLORS = {
    o: '#d97757', // mascot
    k: '#1a1410', // eyes
    h: '#a996e2', H: '#d6ccfa', // hard hat and its highlight
    d: '#24222b', l: '#a996e2', // laptop lid and logo
    g: '#5a5853',               // laptop base
    b: '#cfccc5', t: '#8d8a83', // T-square and its ticks
  };
  const NS = 'http://www.w3.org/2000/svg';
  const part = (name, rows, x0, y0, parent = svg) => {
    const g = document.createElementNS(NS, 'g');
    g.dataset.part = name;
    rows.forEach((row, y) => [...row].forEach((c, x) => {
      if (c === '.') return;
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', x0 + x);
      r.setAttribute('y', y0 + y);
      r.setAttribute('width', 1.02); // overlap a hair so no seams show between pixels
      r.setAttribute('height', 1.02);
      r.setAttribute('fill', COLORS[c]);
      g.append(r);
    }));
    parent.append(g);
    return g;
  };

  const mascot = document.createElementNS(NS, 'g');
  mascot.dataset.part = 'mascot';
  svg.append(mascot);
  const body = part('body', [
    '..oooooooooo..',
    '..oooooooooo..',
    '..oooooooooo..',
    '..oooooooooo..',
    '..oooooooooo..',
    '..oooooooooo..',
    '...o.o..o.o...',
    '...o.o..o.o...',
  ], 2, 3, mascot);
  // the laptop screen lights the face
  const glow = document.createElementNS(NS, 'rect');
  Object.entries({ x: 4, y: 3, width: 10, height: 6, fill: '#a996e2', opacity: 0.2 }).forEach(([k, v]) => glow.setAttribute(k, v));
  mascot.append(glow);
  const eyes = part('eyes', ['k....k', 'k....k'], 6, 4, mascot);
  const armL = part('arm-l', ['oo', 'oo'], 2, 6, mascot);
  const armR = part('arm-r', ['oo', 'oo'], 14, 6, mascot);
  const helmet = part('helmet', [
    '....hhhh....',
    '...hHHhhhh..',
    'hhhhhhhhhhhh',
  ], 3, 0, mascot);

  const ruler = part('ruler', [
    'bbb', '.b.', '.t.', '.b.', '.t.', '.b.', '.t.', '.b.', '.b.',
  ], 15, 3);
  const laptop = document.createElementNS(NS, 'g');
  laptop.dataset.part = 'laptop';
  svg.append(laptop);
  const lid = part('lid', ['dddddddd', 'dddllddd', 'dddddddd'], 5, 8, laptop);
  part('base', ['gggggggggg'], 4, 11, laptop);

  // finished pose: eyes on the screen, T-square leaning on the right
  eyes.setAttribute('transform', 'translate(0 1)');
  ruler.setAttribute('transform', 'translate(1.4 0) rotate(16 16.5 12)');

  if (!motion) return;

  // ---- binary stream: from the top of the lid to the email button ----------------------------
  const stream = (() => {
    const canvas = section.querySelector('[data-clawd-stream]');
    const mail = section.querySelector('.contact__mail');
    const ctx = canvas && canvas.getContext('2d');
    if (!ctx || !mail) return { start() {} };
    let on = false, visible = false, raf = 0, last = 0, acc = 0, W = 1, H = 1, dpr = 1;
    const bits = [];
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    };
    const frame = now => {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      const sr = canvas.getBoundingClientRect(), lr = lid.getBoundingClientRect(), mr = mail.getBoundingClientRect();
      const ax = lr.left + lr.width / 2 - sr.left, ay = lr.top - sr.top;
      const bx = mr.left + mr.width * 0.5 - sr.left, by = mr.top + mr.height * 0.5 - sr.top;
      // the arc rises out of the screen, then falls onto the button
      const cx = (ax + bx) / 2, cy = Math.min(ay, by) - Math.max(80, Math.abs(bx - ax) * 0.22);
      const nx = -(by - ay), ny = bx - ax, nl = Math.hypot(nx, ny) || 1;

      for (acc += dt * 24; acc >= 1; acc--) {
        bits.push({ t: 0, life: 2.2 + Math.random() * 1.4, off: Math.random() * 2 - 1, ch: Math.random() < 0.5 ? '0' : '1', size: 10 + Math.random() * 4, ink: Math.random() < 0.3 });
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = bits.length - 1; i >= 0; i--) {
        const b = bits[i];
        b.t += dt / b.life;
        if (b.t >= 1) { bits.splice(i, 1); continue; }
        if (Math.random() < dt * 1.5) b.ch = b.ch === '0' ? '1' : '0';
        const t = b.t, u = 1 - t;
        const spread = Math.sin(Math.PI * t) * 34 * b.off;
        const x = u * u * ax + 2 * u * t * cx + t * t * bx + (nx / nl) * spread;
        const y = u * u * ay + 2 * u * t * cy + t * t * by + (ny / nl) * spread;
        const a = Math.min(1, t / 0.08) * Math.min(1, (1 - t) / 0.25);
        ctx.globalAlpha = a * (b.ink ? 0.55 : 0.85);
        ctx.fillStyle = b.ink ? '#ece9e3' : '#a996e2';
        ctx.font = `500 ${b.size.toFixed(0)}px "Geist Mono", ui-monospace, monospace`;
        ctx.fillText(b.ch, x, y);
      }
      ctx.globalAlpha = 1;
      if (on && visible && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const wake = () => { if (on && visible && !raf && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    new ResizeObserver(resize).observe(canvas);
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; wake(); }).observe(section);
    document.addEventListener('visibilitychange', wake);
    return { start() { on = true; resize(); wake(); } };
  })();

  // ---- the routine ---------------------------------------------------------------------------
  gsap.set(eyes, { y: 0 });
  gsap.set(glow, { opacity: 0 });
  gsap.set(helmet, { y: -7, opacity: 0 });
  gsap.set(ruler, { x: 0, y: 4, rotation: 0, opacity: 0, svgOrigin: '16.5 12' });
  gsap.set(laptop, { y: 3, opacity: 0 });
  gsap.set(lid, { scaleY: 0, svgOrigin: '9 11' });

  gsap.to(mascot, { y: -0.3, duration: 0.9, ease: 'sine.inOut', yoyo: true, repeat: -1 });

  const type = () => {
    gsap.to(armL, { y: 0.5, duration: 0.14, ease: 'none', yoyo: true, repeat: -1 });
    gsap.to(armR, { y: 0.5, duration: 0.14, ease: 'none', yoyo: true, repeat: -1, delay: 0.14 });
  };

  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
  tl.to(helmet, { opacity: 1, duration: 0.1 }, 0)
    .to(helmet, { y: 0, duration: 0.7, ease: 'bounce.out' }, 0)
    .to(body, { scaleY: 0.92, svgOrigin: '9 11', duration: 0.08, yoyo: true, repeat: 1, ease: 'power1.out' }, 0.32)
    // the T-square comes up into the right hand, gets a tap, then is leaned aside
    .to(ruler, { y: 0, opacity: 1, duration: 0.5 }, 0.95)
    .to(ruler, { y: -0.7, duration: 0.16, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 1.55)
    .to(ruler, { x: 1.4, rotation: 16, duration: 0.6, ease: 'power2.inOut' }, 2.2)
    // laptop out, lid up, eyes down, screen glow on
    .to(laptop, { y: 0, opacity: 1, duration: 0.5 }, 2.6)
    .to(lid, { scaleY: 1, duration: 0.45, ease: 'back.out(2)' }, 2.95)
    .to(eyes, { y: 1, duration: 0.25 }, 3.0)
    .to(glow, { opacity: 0.2, duration: 0.6 }, 3.15)
    .add(() => { type(); stream.start(); }, 3.35);

  ST.create({ trigger: section, start: 'top 65%', once: true, onEnter: () => tl.play() });
})();
