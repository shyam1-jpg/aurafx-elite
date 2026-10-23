(function () {
  const DISCLAIMER = 'Aura Elite FX provides AI-assisted market analysis, confidence scoring, backtesting and risk tools. Trading involves risk and no result is guaranteed.';

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function when(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
  }

  function outcome(status) {
    if (status === 'tp') return 'TP hit';
    if (status === 'sl') return 'SL hit';
    if (status === 'expired') return 'Expired';
    if (status === 'open') return 'Open';
    return status || '—';
  }

  function winText(measured) {
    if (!measured || !measured.resolved) return 'No closed signals';
    const pct = Math.round(measured.win_rate * 1000) / 10;
    const small = measured.sample_note ? ' ' + measured.sample_note : '';
    return pct + '% · ' + measured.resolved + ' closed' + small;
  }

  function drawChart(points) {
    const svg = document.getElementById('trackChart');
    if (!svg) return;
    const width = 960;
    const height = 220;
    const pad = 16;
    const series = points && points.length ? points : [{ equity_r: 0 }];
    const values = series.map((point) => Number(point.equity_r) || 0);
    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values);
    const span = max - min || 1;
    const step = series.length > 1 ? (width - pad * 2) / (series.length - 1) : 0;
    const coords = series.map((point, index) => {
      const x = pad + index * step;
      const y = pad + (max - (Number(point.equity_r) || 0)) / span * (height - pad * 2);
      return x + ',' + y;
    }).join(' ');
    const zeroY = pad + (max - 0) / span * (height - pad * 2);
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    svg.innerHTML = '<line x1="' + pad + '" y1="' + zeroY + '" x2="' + (width - pad) + '" y2="' + zeroY + '" stroke="rgba(139,144,165,.45)" />' +
      '<polyline fill="none" stroke="#d4af37" stroke-width="2" points="' + coords + '" />';
  }

  function render(record) {
    const measured = record.measured || {};
    const kpis = document.getElementById('trackKpis');
    const pf = measured.profit_factor != null
      ? String(measured.profit_factor)
      : (measured.profit_factor_note || '—');
    if (kpis) {
      kpis.innerHTML = [
        ['Win rate', winText(measured)],
        ['Average R', measured.average_r == null ? '—' : measured.average_r + 'R'],
        ['Profit factor', pf],
        ['Max drawdown', measured.max_drawdown_r == null ? '—' : measured.max_drawdown_r + 'R']
      ].map((pair) => '<div class="track-kpi"><span>' + esc(pair[0]) + '</span><strong>' + esc(pair[1]) + '</strong></div>').join('');
    }
    const basis = document.getElementById('trackBasis');
    if (basis) basis.textContent = record.basis || '';
    const disclaimer = document.getElementById('trackDisclaimer');
    if (disclaimer) disclaimer.textContent = record.disclaimer || DISCLAIMER;
    drawChart(record.equity || []);

    const instrument = document.getElementById('trackInstrument');
    const month = document.getElementById('trackMonth');
    if (instrument && instrument.options.length <= 1) {
      (record.instruments || []).forEach((id) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = id;
        instrument.appendChild(option);
      });
      if (record.instrument && record.instrument !== 'ALL') instrument.value = record.instrument;
    }
    if (month && month.options.length <= 1) {
      (record.months || []).forEach((value) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        month.appendChild(option);
      });
      if (record.month) month.value = record.month;
    }

    const rows = document.getElementById('trackRows');
    const list = record.signals || [];
    if (!rows) return;
    rows.innerHTML = list.length ? list.map((row) => {
      const cls = row.status === 'tp' ? 'pos' : (row.status === 'sl' ? 'neg' : '');
      return '<tr><td>' + esc(when(row.opened_at)) + '</td><td>' + esc(when(row.closed_at)) + '</td>' +
        '<td>' + esc(row.name || row.instrument) + '</td><td>' + esc(row.action) + '</td>' +
        '<td>' + esc(row.entry) + '</td><td>' + esc(row.stop_loss) + '</td><td>' + esc(row.take_profit_1) + '</td>' +
        '<td class="' + cls + '">' + esc(outcome(row.status)) + '</td>' +
        '<td class="' + cls + '">' + (row.result_r == null ? '—' : esc(row.result_r)) + '</td></tr>';
    }).join('') : '<tr><td colspan="9">No published signals for this filter. Wait is not logged as a trade.</td></tr>';
  }

  async function load() {
    const instrument = document.getElementById('trackInstrument');
    const month = document.getElementById('trackMonth');
    const params = new URLSearchParams();
    if (instrument && instrument.value) params.set('instrument', instrument.value);
    if (month && month.value) params.set('month', month.value);
    const response = await fetch('/api/signals/track-record' + (params.toString() ? '?' + params.toString() : ''), { cache: 'no-store' });
    if (!response.ok) throw new Error('Track record unavailable');
    render(await response.json());
  }

  async function alertStatus() {
    const host = document.getElementById('alertStatus');
    try {
      const response = await fetch('/api/signals/alerts', { cache: 'no-store' });
      const status = await response.json();
      if (!host) return;
      const email = status.email ? 'Email is configured.' : 'Email needs SMTP_HOST and SMTP_FROM on the server.';
      const telegram = status.telegram ? 'Telegram is configured.' : 'Telegram needs TELEGRAM_BOT_TOKEN on the server.';
      host.textContent = email + ' ' + telegram + ' Message the bot and use the numeric chat id. Alerts cover a published signal and a later TP or SL.';
    } catch (error) {
      if (host) host.textContent = 'Alert status is unavailable.';
    }
  }

  document.getElementById('trackFilters')?.addEventListener('change', () => {
    load().catch(() => {
      const rows = document.getElementById('trackRows');
      if (rows) rows.innerHTML = '<tr><td colspan="9">Track record is unavailable.</td></tr>';
    });
  });

  document.getElementById('alertForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const result = document.getElementById('alertResult');
    const body = {
      email: form.email.value,
      telegram_chat_id: form.telegram_chat_id.value,
      consent: form.consent.checked
    };
    try {
      const response = await fetch('/api/signals/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Signup failed');
      if (result) result.textContent = 'Opt-in saved. Unsubscribe any time from the link in an alert email.';
    } catch (error) {
      if (result) result.textContent = error.message;
    }
  });

  const unsubscribe = new URLSearchParams(window.location.search).get('unsubscribe');
  if (unsubscribe) {
    fetch('/api/signals/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unsubscribe: unsubscribe })
    }).then(async (response) => {
      const payload = await response.json();
      const result = document.getElementById('alertResult');
      if (result) result.textContent = response.ok ? 'Alerts are turned off for that opt-in.' : (payload.error || 'Unsubscribe failed');
    }).catch(() => {});
  }

  load().catch(() => {
    const rows = document.getElementById('trackRows');
    if (rows) rows.innerHTML = '<tr><td colspan="9">Track record is unavailable.</td></tr>';
  });
  alertStatus();
})();
