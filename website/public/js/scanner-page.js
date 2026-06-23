(function () {
  var tfSelect = document.getElementById('tfSelect');
  var btnRefresh = document.getElementById('btnRefresh');
  var scanBody = document.getElementById('scanBody');
  var scanSummary = document.getElementById('scanSummary');
  var scanUpdated = document.getElementById('scanUpdated');

  function actionClass(a) {
    if (a === 'BUY') return 'act-buy';
    if (a === 'SELL') return 'act-sell';
    if (a === 'NO_TRADE') return 'act-none';
    return 'act-wait';
  }

  function fmtZone(z) {
    if (!z || !z.length) return '—';
    return z[0] + ' – ' + z[1];
  }

  function render(data) {
    var s = data.summary || {};
    scanSummary.innerHTML =
      '<span class="scan-pill buy">Buy: ' + (s.buy || 0) + '</span>' +
      '<span class="scan-pill sell">Sell: ' + (s.sell || 0) + '</span>' +
      '<span class="scan-pill wait">Wait: ' + (s.wait || 0) + '</span>' +
      '<span class="scan-pill none">No trade: ' + (s.no_trade || 0) + '</span>';
    scanUpdated.textContent = 'Updated ' + (data.updated_at || '') + ' · ' + data.pairs_scanned + ' pairs · ' + data.timeframe;

    if (!data.signals || !data.signals.length) {
      scanBody.innerHTML = '<tr><td colspan="10">No data</td></tr>';
      return;
    }

    scanBody.innerHTML = data.signals.map(function (row) {
      var conf = row.confidence_score || 0;
      return '<tr>' +
        '<td><strong>' + row.pair + '</strong><br><span style="font-size:.72rem;color:var(--muted)">' + row.timeframe + '</span></td>' +
        '<td>' + (row.trend || '—') + '</td>' +
        '<td class="' + actionClass(row.final_action) + '">' + row.final_action + '</td>' +
        '<td>' + conf + '%<span class="conf-bar"><span class="conf-fill" style="width:' + conf + '%"></span></span></td>' +
        '<td>' + (row.volatility || '—') + '</td>' +
        '<td style="font-size:.78rem">' + fmtZone(row.entry_zone) + '</td>' +
        '<td style="font-size:.78rem">' + (row.stop_loss || '—') + '</td>' +
        '<td style="font-size:.78rem">' + (row.take_profit_1 || '—') + '</td>' +
        '<td>' + (row.risk_reward ? '1:' + row.risk_reward : '—') + '</td>' +
        '<td style="font-size:.75rem;color:var(--muted)">' + (row.news_warning ? '⚠' : '—') + '</td>' +
        '</tr>';
    }).join('');
  }

  function load() {
    scanBody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--muted)">Scanning…</td></tr>';
    var tf = tfSelect ? tfSelect.value : 'H1';
    fetch('/api/scanner?timeframe=' + encodeURIComponent(tf))
      .then(function (r) { return r.json(); })
      .then(render)
      .catch(function () {
        scanBody.innerHTML = '<tr><td colspan="10" style="color:#e74c3c">Scanner unavailable — start the server or check connection.</td></tr>';
      });
  }

  if (btnRefresh) btnRefresh.addEventListener('click', load);
  if (tfSelect) tfSelect.addEventListener('change', load);
  load();
  setInterval(load, 60000);
})();
