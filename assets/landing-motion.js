/* Finite, once-per-visit count-up to the supplied illustrative totals. */
(() => {
  const dialog = document.getElementById('figuresDialog');
  document.getElementById('aboutFigures')?.addEventListener('click', () => dialog?.showModal());
  const group = document.querySelector('.stats-live');
  if (!group) return;
  const counters = ['statCreators', 'statClips'].map(id => document.getElementById(id)).filter(Boolean);
  const totals = counters.map(el => Number(el.textContent.replace(/,/g,'')));
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let started = false;
  const run = () => {
    if (started) return;
    started = true;
    if (reduce?.matches) return;
    let start;
    const frame = now => {
      start ??= now;
      const progress = Math.min(1, (now-start)/1800);
      const eased = 1 - Math.pow(1-progress,3);
      counters.forEach((el,i) => el.textContent = Math.round(totals[i]*eased).toLocaleString('en-US'));
      if(progress < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  };
  if (!('IntersectionObserver' in window)) return; // Static totals remain usable without animation support.
  const observer = new IntersectionObserver(entries => {
    if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();run();}
  }, {threshold:0.25});
  observer.observe(group);
})();
