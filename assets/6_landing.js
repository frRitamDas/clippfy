const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];


// ---- profit calculator: views x CPM ----
(() => {
  const views = $("#cViews"), cpm = $("#cCpm");
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const fill = (i) => i.style.setProperty("--p", ((i.value - i.min) / (i.max - i.min)) * 100 + "%");
  function update() {
    fill(views);
    fill(cpm);
    $("#oViews").textContent = fmt(views.value) + (+views.value >= +views.max ? "+" : "");
    $("#oCpm").textContent = "$" + Number(cpm.value).toFixed(2);
    $("#rProfit").textContent = "$" + fmt((views.value / 1000) * cpm.value);
  }
  [views, cpm].forEach((i) => i.addEventListener("input", update));
  update();
})();

// ---- images can't be opened, saved or dragged ----
document.addEventListener("contextmenu", (e) => { if (e.target.closest("img, .pfp, .phone, .float-thumb, .styles-mock, .wide, .wf-vis")) e.preventDefault(); });
document.addEventListener("dragstart", (e) => { if (e.target.tagName === "IMG") e.preventDefault(); });
$$("img").forEach((i) => i.setAttribute("draggable", "false"));

// Review marquee is initialized once by reviews.js.

// ---- live counters: grow from a fixed start so they keep climbing across reloads ----
(() => {
  const start = Date.UTC(2026, 9, 28) / 1000;
  const fmt = (n) => Math.floor(n).toLocaleString("en-US");
  const el1 = $("#statCreators"), el2 = $("#statClips");
  if (!el1) return;
  const elapsed = Date.now() / 1000 - start;
  let creators = 148312 + elapsed * 0.05;
  let clips = 2847519 + elapsed * 1.5;
  const tick = () => {
    creators += Math.random() < 0.6 ? 1 + Math.floor(Math.random() * 2) : 0;
    clips += 3 + Math.floor(Math.random() * 9);
    el1.textContent = fmt(creators);
    el2.textContent = fmt(clips);
  };
  tick();
  setInterval(tick, 1000);
})();

// ---- FAQ ----
$$("#faqList .qa").forEach((qa) => {
  const btn = $("button", qa);
  btn.onclick = () => {
    const open = !qa.classList.contains("open");
    $$("#faqList .qa.open").forEach((o) => { o.classList.remove("open"); $("button", o).setAttribute("aria-expanded", "false"); });
    qa.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", String(open));
  };
});
