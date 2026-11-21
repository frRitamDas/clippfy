// Monthly / Yearly switch: prices, billing line and the plan links (Yearly is shown first)
  const setInterval_ = (year) => {
    document.querySelectorAll(".pr-toggle button").forEach((b) => {const selected=(b.dataset.int === "year") === year;b.classList.toggle("on",selected);b.setAttribute("aria-pressed",String(selected));});
    document.querySelectorAll(".pc-price[data-m]").forEach((el) => {
      el.querySelector("b").textContent = new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(year ? +el.dataset.y / 12 : +el.dataset.m);
      const bill = el.nextElementSibling;
      bill.textContent = year ? "Monthly equivalent · $" + el.dataset.y + " charged once a year" : "";
      bill.hidden = !year;
      const link = el.closest(".pc").querySelector(".pc-btn");
      link.href = link.href.replace(/&interval=(year|month)/, "") + "&interval=" + (year ? "year" : "month");
    });
  };
  document.querySelectorAll(".pr-toggle button").forEach((btn) => btn.addEventListener("click", () => setInterval_(btn.dataset.int === "year")));
  setInterval_(false);
