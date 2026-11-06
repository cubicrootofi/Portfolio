/* Portfolio interactions. GSAP, ScrollTrigger and Lenis are all optional:
   without them the page is a plain, fully readable document. */
(() => {
  const html = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const gsap = window.gsap;
  const motion = !!(gsap && window.ScrollTrigger) && !reduce;
  let lenis = null;
  let cursorFor = null;  // re-reads an element's cursor label while the pointer stays on it
  let previewFor = null; // re-syncs the floating preview for a row that just opened or closed

  $$('[data-plate]').forEach(el => { el.innerHTML = plate(el.dataset.plate, el.dataset.code || ''); });
  startClock();
  setupAccordion();
  lightbox();
  inlineVideos();

  if (!motion) {
    html.classList.add('no-motion');
    $('.loader')?.remove();
    $('.hero__title')?.classList.remove('is-masked');
    anchors(null);
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  if (window.Lenis) {
    lenis = new Lenis({ lerp: 0.085 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  $$('[data-chars]').forEach(el => split(el, 'chars'));
  $$('[data-split]').forEach(el => split(el, 'words'));
  $$('[data-words]').forEach(el => split(el, 'words'));

  anchors(lenis);
  navState();
  reveals();
  marquee();
  workPreview();
  gallery();
  counters();
  cursor();
  magnetic();

  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  Promise.race([fontsReady, new Promise(r => setTimeout(r, 1800))]).then(intro);
  window.addEventListener('load', () => ScrollTrigger.refresh());

  /* ------------------------------------------------------------------ */

  // Wrap words (and optionally characters) in spans, keeping inline elements like <em>.
  function split(el, mode) {
    const walk = node => {
      [...node.childNodes].forEach(child => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(tok => {
            if (!tok) return;
            if (/^\s+$/.test(tok)) { frag.append(' '); return; }
            const w = document.createElement('span');
            w.className = 'w';
            if (mode === 'chars') {
              [...tok].forEach(c => {
                const s = document.createElement('span');
                s.className = 'ch';
                s.textContent = c;
                w.append(s);
              });
            } else {
              const i = document.createElement('span');
              i.className = 'wi';
              i.textContent = tok;
              w.append(i);
            }
            frag.append(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.tagName !== 'BR') {
          walk(child);
        }
      });
    };
    walk(el);
  }

  function intro() {
    const loader = $('.loader');
    const count = $('[data-loader-count]');
    const title = $('.hero__title');
    const chars = $$('.ch', title);
    const fade = [...$$('.hero__top > *'), ...$$('.hero__bottom > *')];
    loader?.classList.add('is-run');

    gsap.set(chars, { yPercent: 115 });
    gsap.set(fade, { y: 16, opacity: 0 });
    gsap.set('#field', { opacity: 0 });
    gsap.set('.nav', { opacity: 0 });

    const n = { v: 0 };
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.to(n, {
      v: 100, duration: 1.25, ease: 'power2.inOut',
      onUpdate: () => { if (count) count.textContent = String(Math.round(n.v)).padStart(3, '0'); },
    }, 0)
      .to('.loader__bar i', { scaleX: 1, duration: 1.25, ease: 'power2.inOut' }, 0)
      .to(loader, { yPercent: -100, duration: 1.1, ease: 'expo.inOut' }, 1.35)
      .to('#field', { opacity: 1, duration: 2.2, ease: 'power2.out' }, 1.8)
      .to(chars, { yPercent: 0, duration: 1.5, stagger: 0.04 }, 1.75)
      .to(fade, { y: 0, opacity: 1, duration: 1.2, stagger: 0.07 }, 2.05)
      .to('.nav', { opacity: 1, duration: 1 }, 2.2)
      .add(() => {
        loader?.remove();
        title.classList.remove('is-masked');
        gsap.set(chars, { clearProps: 'transform' });
        heroBeam(title, chars);
      }, 3.3);

    // the title drifts up and away as the hero scrolls out
    gsap.to('.hero__title', {
      yPercent: -14, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
    });
    gsap.to('#field', {
      yPercent: 18, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
    });
  }

  // The name behaves like a simply supported beam: the pointer is a point load,
  // and each letter drops by the elastic deflection at its position along the span.
  function heroBeam(title, chars) {
    if (!fine || !chars.length) return;
    const lines = $$('.hero__line', title).map(line => {
      const cs = $$('.ch', line);
      return {
        line,
        cs,
        ys: cs.map(c => gsap.quickTo(c, 'y', { duration: 1.1, ease: 'elastic.out(1, 0.35)' })),
        hs: cs.map(c => gsap.quickTo(c, '--heat', { duration: 0.6, ease: 'power3' })),
      };
    });
    let geo = [];
    const measure = () => {
      geo = lines.map(({ line, cs }) => {
        const rects = cs.map(c => c.getBoundingClientRect());
        const left = rects[0].left, right = rects[rects.length - 1].right;
        const lr = line.getBoundingClientRect();
        return { left, L: right - left, top: lr.top, bottom: lr.bottom, mids: rects.map(r => (r.left + r.right) / 2 - left), size: lr.height };
      });
    };
    const release = () => lines.forEach(l => { l.ys.forEach(f => f(0)); l.hs.forEach(f => f(0)); });

    title.addEventListener('pointerenter', measure);
    title.addEventListener('pointermove', e => {
      if (!geo.length) measure();
      lines.forEach((l, li) => {
        const g = geo[li];
        const onLine = e.clientY >= g.top && e.clientY <= g.bottom;
        const L = g.L;
        const a = Math.min(Math.max(e.clientX - g.left, 0), L);
        const b = L - a;
        l.cs.forEach((c, i) => {
          if (!onLine) { l.ys[i](0); l.hs[i](0); return; }
          const x = g.mids[i];
          // delta(x) for a point load P at a, normalised so a midspan load gives 1 at midspan
          const d = x <= a
            ? (8 * b * x * (L * L - b * b - x * x)) / L ** 4
            : (8 * a * (L - x) * (L * L - a * a - (L - x) ** 2)) / L ** 4;
          const dn = Math.max(0, d);
          l.ys[i](dn * g.size * 0.085);
          l.hs[i](Math.min(1, dn * 1.1));
        });
      });
    });
    title.addEventListener('pointerleave', release);
    window.addEventListener('resize', () => { geo = []; });
    window.addEventListener('scroll', () => { geo = []; }, { passive: true });
  }

  function anchors(lenis) {
    const go = target => {
      if (lenis) lenis.scrollTo(target, { duration: 1.6, easing: t => 1 - Math.pow(1 - t, 4) });
      else (target === 0 ? document.body : target).scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    };
    $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id === '#') return;
      const t = id === '#top' ? 0 : $(id);
      if (t === null) return;
      e.preventDefault();
      go(t);
    }));
    $('[data-top]')?.addEventListener('click', () => go(0));
  }

  function navState() {
    const nav = $('.nav');
    const prog = $('[data-progress]');
    let last = scrollY;
    const update = () => {
      const y = scrollY;
      const max = document.documentElement.scrollHeight - innerHeight;
      if (Math.abs(y - last) > 4) {
        nav.classList.toggle('is-hidden', y > last && y > 160);
        last = y;
      }
      if (prog) prog.textContent = String(Math.round((max > 0 ? y / max : 0) * 100)).padStart(3, '0');
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  function reveals() {
    $$('[data-split]').forEach(el => {
      gsap.from($$('.wi', el), {
        yPercent: 110, duration: 1.3, ease: 'expo.out', stagger: 0.05,
        scrollTrigger: { trigger: el, start: 'top 86%' },
      });
    });

    $$('[data-words]').forEach(el => {
      gsap.fromTo($$('.wi', el), { opacity: 0.12 }, {
        opacity: 1, ease: 'none', stagger: 0.1,
        scrollTrigger: { trigger: el, start: 'top 78%', end: 'bottom 48%', scrub: true },
      });
    });

    $$('[data-stagger]').forEach(el => {
      gsap.from(el.children, {
        y: 28, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.07,
        scrollTrigger: { trigger: el, start: 'top 88%' },
      });
    });

    $$('.work__row').forEach(row => {
      gsap.from(row, {
        y: 30, opacity: 0, duration: 1.1, ease: 'expo.out',
        scrollTrigger: { trigger: row, start: 'top 94%' },
      });
    });

    $$('.label, .section__note, .gallery__quote, .gallery__lede, .gallery__facts, .contact__row, .kit__grid > div').forEach(el => {
      gsap.from(el, {
        y: 24, opacity: 0, duration: 1.1, ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 92%' },
      });
    });
  }

  // Scroll-reactive ticker: speeds up with scroll velocity and follows scroll direction.
  function marquee() {
    const track = $('[data-marquee]');
    if (!track) return;
    const group = track.firstElementChild;
    const clone = group.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    track.append(clone);

    let width = group.offsetWidth, x = 0, dir = -1, vel = 0, lastY = scrollY, onScreen = true;
    new ResizeObserver(() => { width = group.offsetWidth; }).observe(group);
    new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }).observe(track);

    gsap.ticker.add((time, dt) => {
      const y = scrollY;
      const dy = y - lastY;
      lastY = y;
      if (!onScreen || !width) return;
      if (dy) dir = dy > 0 ? -1 : 1;
      vel += (Math.min(Math.abs(dy), 90) - vel) * 0.08;
      x += dir * (0.55 + vel * 0.32) * (dt / 16.67);
      if (x <= -width) x += width;
      if (x > 0) x -= width;
      gsap.set(track, { x, skewX: dir * Math.min(vel * 0.1, 7) });
    });
  }

  function setupAccordion() {
    $$('.work__row').forEach(row => {
      const head = $('.work__head', row);
      head.addEventListener('click', () => toggle(row, head.getAttribute('aria-expanded') !== 'true'));
    });

    function toggle(row, open) {
      const head = $('.work__head', row);
      const body = $('.work__body', row);
      head.setAttribute('aria-expanded', String(open));
      row.classList.toggle('is-open', open);
      head.dataset.cursor = open ? 'Close' : 'Open';
      if (head.matches(':hover')) { cursorFor?.(head); previewFor?.(row); }
      if (!motion) { body.hidden = !open; return; }
      gsap.killTweensOf(body);
      if (open) {
        body.hidden = false;
        gsap.fromTo(body, { height: 0 }, { height: 'auto', duration: 0.9, ease: 'expo.out', onComplete: refresh });
        gsap.fromTo($$('.work__thumb, .work__copy > *', body), { y: 22, opacity: 0 }, {
          y: 0, opacity: 1, duration: 0.9, ease: 'expo.out', stagger: 0.05, delay: 0.06,
        });
      } else {
        gsap.to(body, {
          height: 0, duration: 0.6, ease: 'expo.inOut',
          onComplete: () => { body.hidden = true; gsap.set(body, { clearProps: 'height' }); refresh(); },
        });
      }
    }

    function refresh() { if (window.ScrollTrigger) ScrollTrigger.refresh(); }
  }

  // Click a project image (or drawing) to see it full size. The frame grows out of the
  // thumbnail and shrinks back into it; Esc, a click anywhere or the Close button dismiss it.
  function lightbox() {
    const thumbs = $$('.work__body .work__thumb');
    if (!thumbs.length) return;

    const box = document.createElement('div');
    box.className = 'lightbox';
    box.hidden = true;
    box.dataset.cursor = 'Close';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Expanded image');
    box.innerHTML = '<div class="lightbox__frame"></div><p class="lightbox__cap mono"></p>'
      + '<button class="lightbox__close mono" type="button">Close ✕</button>';
    document.body.append(box);
    const frame = $('.lightbox__frame', box);
    const cap = $('.lightbox__cap', box);
    const closeBtn = $('.lightbox__close', box);
    let current = null, state = 'closed', tl = null, ratio = 16 / 10;

    thumbs.forEach(t => {
      const title = $('.work__title', t.closest('.work__row'))?.textContent.trim();
      const kind = $('video', t) ? 'video' : 'image';
      t.tabIndex = 0;
      t.setAttribute('role', 'button');
      t.setAttribute('aria-label', title ? `Expand ${kind}: ${title}` : `Expand ${kind}`);
      t.dataset.cursor = 'Expand';
      t.addEventListener('click', () => open(t));
      t.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(t); }
      });
    });

    // clicks on a video's controls must not dismiss it
    box.addEventListener('click', e => { if (!e.target.closest('video')) close(); });
    document.addEventListener('keydown', e => {
      if (box.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') { e.preventDefault(); closeBtn.focus(); }
    });
    window.addEventListener('resize', () => { if (state === 'open') place(fit()); });

    const rectOf = el => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    };
    const place = r => {
      Object.assign(frame.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    };
    // largest box with the image's own proportions, leaving room for the caption and Close
    const fit = () => {
      const maxW = Math.min(innerWidth - 32, 1680);
      const maxH = innerHeight - 120;
      let w = maxW, h = w / ratio;
      if (h > maxH) { h = maxH; w = h * ratio; }
      return { left: (innerWidth - w) / 2, top: (innerHeight - h) / 2, width: w, height: h };
    };

    function open(t) {
      if (state !== 'closed') return;
      state = 'opening';
      current = t;
      const vid = $('video', t);
      const src = $('img', t);
      frame.innerHTML = '';
      if (vid) {
        // a full-size copy with controls, picking up where the inline clip was
        ratio = vid.videoWidth ? vid.videoWidth / vid.videoHeight : 16 / 9;
        const v = vid.cloneNode(true);
        v.controls = true;
        v.loop = true;
        v.playsInline = true;
        v.muted = !vid.hasAttribute('data-sound');
        v.dataset.cursor = '';
        v.addEventListener('loadedmetadata', () => { v.currentTime = vid.currentTime; }, { once: true });
        vid.pause();
        frame.append(v);
        v.play().catch(() => {});
        cap.textContent = vid.getAttribute('aria-label') || $('.work__title', t.closest('.work__row'))?.textContent.trim() || '';
      } else if (src) {
        // the thumbnail is already loaded, so its proportions are known up front
        ratio = src.naturalWidth ? src.naturalWidth / src.naturalHeight : 16 / 10;
        const img = new Image();
        img.src = src.currentSrc || src.src;
        img.alt = src.alt;
        frame.append(img);
        cap.textContent = src.alt;
      } else {
        ratio = 16 / 10;
        frame.innerHTML = t.innerHTML;
        cap.textContent = t.dataset.code || '';
      }

      lenis?.stop();
      html.classList.add('is-locked');
      box.hidden = false;
      closeBtn.focus({ preventScroll: true });
      const from = rectOf(t), to = fit();

      if (!motion) { place(to); state = 'open'; return; }
      place(from);
      t.style.visibility = 'hidden';
      tl = gsap.timeline({ onComplete: () => { state = 'open'; } })
        .fromTo(box, { backgroundColor: 'rgba(10, 10, 11, 0)' }, { backgroundColor: 'rgba(10, 10, 11, 0.94)', duration: 0.6, ease: 'power2.out' }, 0)
        .fromTo(frame, from, { ...to, duration: 0.95, ease: 'expo.inOut' }, 0)
        .fromTo([cap, closeBtn], { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'expo.out', stagger: 0.05 }, 0.6);
    }

    // also interrupts an opening that is still in flight, shrinking back from wherever it got to
    function close() {
      if (state !== 'open' && state !== 'opening') return;
      state = 'closing';
      tl?.kill();
      const t = current;
      const done = () => {
        const lv = $('video', frame), tv = $('video', t);
        if (lv && tv) {
          tv.currentTime = lv.currentTime;
          if (!reduce) tv.play().catch(() => {});
        }
        box.hidden = true;
        frame.innerHTML = '';
        t.style.visibility = '';
        html.classList.remove('is-locked');
        lenis?.start();
        state = 'closed';
        t.focus({ preventScroll: true });
      };
      if (!motion) { done(); return; }
      tl = gsap.timeline({ onComplete: done })
        .to([cap, closeBtn], { opacity: 0, duration: 0.25 }, 0)
        .to(frame, { ...rectOf(t), duration: 0.8, ease: 'expo.inOut' }, 0)
        .to(box, { backgroundColor: 'rgba(10, 10, 11, 0)', duration: 0.6, ease: 'power2.in' }, 0.2);
    }
  }

  // Clips in project thumbnails and the gallery play muted while on screen and pause once
  // they leave it. With reduced motion they stay on their poster; the lightbox still plays them.
  function inlineVideos() {
    const vids = $$('.work__thumb video, .shot__frame video');
    if (!vids.length) return;
    vids.forEach(v => {
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.setAttribute('playsinline', '');
      v.controls = false;
      v.disablePictureInPicture = true;
      if (!v.hasAttribute('preload')) v.preload = 'metadata';
    });
    if (reduce) return;
    const io = new IntersectionObserver(entries => entries.forEach(({ target: v, isIntersecting }) => {
      const expanded = v.closest('.work__thumb')?.style.visibility === 'hidden';
      if (isIntersecting && !expanded) v.play().catch(() => {});
      else v.pause();
    }), { threshold: 0.35 });
    vids.forEach(v => io.observe(v));
  }

  // A floating preview that trails the cursor across the work list.
  function workPreview() {
    if (!fine || !matchMedia('(min-width: 900px)').matches) return;
    const list = $('.work__list');
    const preview = $('.preview');
    const inner = $('.preview__inner');
    const rows = $$('.work__row');

    const items = rows.map(row => {
      const item = document.createElement('div');
      item.className = 'preview__item';
      const thumbVid = $('.work__thumb video', row);
      const clip = row.dataset.video
        || (thumbVid && (thumbVid.getAttribute('src') || $('source', thumbVid)?.getAttribute('src')));
      if (clip) {
        const v = document.createElement('video');
        v.src = clip;
        v.muted = true;
        v.loop = true;
        v.playsInline = true;
        v.setAttribute('playsinline', '');
        v.preload = 'none';
        item.append(v);
      } else if (row.dataset.img) {
        const img = new Image();
        img.src = row.dataset.img;
        img.alt = '';
        img.decoding = 'async';
        item.append(img);
      } else {
        item.innerHTML = plate(row.dataset.kind || 'ph', row.dataset.code || '');
      }
      inner.append(item);
      return item;
    });

    gsap.set(preview, { yPercent: -50, scale: 0.7 });
    const xTo = gsap.quickTo(preview, 'x', { duration: 0.75, ease: 'power3' });
    const yTo = gsap.quickTo(preview, 'y', { duration: 0.75, ease: 'power3' });
    const rTo = gsap.quickTo(preview, 'rotation', { duration: 0.9, ease: 'power3' });
    let active = -1, z = 1, shown = false, lastX = 0, rot = 0, pw = preview.offsetWidth;
    window.addEventListener('resize', () => { pw = preview.offsetWidth; });

    // only the active preview's clip runs; everything pauses when the preview hides
    const playOnly = i => items.forEach((it, j) => {
      const v = $('video', it);
      if (!v) return;
      if (j === i) { v.preload = 'auto'; v.play().catch(() => {}); } else v.pause();
    });
    const show = on => {
      if (on === shown) return;
      shown = on;
      if (!on) playOnly(-1);
      gsap.to(preview, { opacity: on ? 1 : 0, scale: on ? 1 : 0.7, duration: 0.6, ease: 'expo.out', overwrite: 'auto' });
    };
    const activate = i => {
      if (i === active) return;
      active = i;
      const it = items[i];
      it.style.zIndex = ++z;
      gsap.fromTo(it, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.8, ease: 'expo.out' });
      gsap.fromTo(it.firstElementChild, { scale: 1.25 }, { scale: 1, duration: 1.1, ease: 'expo.out' });
    };

    window.addEventListener('pointermove', e => {
      const x = Math.min(e.clientX + 28, innerWidth - pw - 20);
      xTo(x);
      yTo(e.clientY);
      rot += (e.clientX - lastX) * 0.25;
      lastX = e.clientX;
    }, { passive: true });
    gsap.ticker.add(() => {
      rot *= 0.88;
      rTo(gsap.utils.clamp(-9, 9, rot));
    });

    // an open row already shows its image, so only closed rows get the preview
    const sync = (row, i) => {
      if (row.classList.contains('is-open')) { show(false); return; }
      show(true);
      activate(i);
      playOnly(i);
    };
    previewFor = row => sync(row, rows.indexOf(row));

    rows.forEach((row, i) => {
      $('.work__head', row).addEventListener('pointerenter', () => sync(row, i));
      $('.work__body', row).addEventListener('pointerenter', () => show(false));
    });
    list.addEventListener('pointerleave', () => show(false));
    window.addEventListener('scroll', () => { if (shown && !list.matches(':hover')) show(false); }, { passive: true });
  }

  // ETABS Co-Pilot: vertical scroll drives a horizontal track while the section is pinned.
  function gallery() {
    const sec = $('.gallery');
    if (!sec) return;
    const viewport = $('.gallery__viewport', sec);
    const track = $('.gallery__track', sec);
    const bar = $('.gallery__bar i', sec);
    const count = $('[data-gal-count]', sec);
    const shots = $$('.shot', sec);

    gsap.matchMedia().add('(min-width: 900px)', () => {
      sec.classList.add('is-pinned');
      const dist = () => Math.max(0, track.scrollWidth - viewport.clientWidth);
      const tween = gsap.to(track, {
        x: () => -dist(),
        ease: 'none',
        scrollTrigger: {
          trigger: sec,
          start: 'top top',
          end: () => '+=' + dist(),
          pin: true,
          scrub: 0.8,
          invalidateOnRefresh: true,
          anticipatePin: 1,
          onUpdate: self => {
            if (bar) gsap.set(bar, { scaleX: self.progress });
            if (count) count.textContent = String(Math.min(shots.length, Math.floor(self.progress * shots.length) + 1)).padStart(2, '0');
          },
        },
      });
      shots.forEach(s => {
        gsap.fromTo($('img, video', s), { xPercent: -4 }, {
          xPercent: 4, ease: 'none',
          scrollTrigger: { trigger: s, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true },
        });
      });
      return () => sec.classList.remove('is-pinned');
    });
  }

  function counters() {
    $$('[data-count]').forEach(el => {
      const end = Number(el.dataset.count);
      const pre = el.dataset.prefix || '';
      const suf = el.dataset.suffix || '';
      const o = { v: 0 };
      const paint = () => { el.textContent = pre + Math.round(o.v).toLocaleString('en-US') + suf; };
      paint();
      ScrollTrigger.create({
        trigger: el,
        start: 'top 90%',
        once: true,
        onEnter: () => gsap.to(o, { v: end, duration: 1.8, ease: 'expo.out', onUpdate: paint }),
      });
    });
  }

  function cursor() {
    if (!fine) return;
    const c = $('.cursor');
    const dot = $('.cursor__dot', c);
    const ring = $('.cursor__ring', c);
    const label = $('.cursor__label', c);
    html.classList.add('has-cursor');
    gsap.set([dot, ring], { x: -100, y: -100 });
    const dx = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3' });
    const dy = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3' });
    const rx = gsap.quickTo(ring, 'x', { duration: 0.55, ease: 'power3' });
    const ry = gsap.quickTo(ring, 'y', { duration: 0.55, ease: 'power3' });

    window.addEventListener('pointermove', e => {
      dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
      c.style.opacity = 1;
    }, { passive: true });
    const setFor = el => {
      const t = el && el.closest('[data-cursor], a, button');
      const text = t && t.dataset.cursor;
      c.classList.toggle('is-label', !!text);
      c.classList.toggle('is-hover', !!t && !text);
      if (text) label.textContent = text;
    };
    cursorFor = setFor;
    document.addEventListener('pointerover', e => setFor(e.target));
    document.addEventListener('pointerdown', () => c.classList.add('is-down'));
    document.addEventListener('pointerup', () => c.classList.remove('is-down'));
    html.addEventListener('pointerleave', () => { c.style.opacity = 0; });
  }

  function magnetic() {
    if (!fine) return;
    $$('[data-magnetic]').forEach(el => {
      const xTo = gsap.quickTo(el, 'x', { duration: 0.7, ease: 'power3' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.7, ease: 'power3' });
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * 0.28);
        yTo((e.clientY - r.top - r.height / 2) * 0.4);
      });
      el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
  }

  function startClock() {
    const el = $('[data-clock]');
    if (!el) return;
    let fmt;
    try {
      fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: el.dataset.tz || undefined });
    } catch {
      fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
    const tick = () => { el.textContent = fmt.format(new Date()); };
    tick();
    setInterval(tick, 15000);
  }

  /* ------------------------------------------------------------------
     Drawing plates: small engineering sheets for projects without a screenshot
     ------------------------------------------------------------------ */

  function plate(kind, code) {
    const W = 480, H = 300;
    const n = v => (+v).toFixed(1);
    const L = (x1, y1, x2, y2, c = 's') => `<line class="${c}" x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}"/>`;
    const R = (x, y, w, h, c = 's', rx = 0) => `<rect class="${c}" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${rx}"/>`;
    const C = (x, y, r, c = 's') => `<circle class="${c}" cx="${n(x)}" cy="${n(y)}" r="${r}"/>`;
    const T = (x, y, s, a = 'start', c = 't') => `<text class="${c}" x="${n(x)}" y="${n(y)}" text-anchor="${a}">${s}</text>`;
    const P = (pts, c = 's') => `<polyline class="${c}" points="${pts.map(p => p.map(n).join(',')).join(' ')}"/>`;

    const draw = {
      // Lumi: a question, an answer with generated code, and the approval gate
      chat() {
        let s = T(26, 36, 'LUMI · ETABS · KN·M·°C');
        s += R(220, 50, 220, 40, 's', 12) + R(236, 64, 140, 4, 'f') + R(236, 74, 90, 4, 'f');
        s += R(40, 104, 300, 104, 's', 12);
        [[56, 124, 180], [56, 138, 236], [70, 152, 196], [70, 166, 150], [56, 180, 210]]
          .forEach(([x, y, w], i) => { s += R(x, y, w, 4, i === 2 ? 'af' : 'f'); });
        s += R(40, 220, 90, 24, 'a', 12) + T(85, 236, 'APPROVE', 'middle', 't ta');
        s += R(140, 220, 76, 24, 's s2', 12) + T(178, 236, 'REJECT', 'middle');
        return s;
      },

      // Manta: a shell mesh, undeformed and in its first mode
      mesh() {
        let s = T(26, 36, 'OPENSEES · MODE 1');
        const nx = 13, ny = 7;
        const pt = (u, v, def) => {
          const z = def ? 34 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v) : 0;
          return [80 + 270 * u + 70 * v, 62 + 120 * v + z];
        };
        for (let j = 0; j < ny; j++) {
          const flat = [], bent = [];
          for (let i = 0; i < nx; i++) {
            flat.push(pt(i / (nx - 1), j / (ny - 1), false));
            bent.push(pt(i / (nx - 1), j / (ny - 1), true));
          }
          s += P(flat, 's s2') + P(bent, j === (ny - 1) / 2 ? 'a' : 's');
        }
        for (let i = 0; i < nx; i++) {
          const col = [];
          for (let j = 0; j < ny; j++) col.push(pt(i / (nx - 1), j / (ny - 1), true));
          s += P(col, i === (nx - 1) / 2 ? 'a' : 's');
        }
        [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([u, v]) => {
          const [x, y] = pt(u, v, false);
          s += P([[x - 6, y + 10], [x, y], [x + 6, y + 10], [x - 6, y + 10]], 's');
        });
        return s;
      },

      // CANOPUS: grid bubbles, typed members, one member tagged
      typed() {
        const xs = [100, 196, 292, 388], ys = [80, 140, 200], ab = 'ABCD';
        let s = '';
        xs.forEach((x, i) => { s += L(x, 50, x, 222, 's s2 d') + C(x, 38, 9) + T(x, 41.5, ab[i], 'middle'); });
        ys.forEach((y, j) => { s += L(60, y, 424, y, 's s2 d') + C(44, y, 9) + T(44, y + 3.5, String(3 - j), 'middle'); });
        ys.forEach(y => { s += L(xs[0], y, xs[3], y); });
        xs.forEach(x => ys.forEach(y => { s += R(x - 4, y - 4, 8, 8, 'f'); }));
        s += L(xs[1], ys[1], xs[2], ys[1], 'a bw');
        s += R(190, 102, 108, 22, 'tag', 3) + T(244, 116.5, 'B-204 · IPE 300', 'middle', 't ta');
        return s;
      },

      // Revit × CSi Steel: two models overlaid, one near miss and one missing brace
      pair() {
        const xs = [110, 240, 370], ys = [70, 145, 220];
        let s = T(26, 36, 'SAP2000 ⇄ REVIT · 2 FINDINGS');
        xs.forEach(x => { s += L(x, ys[0], x, ys[2]); });
        ys.slice(0, 2).forEach(y => { s += L(xs[0], y, xs[2], y); });
        s += L(80, 220, 400, 220, 's s2');
        for (let x = 86; x < 400; x += 12) s += L(x, 220, x - 8, 230, 's s2');
        s += L(xs[1], ys[1] + 11, xs[2], ys[1] + 11, 'a d');
        s += L(392, ys[1], 392, ys[1] + 11, 'a') + T(400, ys[1] + 9, 'Δ 42', 'start', 't ta');
        s += L(xs[0], ys[2], xs[1], ys[1], 'a d');
        s += T(150, 196, 'MISSING', 'middle', 't ta');
        return s;
      },

      // RevitDelta: drop panels at columns, one that disagrees
      slab() {
        const xs = [90, 190, 290, 390], ys = [74, 144, 214];
        let s = T(26, 36, 'LEVEL 04 · DROP PANELS');
        ys.forEach(y => { s += L(xs[0], y, xs[3], y, 's s2'); });
        xs.forEach(x => { s += L(x, ys[0], x, ys[2], 's s2'); });
        xs.forEach((x, i) => ys.forEach((y, j) => {
          const hit = i === 2 && j === 1;
          s += R(x - 22, y - 16, 44, 32, hit ? 'a' : 's') + R(x - 4, y - 4, 8, 8, 'f');
          if (hit) s += R(x - 28, y - 22, 56, 44, 'a d');
        }));
        s += R(222, 96, 92, 20, 'tag', 3) + T(268, 109.5, 'DP-07 · Δ 150', 'middle', 't ta');
        return s;
      },

      // IDEA StatiCa: beam-to-column end plate with the forces that go in
      joint() {
        let s = T(26, 36, 'JOINT J-118 · END PLATE');
        s += L(170, 44, 170, 244) + L(206, 44, 206, 244) + L(188, 44, 188, 244, 's s2');
        s += R(206, 100, 8, 84);
        s += L(214, 112, 380, 112) + L(214, 172, 380, 172) + L(214, 142, 380, 142, 's s2 d');
        s += L(170, 112, 206, 112, 's s2') + L(170, 172, 206, 172, 's s2');
        [116, 132, 152, 168].forEach(y => { s += C(210, y, 2.6, 'af'); });
        s += L(392, 142, 444, 142, 'a') + P([[436, 136], [444, 142], [436, 148]], 'a') + T(448, 138, 'N', 'start', 't ta');
        s += L(410, 72, 410, 124, 'a') + P([[404, 116], [410, 124], [416, 116]], 'a') + T(418, 82, 'VZ', 'start', 't ta');
        s += `<path class="a" d="M 392 196 A 44 44 0 0 0 446 176"/>` + P([[438, 174], [446, 176], [446, 184]], 'a') + T(420, 218, 'MY', 'start', 't ta');
        return s;
      },

      // S&B Toolbox: a catalogue of tool tiles, one with an update waiting
      tiles() {
        let s = R(40, 30, 400, 24, 's', 4) + T(54, 46, 'S&amp;B TOOLBOX') + C(424, 42, 4, 'af');
        for (let r = 0; r < 2; r++) {
          for (let c = 0; c < 4; c++) {
            const x = 40 + c * 102, y = 68 + r * 88;
            const hot = r === 0 && c === 1;
            s += R(x, y, 94, 76, hot ? 'a' : 's', 6) + C(x + 18, y + 20, 7, hot ? 'a' : 's s2');
            s += R(x + 12, y + 46, 54, 4, 'f') + R(x + 12, y + 56, 34, 4, 'f');
            if (hot) s += T(x + 86, y + 24, 'V2.4 ↑', 'end', 't ta');
          }
        }
        return s;
      },

      // CDT.SDK: surfaces, accent, type and controls
      tokens() {
        let s = '';
        [0.05, 0.1, 0.17, 0.27, 0.45].forEach((o, i) => {
          s += `<rect x="${40 + i * 44}" y="40" width="36" height="36" rx="4" fill="#ece9e3" fill-opacity="${o}"/>`;
        });
        s += R(272, 40, 36, 36, 'af', 4);
        s += T(40, 94, 'SURFACE 0–4') + T(272, 94, 'ACCENT');
        s += `<text class="serif" x="36" y="212">Aa</text>`;
        s += R(262, 136, 44, 22, 'a', 11) + C(295, 147, 7, 'af') + T(318, 151, 'DARK THEME');
        s += L(262, 196, 432, 196, 's s2') + L(262, 196, 360, 196, 'a') + C(360, 196, 6, 'af');
        return s;
      },

      // ORCA: inter-story drift profile against its limit
      drift() {
        const x0 = 70, x1 = 430, y0 = 58, y1 = 236;
        let s = T(26, 36, 'STORY DRIFT · EQX') + L(x0, y0, x0, y1) + L(x0, y1, x1, y1);
        const nS = 10, a = [], b = [];
        for (let k = 0; k <= nS; k++) {
          const y = y1 - ((y1 - y0) * k) / nS;
          const u = k / nS;
          a.push([x0 + 250 * Math.sin(Math.PI * u * 0.82) * (0.75 + 0.25 * u), y]);
          b.push([x0 + 190 * Math.sin(Math.PI * u * 0.9) * (0.8 + 0.2 * u), y]);
          s += L(x0 - 4, y, x0, y);
          if (k % 2 === 0) s += T(x0 - 9, y + 3, 'L' + k, 'end');
        }
        s += P(b, 's s2') + P(a, 's');
        a.forEach(([x, y]) => { s += C(x, y, 1.8, 'f'); });
        s += L(x0 + 290, y0, x0 + 290, y1, 'a d') + T(x0 + 296, y0 + 10, 'H/500', 'start', 't ta');
        return s;
      },

      // Open slot
      ph() {
        return R(150, 64, 180, 130, 's d', 6) + L(240, 110, 240, 150) + L(220, 130, 260, 130) + T(240, 222, 'ADD A PROJECT', 'middle');
      },
    };

    const body = (draw[kind] || draw.ph)();
    const label = code.toUpperCase().replace(/&(?!amp;)/g, '&amp;');
    return `<svg class="plate" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">`
      + R(12.5, 12.5, W - 25, H - 25, 's s2')
      + body
      + L(12, H - 40, W - 12, H - 40, 's s2')
      + T(26, H - 22, label)
      + T(W - 26, H - 22, 'NTS', 'end')
      + `</svg>`;
  }
})();
