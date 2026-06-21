const signalEl = document.getElementById("liveSignal");
const winRateEl = document.getElementById("winRate");
const buttons = document.querySelectorAll(".signal-buttons .btn");

const labels = {
  buy: { text: "Signal: BUY", class: "buy" },
  sell: { text: "Signal: SELL", class: "sell" },
  cover: { text: "Signal: COVER", class: "cover" },
};

buttons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const sig = btn.dataset.sig;
    buttons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const cfg = labels[sig];
    signalEl.textContent = cfg.text;
    signalEl.className = "panel-row signal " + cfg.class;
    const base = 74 + Math.random() * 4;
    winRateEl.textContent = base.toFixed(1);
  });
});

// Subtle live tick on win rate
setInterval(() => {
  const v = parseFloat(winRateEl.textContent) || 76;
  const jitter = (Math.random() - 0.5) * 0.3;
  winRateEl.textContent = Math.min(78.5, Math.max(74.5, v + jitter)).toFixed(1);
}, 4000);
