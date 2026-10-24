/* Supplemental dashboard tools. Market analysis belongs to the signal board. */
(function () {
  function renderRiskCenter() {
    return '<section class="card inst-wide"><h2>Risk management center</h2>' +
      '<div class="inst-calc-grid" id="instRiskCalcs">' +
      '<div><label>Account balance</label><input type="number" id="rcBal" value="10000" /></div>' +
      '<div><label>Risk %</label><input type="number" id="rcRisk" value="1" step="0.1" /></div>' +
      '<div><label>Stop (pips)</label><input type="number" id="rcStop" value="20" /></div>' +
      '<div><label>Pip value ($)</label><input type="number" id="rcPip" value="10" /></div>' +
      '<div class="inst-calc-out" id="rcOut">Position size, margin, pip &amp; lot calculators — enter values above.</div>' +
      '</div><p class="muted">Calculation only. This tool does not monitor your account, enforce loss limits or place orders.</p></section>';
  }

  function renderDashboard(data) {
    // The signal board owns market analysis and measured performance. The
    // legacy institutional feed mixes sample commentary with quote data.
    return '<section class="card inst-wide"><h2>Data and performance</h2>' +
      '<p>Use the signal board and signal tracker above for current analysis and measured results. ' +
      'No personal portfolio performance is available: this dashboard is not connected to your broker.</p>' +
      '<p class="muted">Journal entries stay on this device unless cloud sync is configured and your account is linked. ' +
      'Market quotes are public data; verify prices and contract sizes with your broker.</p></section>' +
      renderRiskCenter();
  }

  function bindCalcs() {
    var bal = document.getElementById('rcBal');
    if (!bal) return;
    function run() {
      var b = Number(bal.value);
      var risk = Number(document.getElementById('rcRisk').value);
      var stop = Number(document.getElementById('rcStop').value);
      var pip = Number(document.getElementById('rcPip').value);
      var out = document.getElementById('rcOut');
      if (![b, risk, stop, pip].every(Number.isFinite) || b <= 0 || risk < 0 || risk > 100 || stop <= 0 || pip <= 0) {
        if (out) out.textContent = 'Enter a positive balance, stop distance and pip value, with risk between 0% and 100%.';
        return;
      }
      var riskAmt = b * (risk / 100);
      var lots = stop > 0 && pip > 0 ? (riskAmt / (stop * pip)).toFixed(2) : '—';
      if (out) out.textContent = 'Risk $' + riskAmt.toFixed(2) + ' · Calculated lots: ' + lots + '. Pip value must be in USD per full lot. Confirm lot increments and margin with your broker.';
      var dd = document.getElementById('rcDD');
      if (dd) dd.textContent = (risk * 3).toFixed(1) + '% daily cap suggested';
      var cg = document.getElementById('rcCompound');
      if (cg) cg.textContent = ((1 + risk / 100) ** 20 * 100 - 100).toFixed(1) + '% (20 trades est.)';
    }
    ['rcBal', 'rcRisk', 'rcStop', 'rcPip'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', run);
    });
    run();
  }

  function init() {
    var dash = document.getElementById("aurafx-inst-dash");
    if (dash) { dash.innerHTML = renderDashboard({}); bindCalcs(); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
