/* Visual offer preview only: a session-persistent demo, never a purchase deadline. */
(() => {
  const duration = 20 * 60 * 1000;
  const key = 'clippfy-demo-offer-end';
  let end = Date.now() + duration;
  try {
    const stored = Number(sessionStorage.getItem(key));
    if (Number.isFinite(stored) && stored > 0) end = Math.min(stored, end);
    sessionStorage.setItem(key, String(end));
  } catch {}
  const glass = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10M7 21h10M8 3v4l8 10v4M16 3v4L8 17v4" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  const set = '<span class="mq-i">Get full-access Clippfy for $1!</span><span class="mq-pill">$1 only</span><span class="mq-i">'+glass+'Demo ends in <b data-demo-time>0:20:00</b></span><span class="mq-pill">Preview · -97% off</span>';
  const half = '<div class="mq-half">' + set.repeat(8) + '</div>';
  const track = '<div class="mq-track">' + half + half.replace('class="mq-half"', 'class="mq-half" aria-hidden="true"') + '</div>';
  document.documentElement.classList.add('has-ann');
  document.body.insertAdjacentHTML('afterbegin', '<a class="ann mq" href="/app#plans" aria-label="Clippfy one dollar trial: demonstration countdown only. Checkout coming soon.">' + track + '</a>');
  const tick = () => {
    const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    const text = Math.floor(left / 3600) + ':' + String(Math.floor(left % 3600 / 60)).padStart(2,'0') + ':' + String(left % 60).padStart(2,'0');
    document.querySelectorAll('[data-demo-time]').forEach(el => { if(el.textContent !== text) el.textContent = text; });
    // The trial card shares the same demo timer; no independent or resetting deadline.
    document.querySelectorAll('[data-t="hms"]').forEach(el => el.textContent = text);
    for (const [part, value] of [['h',Math.floor(left/3600)],['m',Math.floor(left%3600/60)],['s',left%60]]) {
      document.querySelectorAll('[data-t="'+part+'"]').forEach(el => el.textContent = String(value).padStart(2,'0'));
    }
    if (!left) clearInterval(timer);
  };
  const fill = () => {
    document.querySelectorAll('.tr-strip:not(.mq)').forEach(s => {s.classList.add('mq');s.innerHTML=track;});
    document.querySelectorAll('.tr-timer').forEach(el=>el.setAttribute('aria-label','Demonstration timer, not an offer deadline'));
    tick();
  };
  const timer = setInterval(tick, 1000);
  tick();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fill);else fill();
  window.addEventListener('pageshow',tick);
})();
