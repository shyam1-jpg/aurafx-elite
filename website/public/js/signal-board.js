/**
 * AuraFX signal board — renders /api/signals into the existing dashboard.
 * Analysis only. Measured stats come from the server tracker.
 */
(function () {
  const API = window.AURAFX_API_BASE != null ? window.AURAFX_API_BASE : '';
  const DISCLAIMER = 'Aura Elite FX provides AI-assisted market analysis, confidence scoring, backtesting and risk tools. Trading involves risk and no result is guaranteed.';
  const GROUPS = [
    ['forex', 'Forex'],
    ['metal', 'Metals'],
    ['commodity', 'Commodities']
  ];
  let latest = null;
  let filter = 'all';
  let timer = null;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function num(value, digits) {
    if (value == null || !isFinite(Number(value))) return '—';
    return Number(value).toFixed(digits == null ? 2 : digits);
  }

  function price(signal, value) {
    if (value == null || !isFinite(Number(value))) return '—';
    const id = signal.instrument || '';
    let digits = 5;
    if (id === 'USDJPY' || id === 'EURJPY' || id === 'GBPJPY' || id === 'XAGUSD' || id === 'NATGAS') digits = 3;
    else if (id === 'XAUUSD' || id === 'USOIL' || id === 'UKOIL') digits = 2;
    else if (id === 'COPPER') digits = 4;
    return Number(value).toFixed(digits);
  }

  function winText(measured) {
    if (!measured || !measured.resolved) return 'No closed signals yet';
    const pct = Math.round(measured.win_rate * 1000) / 10;
    const small = measured.resolved < 8 ? ' Sample is small and is not a forecast.' : '';
    return pct + '% from ' + measured.resolved + ' closed signals.' + small;
  }

  function factorHtml(factors) {
    return (factors || []).map((f) =>
      '<span class="signal-factor ' + esc(f.state) + '">' + esc(f.label) + '</span>'
    ).join('');
  }

  function cardHtml(signal, compact) {
    const action = signal.action || 'WAIT';
    const cls = action.toLowerCase();
    const conf = signal.confidence == null ? '—' : signal.confidence;
    let levels = '';
    if (!compact && action !== 'WAIT') {
      const zone = signal.entry_zone && signal.entry_zone.length === 2
        ? price(signal, signal.entry_zone[0]) + ' – ' + price(signal, signal.entry_zone[1])
        : '—';
      levels = '<div class="signal-levels">' +
        '<div><span>Entry</span>' + price(signal, signal.entry) + '</div>' +
        '<div><span>Stop</span>' + price(signal, signal.stop_loss) + '</div>' +
        '<div><span>Target 1</span>' + price(signal, signal.take_profit_1) + '</div>' +
        '<div><span>Target 2</span>' + price(signal, signal.take_profit_2) + '</div>' +
        '<div><span>Risk / reward</span>' + (signal.risk_reward == null ? '—' : signal.risk_reward + 'R') + '</div>' +
        '<div><span>Zone</span>' + zone + '</div>' +
        '</div>';
    }
    return '<article class="' + (compact ? 'signal-chip ' : 'signal-card ') + cls + '">' +
      '<div class="' + (compact ? 'signal-chip-top' : 'signal-card-top') + '">' +
      '<div><div class="signal-symbol">' + esc(signal.name || signal.instrument) + ' <span class="muted">' + esc(price(signal, signal.price)) + '</span></div>' +
      '<div class="signal-action">' + esc(action) + '</div></div>' +
      '<div class="signal-confidence">Confidence<strong>' + esc(conf) + '</strong></div></div>' +
      (compact ? '' : '<p class="signal-rationale">' + esc(signal.rationale || '') + '</p>' + levels + factorHtml(signal.factors)) +
      (compact ? '' : '<p class="muted" style="margin-top:.5rem">' + esc(signal.session || '') + (signal.feed_note ? ' · ' + esc(signal.feed_note) : '') + '</p>') +
      '</article>';
  }

  function renderPreview() {
    const host = document.getElementById('signalPreviewBody');
    if (!host || !latest) return;
    const ranked = latest.signals.slice().sort((a, b) => {
      const rank = { BUY: 0, SELL: 1, WAIT: 2 };
      return (rank[a.action] - rank[b.action]) || ((b.confidence || 0) - (a.confidence || 0));
    }).slice(0, 4);
    host.innerHTML = ranked.map((s) => cardHtml(s, true)).join('');
  }

  function renderBoard() {
    const host = document.getElementById('signalBoardBody');
    const meta = document.getElementById('signalBoardMeta');
    const stats = document.getElementById('signalStats');
    const history = document.getElementById('signalHistory');
    const byInst = document.getElementById('signalByInstrument');
    if (!host || !latest) return;
    const summary = latest.summary || {};
    if (meta) {
      meta.textContent = 'Scanned ' + (summary.scanned || 0) +
        ' · Buy ' + (summary.buy || 0) +
        ' · Sell ' + (summary.sell || 0) +
        ' · Wait ' + (summary.wait || 0) +
        ' · ' + (latest.source || 'feed') +
        (latest.updated_at ? ' · ' + new Date(latest.updated_at).toLocaleString() : '');
    }
    const measured = latest.tracker && latest.tracker.measured;
    if (stats) {
      const avg = measured && measured.average_r != null ? measured.average_r.toFixed(2) + 'R' : '—';
      const pf = measured && measured.profit_factor != null
        ? String(measured.profit_factor)
        : (measured && measured.profit_factor_note ? measured.profit_factor_note : '—');
      stats.innerHTML =
        '<div class="kpi-card"><div class="kpi-label">Measured win rate</div><div class="kpi-value" style="font-size:1rem">' + esc(winText(measured)) + '</div><div class="kpi-sub">Closed signals only</div></div>' +
        '<div class="kpi-card"><div class="kpi-label">Average R</div><div class="kpi-value">' + esc(avg) + '</div><div class="kpi-sub">Take-profit and stop only</div></div>' +
        '<div class="kpi-card"><div class="kpi-label">Profit factor</div><div class="kpi-value" style="font-size:1rem">' + esc(pf) + '</div></div>' +
        '<div class="kpi-card"><div class="kpi-label">Open signals</div><div class="kpi-value">' + esc(measured ? measured.open : 0) + '</div></div>';
    }
    const visible = (latest.signals || []).filter((s) => filter === 'all' || s.action === filter);
    let html = '';
    GROUPS.forEach(([asset, label]) => {
      const rows = visible.filter((s) => s.asset === asset);
      if (!rows.length) return;
      html += '<h3 class="signal-group-title">' + label + '</h3>';
      html += rows.map((s) => cardHtml(s, false)).join('');
    });
    host.innerHTML = html || '<p class="muted">No instruments match this filter.</p>';

    if (history) {
      const rows = (latest.tracker && latest.tracker.history) || [];
      history.innerHTML = rows.length ? rows.slice(0, 25).map((row) => {
        const cls = row.status === 'tp' ? 'pos' : (row.status === 'sl' ? 'neg' : '');
        const label = row.status === 'tp' ? 'TP hit' : row.status === 'sl' ? 'SL hit' : row.status === 'expired' ? 'Expired' : 'Open';
        return '<tr><td>' + esc(row.opened_at ? new Date(row.opened_at).toLocaleString() : '') + '</td>' +
          '<td>' + esc(row.name || row.instrument) + '</td>' +
          '<td>' + esc(row.action) + '</td>' +
          '<td>' + esc(row.entry) + '</td><td>' + esc(row.stop_loss) + '</td><td>' + esc(row.take_profit_1) + '</td>' +
          '<td class="' + cls + '">' + esc(label) + '</td>' +
          '<td class="' + cls + '">' + (row.result_r == null ? '—' : esc(row.result_r)) + '</td></tr>';
      }).join('') : '<tr><td colspan="8">No Buy or Sell has been published on this server yet. Wait is recorded on the board and is not a trade.</td></tr>';
    }
    if (byInst && measured) {
      const entries = Object.keys(measured.by_instrument || {});
      byInst.innerHTML = entries.length ? entries.map((key) => {
        const row = measured.by_instrument[key];
        const rate = row.resolved ? (Math.round(row.win_rate * 1000) / 10) + '% (' + row.resolved + ')' : '—';
        return '<tr><td>' + esc(key) + '</td><td>' + esc(rate) + '</td><td>' + esc(row.average_r == null ? '—' : row.average_r) + '</td><td>' + esc(row.open) + '</td><td>' + esc(row.wins) + '</td><td>' + esc(row.losses) + '</td></tr>';
      }).join('') : '<tr><td colspan="6">Per-instrument stats appear after a signal is logged.</td></tr>';
    }
  }

  function render() {
    renderPreview();
    renderBoard();
  }

  async function refresh(force) {
    const meta = document.getElementById('signalBoardMeta');
    try {
      const res = await fetch(API + '/api/signals' + (force ? '?force=1' : ''), { cache: 'no-store' });
      if (!res.ok) throw new Error('Signal feed unavailable');
      latest = await res.json();
      render();
    } catch (error) {
      if (meta && !latest) meta.textContent = 'Signal feed unavailable. The rest of the dashboard is unchanged.';
      const host = document.getElementById('signalPreviewBody');
      if (host && !latest) host.innerHTML = '<p class="muted">Signals will appear when the server can reach the price feed.</p>';
    }
  }

  document.getElementById('btnOpenSignals')?.addEventListener('click', () => {
    document.querySelector('.dash-nav button[data-panel="signals"]')?.click();
  });
  document.getElementById('signalFilter')?.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-signal-filter]');
    if (!btn) return;
    filter = btn.getAttribute('data-signal-filter');
    document.querySelectorAll('#signalFilter button').forEach((b) => b.classList.toggle('active', b === btn));
    renderBoard();
  });
  document.getElementById('btnRefresh')?.addEventListener('click', () => refresh(true));
  document.querySelectorAll('.dash-nav button[data-panel]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.getAttribute('data-panel') === 'signals') refresh(false);
    });
  });

  const note = document.getElementById('signalEngineNote');
  if (note && !note.textContent) note.textContent = DISCLAIMER;
  refresh(false);
  timer = setInterval(() => refresh(false), 60000);
  window.addEventListener('beforeunload', () => clearInterval(timer));
})();
