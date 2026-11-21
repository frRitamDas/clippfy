/* Preserve the original $1 trial marquee without a fake countdown or active checkout. */
(() => {
  const set = '<span class="mq-i">Get full-access Clippfy for $1!</span><span class="mq-pill">$1 only</span><span class="mq-i">Offer preview · Coming soon</span><span class="mq-pill">-97% off</span>';
  const half = '<div class="mq-half">' + set.repeat(8) + '</div>';
  const track = '<div class="mq-track">' + half + half.replace('class="mq-half"', 'class="mq-half" aria-hidden="true"') + '</div>';
  document.documentElement.classList.add('has-ann');
  document.body.insertAdjacentHTML('afterbegin', '<a class="ann mq" href="/app#plans" aria-label="Clippfy one dollar trial coming soon. Free workspace available now.">' + track + '</a>');
  const fill = () => document.querySelectorAll('.tr-strip:not(.mq)').forEach(s => {s.classList.add('mq');s.innerHTML=track;});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fill);else fill();
})();
