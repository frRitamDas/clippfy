/* Preserve the original $1 trial marquee without a fake countdown or active checkout. */
(() => {
  const set = '<span class="mq-i">Clippfy $1 trial</span><span class="mq-pill">Coming soon</span><span class="mq-i">Free workspace available now · no payment required</span>';
  const half = '<div class="mq-half">' + set.repeat(8) + '</div>';
  const track = '<div class="mq-track">' + half + half.replace('class="mq-half"', 'class="mq-half" aria-hidden="true"') + '</div>';
  document.documentElement.classList.add('has-ann');
  document.body.insertAdjacentHTML('afterbegin', '<a class="ann mq" href="/app#plans" aria-label="Clippfy one dollar trial coming soon. Free workspace available now.">' + track + '</a>');
  const fill = () => document.querySelectorAll('.tr-strip:not(.mq)').forEach(s => {s.classList.add('mq');s.innerHTML=track;});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fill);else fill();
})();
