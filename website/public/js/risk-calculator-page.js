(function () {
  var form = document.getElementById('riskForm');
  var result = document.getElementById('riskResult');

  function showCalc(data) {
    result.hidden = false;
    document.getElementById('outRisk').textContent = (data.risk_money != null ? data.risk_money + ' ' : '') + '(' + data.risk_pct + '%)';
    document.getElementById('outLots').textContent = String(data.suggested_lots);
    document.getElementById('outPip').textContent = String(data.pip_value_per_lot) + ' / lot (est.)';
    document.getElementById('outDaily').textContent = String(data.max_daily_loss);
    document.getElementById('outWeekly').textContent = String(data.max_weekly_loss);
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var payload = {
        balance: Number(document.getElementById('balance').value),
        risk_pct: Number(document.getElementById('riskPct').value),
        pair: document.getElementById('pair').value,
        stop_loss_pips: Number(document.getElementById('slPips').value),
        account_currency: 'USD'
      };
      fetch('/api/risk/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (r) { return r.json(); })
        .then(showCalc)
        .catch(function () { alert('Calculator unavailable — is the server running?'); });
    });
  }

  fetch('/api/risk/config')
    .then(function (r) { return r.json(); })
    .then(function (cfg) {
      var el = document.getElementById('modeCards');
      if (!el || !cfg.trading_modes) return;
      el.innerHTML = Object.keys(cfg.trading_modes).map(function (k) {
        var m = cfg.trading_modes[k];
        return '<div class="mode-card"><h3>' + m.label + '</h3><p style="color:var(--muted)">' + m.description + '</p></div>';
      }).join('');
    })
    .catch(function () {});
})();
