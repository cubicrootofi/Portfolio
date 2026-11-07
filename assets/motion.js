/* A single motion preference for the studies, field, beam and interface. */
(() => {
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let preference = null;
  try { preference = localStorage.getItem('ys-motion'); } catch {}
  const state = {
    paused: preference ? preference === 'paused' : media.matches,
    set(paused, persist = true) {
      this.paused = paused;
      document.documentElement.dataset.motion = paused ? 'paused' : 'playing';
      if (persist) { try { localStorage.setItem('ys-motion', paused ? 'paused' : 'playing'); } catch {} }
      window.dispatchEvent(new CustomEvent('portfolio:motion', { detail: { paused } }));
    }
  };
  window.portfolioMotion = state;
  document.documentElement.dataset.motion = state.paused ? 'paused' : 'playing';
  media.addEventListener('change', e => state.set(e.matches, false));
})();
