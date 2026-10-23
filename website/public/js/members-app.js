(function () {
  var state = { section: 'analyst', data: null, sort: { key: 'instrument', dir: 1 }, instrument: 'XAUUSD' };

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function word(action) {
    if (action === 'BUY') return 'Buy';
    if (action === 'SELL') return 'Sell';
    return 'Wait';
  }

  function tag(action) {
    var kind = action === 'BUY' ? 'buy' : action === 'SELL' ? 'sell' : 'wait';
    return '<span class="tag-' + kind + '">' + esc(word(action)) + '</span>';
  }

  function num(value, digits) {
    if (value == null || value === '' || !isFinite(Number(value))) return '—';
    return String(Math.round(Number(value) * Math.pow(10, digits == null ? 2 : digits)) / Math.pow(10, digits == null ? 2 : digits));
  }

  function lockedBox(block) {
    var note = (block && block.note) || 'This tool is locked on the current tier.';
    return '<article class="mem-card mem-lock"><h2>Locked</h2><p>' + esc(note) + '</p><p><a href="pricing.html">See Free, Pro and Elite</a> · <a href="mailto:support@aurafxelite.com">Contact us</a></p></article>';
  }

  function gate(feature) {
    var data = state.data;
    if (!data) return false;
    return !!(data.access && data.access[feature]);
  }

  function view() {
    var root = document.getElementById('memView');
    if (!state.data) {
      root.innerHTML = '<article class="mem-card"><h2>Sign in</h2><p>The members area keeps the public pages as a teaser. <a href="login.html">Log in</a> or <a href="signup.html">create a free account</a>.</p></article>';
      return;
    }
    var name = state.section;
    if (name === 'analyst') root.innerHTML = analyst();
    else if (name === 'charts') root.innerHTML = charts();
    else if (name === 'scanner') root.innerHTML = scanner();
    else if (name === 'strength') root.innerHTML = strength();
    else if (name === 'calendar') root.innerHTML = calendar();
    else if (name === 'brief') root.innerHTML = brief();
    else if (name === 'history') root.innerHTML = history();
    else if (name === 'risk') root.innerHTML = risk();
    else if (name === 'watchlist') root.innerHTML = watchlist();
    else root.innerHTML = sessions();
    bind();
  }

  function analyst() {
    if (!gate('analyst')) return lockedBox(state.data.brief);
    var picks = ['Explain gold', 'EURUSD daily bias', 'What is the gold half-hour trend?', 'Which markets are volatile?'];
    return '<article class="mem-card"><h2>AI analyst</h2><p>Answers use the current engine board. H1 is scored with H4 and daily agreement. A half-hour question does not invent an M30 model.</p>' +
      '<div class="mem-pills">' + picks.map(function (q) { return '<button type="button" data-ask="' + esc(q) + '">' + esc(q) + '</button>'; }).join('') + '</div>' +
      '<form class="mem-chat" id="askForm"><textarea name="question" rows="3" maxlength="500" placeholder="Ask about one instrument on this scan"></textarea><button class="btn btn-gold" type="submit">Ask</button></form>' +
      '<p id="askOut" class="mem-note"></p></article>';
  }

  function charts() {
    if (!gate('charts')) return lockedBox(state.data.scanner);
    var options = ((state.data.live && state.data.live.signals) || []).map(function (signal) {
      return '<option value="' + esc(signal.instrument) + '"' + (signal.instrument === state.instrument ? ' selected' : '') + '>' + esc(signal.name || signal.instrument) + '</option>';
    }).join('');
    return '<article class="mem-card"><h2>Chart</h2><p>Hourly candles from the price feed. Entry, stop and targets appear only on a published Buy or Sell. Support and resistance are the engine swing levels when the scan measured them.</p>' +
      '<label>Instrument <select id="chartInstrument">' + options + '</select></label><div id="memChart"></div><p id="chartNote" class="mem-note"></p></article>';
  }

  function scanner() {
    if (!gate('scanner')) return lockedBox(state.data.scanner);
    var rows = (state.data.scanner.rows || []).slice();
    var key = state.sort.key;
    rows.sort(function (a, b) {
      var av = a[key];
      var bv = b[key];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * state.sort.dir;
      return String(av).localeCompare(String(bv)) * state.sort.dir;
    });
    var heads = [
      ['instrument', 'Market'], ['trend', 'Trend'], ['regime', 'Regime'], ['rsi', 'RSI'],
      ['atr', 'ATR'], ['atr_ratio', 'ATR ratio'], ['change_pct', '24h %']
    ];
    return '<article class="mem-card"><h2>Scanner</h2><p>' + esc(state.data.scanner.basis) + '</p>' +
      '<div class="mem-heat">' + rows.map(function (row) {
        var cls = row.trend === 'bullish' ? 'up' : row.trend === 'bearish' ? 'down' : '';
        return '<article class="' + cls + '"><strong>' + esc(row.instrument) + '</strong><p>' + esc(row.regime || '—') + ' · ' + tag(row.action) + '</p><p>RSI ' + num(row.rsi, 1) + ' · ATR ' + num(row.atr_ratio, 2) + '×</p></article>';
      }).join('') + '</div>' +
      '<div class="mem-table-wrap"><table class="mem-table"><thead><tr>' + heads.map(function (head) {
        return '<th data-sort="' + head[0] + '">' + esc(head[1]) + '</th>';
      }).join('') + '</tr></thead><tbody>' + rows.map(function (row) {
        return '<tr><td>' + esc(row.instrument) + '</td><td>' + esc(row.trend || '—') + '</td><td>' + esc(row.regime || '—') + '</td><td>' + num(row.rsi, 1) + '</td><td>' + num(row.atr, 4) + '</td><td>' + num(row.atr_ratio, 2) + '</td><td>' + num(row.change_pct, 2) + '</td></tr>';
      }).join('') + '</tbody></table></div></article>';
  }

  function strength() {
    if (!gate('strength')) return lockedBox(state.data.strength);
    var meter = state.data.strength || { currencies: [] };
    var matrix = state.data.correlation || { instruments: [], matrix: {} };
    var max = 1;
    (meter.currencies || []).forEach(function (row) { max = Math.max(max, Math.abs(row.change_pct)); });
    var bars = (meter.currencies || []).map(function (row) {
      var width = Math.max(4, Math.round(Math.abs(row.change_pct) / max * 50));
      var left = row.change_pct >= 0 ? 50 : 50 - width;
      return '<div class="mem-bar"><span>' + esc(row.currency) + '</span><div class="mem-track"><div class="mem-fill" style="left:' + left + '%;width:' + width + '%"></div></div><span>' + num(row.change_pct, 2) + '%</span></div>';
    }).join('');
    var head = '<th></th>' + (matrix.instruments || []).map(function (id) { return '<th>' + esc(id) + '</th>'; }).join('');
    var body = (matrix.instruments || []).map(function (left) {
      var cells = (matrix.instruments || []).map(function (right) {
        var value = matrix.matrix && matrix.matrix[left] ? matrix.matrix[left][right] : null;
        return '<td>' + (value == null ? '—' : num(value, 2)) + '</td>';
      }).join('');
      return '<tr><th>' + esc(left) + '</th>' + cells + '</tr>';
    }).join('');
    return '<article class="mem-card"><h2>Currency strength</h2><p>' + esc(meter.basis) + '</p>' + (bars || '<p>No pair had enough bars for a strength reading.</p>') + '</article>' +
      '<article class="mem-card"><h2>Correlation</h2><p>' + esc(matrix.basis || '') + '</p><div class="mem-table-wrap"><table class="mem-table"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div></article>';
  }

  function calendar() {
    var items = state.data.calendar || [];
    var windowMin = state.data.news_window || { before: 30, after: 30 };
    var rows = items.slice(0, 18).map(function (event) {
      return '<tr><td>' + esc(event.time || event.t || '') + '</td><td>' + esc(event.currency || '') + '</td><td>' + esc(event.title || '') + '</td><td>' + esc(event.impact || event.risk || '') + '</td><td>' + (event.pauses_new_signals ? 'Pause' : 'Open') + '</td></tr>';
    }).join('');
    return '<article class="mem-card"><h2>Economic calendar</h2><p>High-impact releases pause new signals for ' + esc(windowMin.before) + ' minutes before and ' + esc(windowMin.after) + ' minutes after. Other impact levels stay on the list and do not open that pause.</p>' +
      '<div class="mem-table-wrap"><table class="mem-table"><thead><tr><th>Time</th><th>Currency</th><th>Event</th><th>Impact</th><th>Signals</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="5">No calendar rows are loaded.</td></tr>') + '</tbody></table></div></article>';
  }

  function brief() {
    if (!gate('brief')) return lockedBox(state.data.brief);
    var cards = (state.data.brief.items || []).map(function (item) {
      var levels = item.levels
        ? '<p>Entry ' + esc(item.levels.entry) + ' · Stop ' + esc(item.levels.stop_loss) + ' · TP1 ' + esc(item.levels.take_profit_1) + '</p>'
        : '<p>No published entry, stop or target on this scan.</p>';
      return '<article class="mem-card"><h2>' + esc(item.name) + ' · ' + tag(item.bias === 'Buy' ? 'BUY' : item.bias === 'Sell' ? 'SELL' : 'WAIT') + '</h2>' +
        '<p>' + esc(item.regime || 'Regime pending') + (item.session ? ' · ' + esc(item.session) : '') + '</p>' +
        '<p>' + esc(item.confidence_text) + '</p>' + levels +
        '<p>Support ' + num(item.key_levels && item.key_levels.support, 4) + ' · Resistance ' + num(item.key_levels && item.key_levels.resistance, 4) + '</p>' +
        '<p class="mem-note">' + esc(item.timeframe_note) + '</p></article>';
    }).join('');
    return '<article class="mem-card"><h2>Daily brief</h2><p>Bias follows the published action. Setup quality is not shown as a probability unless the engine has calibrated it from at least 8 closed signals, and that rate is labelled as measured.</p></article>' + cards;
  }

  function history() {
    if (!gate('history')) return lockedBox(state.data.history);
    var record = state.data.history || {};
    var measured = record.measured || {};
    var points = record.equity || [];
    var svg = equitySvg(points);
    var bySession = measured.by_session || {};
    var sessionRows = Object.keys(bySession).map(function (key) {
      var row = bySession[key];
      return '<tr><td>' + esc(key) + '</td><td>' + esc(row.resolved) + '</td><td>' + (row.win_rate == null ? '—' : num(row.win_rate * 100, 1) + '%') + '</td><td>' + num(row.average_r, 2) + '</td></tr>';
    }).join('');
    var signals = (record.signals || []).slice(0, 25).map(function (row) {
      return '<tr><td>' + esc(row.instrument) + '</td><td>' + tag(row.action) + '</td><td>' + esc(row.session || 'unknown') + '</td><td>' + esc(row.status) + '</td><td>' + num(row.result_r, 2) + '</td><td>' + esc(row.opened_at || '') + '</td></tr>';
    }).join('');
    return '<article class="mem-card"><h2>Signal history</h2><p>' + esc(record.basis || '') + '</p>' +
      '<div class="mem-grid"><article class="mem-card"><p>Resolved</p><strong>' + esc(measured.resolved || 0) + '</strong></article>' +
      '<article class="mem-card"><p>Win rate</p><strong>' + (measured.win_rate == null ? '—' : num(measured.win_rate * 100, 1) + '%') + '</strong></article>' +
      '<article class="mem-card"><p>Profit factor</p><strong>' + num(measured.profit_factor, 2) + '</strong></article>' +
      '<article class="mem-card"><p>Average R</p><strong>' + num(measured.average_r, 2) + '</strong></article></div>' +
      (measured.sample_note ? '<p>' + esc(measured.sample_note) + '</p>' : '') + svg +
      '<h2>By session</h2><p>Rows opened before session was stored are counted as unknown.</p><div class="mem-table-wrap"><table class="mem-table"><thead><tr><th>Session</th><th>Resolved</th><th>Win rate</th><th>Avg R</th></tr></thead><tbody>' + (sessionRows || '<tr><td colspan="4">No closed sample yet.</td></tr>') + '</tbody></table></div>' +
      '<div class="mem-table-wrap"><table class="mem-table"><thead><tr><th>Market</th><th>Action</th><th>Session</th><th>Status</th><th>R</th><th>Opened</th></tr></thead><tbody>' + (signals || '<tr><td colspan="6">No published signals in the log yet.</td></tr>') + '</tbody></table></div></article>';
  }

  function equitySvg(points) {
    if (!points || points.length < 2) return '';
    var values = points.map(function (point) { return Number(point.equity_r) || 0; });
    var min = Math.min.apply(null, values);
    var max = Math.max.apply(null, values);
    var span = max - min || 1;
    var w = 640;
    var h = 160;
    var d = values.map(function (value, index) {
      var x = (index / (values.length - 1)) * w;
      var y = h - ((value - min) / span) * (h - 12) - 6;
      return (index ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }).join(' ');
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="160" role="img" aria-label="Equity curve in R"><path d="' + d + '" fill="none" stroke="#d4af37" stroke-width="2"></path></svg>';
  }

  function risk() {
    if (!gate('position')) return lockedBox(state.data.position);
    var journal = state.data.journal || [];
    var rows = journal.map(function (entry) {
      return '<tr><td>' + esc(entry.instrument) + '</td><td>' + tag(entry.side) + '</td><td>' + num(entry.entry, 4) + '</td><td>' + num(entry.stop, 4) + '</td><td>' + num(entry.target, 4) + '</td><td>' + esc(entry.note) + '</td></tr>';
    }).join('');
    return '<article class="mem-card"><h2>Position size</h2><p>Uses the same contract sizes as the dashboard calculator. It does not place an order. Risk stays at or below 5%.</p>' +
      '<form class="mem-form" id="sizeForm"><label>Instrument <input name="instrument" value="EURUSD" /></label><label>Balance <input name="balance" type="number" value="10000" /></label><label>Risk % <input name="risk_pct" type="number" value="1" step="0.1" /></label><label>Entry <input name="entry" type="number" step="any" /></label><label>Stop <input name="stop" type="number" step="any" /></label><button class="btn btn-gold" type="submit">Calculate</button></form><p id="sizeOut"></p></article>' +
      '<article class="mem-card"><h2>Risk / reward planner</h2><form class="mem-form" id="rrForm"><label>Entry <input name="entry" type="number" step="any" /></label><label>Stop <input name="stop" type="number" step="any" /></label><label>Target <input name="target" type="number" step="any" /></label><button class="btn btn-gold" type="submit">Measure R</button></form><p id="rrOut"></p></article>' +
      '<article class="mem-card"><h2>Trade journal</h2><form class="mem-form" id="journalForm"><label>Instrument <input name="instrument" required /></label><label>Side <select name="side"><option>BUY</option><option>SELL</option></select></label><label>Entry <input name="entry" type="number" step="any" /></label><label>Stop <input name="stop" type="number" step="any" /></label><label>Target <input name="target" type="number" step="any" /></label><label>Note <input name="note" maxlength="500" /></label><button class="btn btn-gold" type="submit">Save note</button></form>' +
      '<div class="mem-table-wrap"><table class="mem-table"><thead><tr><th>Market</th><th>Side</th><th>Entry</th><th>Stop</th><th>Target</th><th>Note</th></tr></thead><tbody>' + (rows || '<tr><td colspan="6">No journal rows yet.</td></tr>') + '</tbody></table></div></article>';
  }

  function watchlist() {
    var selected = {};
    (state.data.watchlist || []).forEach(function (id) { selected[id] = true; });
    var source = (state.data.live && state.data.live.signals) || (state.data.delayed && state.data.delayed.signals) || state.data.teaser || [];
    var boxes = source.map(function (signal) {
      return '<label><input type="checkbox" name="instrument" value="' + esc(signal.instrument) + '"' + (selected[signal.instrument] ? ' checked' : '') + ' /> ' + esc(signal.name || signal.instrument) + '</label>';
    }).join(' ');
    var alerts = '';
    if (!gate('alerts')) alerts = lockedBox(state.data.alerts);
    else {
      var channel = state.data.channels || {};
      var saved = ((state.data.alerts && state.data.alerts.items) || []).map(function (alert) {
        return '<li>' + esc(alert.instrument) + ' ' + esc(alert.type) + ' · ' + esc(alert.reason || '') + ' · ' + esc(alert.delivery) + '</li>';
      }).join('');
      alerts = '<article class="mem-card"><h2>Custom alerts</h2><p>' + esc(channel.note || '') + ' Email ' + (channel.email ? 'configured' : 'not configured') + '. Telegram ' + (channel.telegram ? 'configured' : 'not configured') + '.</p>' +
        '<form class="mem-form" id="alertForm"><label>Instrument <input name="instrument" value="XAUUSD" required /></label><label>Type <select name="type"><option value="price">Price</option><option value="signal">Published signal</option><option value="regime">Regime</option></select></label><label>Direction <select name="op"><option value="above">Above</option><option value="below">Below</option></select></label><label>Price <input name="price" type="number" step="any" /></label><label>Regime <select name="regime"><option value="trending">Trending</option><option value="ranging">Ranging</option><option value="volatile">Volatile</option></select></label><label>Channel <select name="channel"><option value="email">Email</option><option value="telegram">Telegram</option><option value="both">Both</option></select></label><button class="btn btn-gold" type="submit">Save alert</button></form><ul>' + saved + '</ul></article>';
    }
    var cards = source.filter(function (signal) { return selected[signal.instrument]; }).map(function (signal) {
      var levels = signal.entry != null ? '<p>Entry ' + esc(signal.entry) + ' · Stop ' + esc(signal.stop_loss) + '</p>' : '';
      return '<article class="mem-card"><strong>' + esc(signal.name || signal.instrument) + '</strong> ' + tag(signal.action) + '<p>' + esc(signal.regime || '') + '</p>' + levels + '</article>';
    }).join('');
    return '<article class="mem-card"><h2>Watchlist</h2><p>Save up to 15 instruments. Free shows the delayed scan. Pro and Elite show the live scan.</p><form id="watchForm" class="mem-form">' + boxes + '<button class="btn btn-gold" type="submit">Save watchlist</button></form></article>' + cards + alerts;
  }

  function sessions() {
    var clock = state.data.sessions || { windows: [] };
    var rows = (clock.windows || []).map(function (window) {
      return '<tr><td>' + esc(window.name) + '</td><td>' + esc(window.open_utc) + '–' + esc(window.close_utc) + '</td><td>' + (window.active ? 'Open' : 'Closed') + '</td></tr>';
    }).join('');
    var vol = state.data.volatility;
    var volHtml = !vol || vol.locked ? lockedBox(vol) : '<article class="mem-card"><h2>Volatility</h2><p>' + esc(vol.basis) + '</p><div class="mem-table-wrap"><table class="mem-table"><thead><tr><th>Market</th><th>ATR</th><th>Ratio</th><th>State</th></tr></thead><tbody>' +
      (vol.rows || []).map(function (row) {
        return '<tr><td>' + esc(row.instrument) + '</td><td>' + num(row.atr, 4) + '</td><td>' + num(row.atr_ratio, 2) + '</td><td>' + esc(row.state) + '</td></tr>';
      }).join('') + '</tbody></table></div></article>';
    return '<article class="mem-card"><h2>Sessions</h2><p>' + esc(clock.utc || '') + ' · ' + esc(clock.label || '') + '. Activity ' + esc(clock.activity || '') + '. ' + esc(clock.note || '') + '</p>' +
      '<div class="mem-table-wrap"><table class="mem-table"><thead><tr><th>Desk</th><th>UTC</th><th>Now</th></tr></thead><tbody>' + rows + '</tbody></table></div></article>' + volHtml;
  }

  function bind() {
    var ask = document.getElementById('askForm');
    if (ask) ask.addEventListener('submit', submitAsk);
    document.querySelectorAll('[data-ask]').forEach(function (button) {
      button.addEventListener('click', function () {
        var input = document.querySelector('#askForm textarea');
        if (input) input.value = button.getAttribute('data-ask');
        submitAsk({ preventDefault: function () {}, target: document.getElementById('askForm') });
      });
    });
    document.querySelectorAll('[data-sort]').forEach(function (th) {
      th.addEventListener('click', function () {
        var key = th.getAttribute('data-sort');
        state.sort.dir = state.sort.key === key ? -state.sort.dir : 1;
        state.sort.key = key;
        view();
      });
    });
    var chartSelect = document.getElementById('chartInstrument');
    if (chartSelect) {
      chartSelect.addEventListener('change', function () {
        state.instrument = chartSelect.value;
        drawChart();
      });
      drawChart();
    }
    var size = document.getElementById('sizeForm');
    if (size) size.addEventListener('submit', function (event) {
      event.preventDefault();
      var data = new FormData(size);
      var rates = {};
      (((state.data.live && state.data.live.signals) || [])).forEach(function (signal) {
        if (signal.price != null) rates[signal.instrument] = signal.price;
      });
      var result = window.AuraPositionSize.calculate({
        instrument: data.get('instrument'),
        balance: data.get('balance'),
        risk_pct: data.get('risk_pct'),
        entry: data.get('entry'),
        stop: data.get('stop'),
        account_currency: 'USD',
        rates: rates
      });
      document.getElementById('sizeOut').textContent = result.ok ? (result.lots + ' lots. ' + result.note) : result.error;
    });
    var rr = document.getElementById('rrForm');
    if (rr) rr.addEventListener('submit', function (event) {
      event.preventDefault();
      var data = new FormData(rr);
      var entry = Number(data.get('entry'));
      var stop = Number(data.get('stop'));
      var target = Number(data.get('target'));
      var risk = Math.abs(entry - stop);
      var reward = Math.abs(target - entry);
      var out = document.getElementById('rrOut');
      if (!(risk > 0) || !(reward >= 0)) { out.textContent = 'Enter an entry, a stop and a target.'; return; }
      out.textContent = 'Reward is ' + (Math.round((reward / risk) * 100) / 100) + 'R against that stop. This does not publish a signal.';
    });
    var journal = document.getElementById('journalForm');
    if (journal) journal.addEventListener('submit', function (event) {
      event.preventDefault();
      var data = new FormData(journal);
      var entries = (state.data.journal || []).slice();
      entries.push({
        instrument: data.get('instrument'),
        side: data.get('side'),
        entry: data.get('entry'),
        stop: data.get('stop'),
        target: data.get('target'),
        note: data.get('note')
      });
      fetch('/api/members/journal', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: entries })
      }).then(function (res) { return res.json(); }).then(function () { return load(); });
    });
    var watch = document.getElementById('watchForm');
    if (watch) watch.addEventListener('submit', function (event) {
      event.preventDefault();
      var chosen = [];
      watch.querySelectorAll('input:checked').forEach(function (box) { chosen.push(box.value); });
      fetch('/api/members/watchlist', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruments: chosen })
      }).then(function () { return load(); });
    });
    var alertForm = document.getElementById('alertForm');
    if (alertForm) alertForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var data = new FormData(alertForm);
      var alerts = ((state.data.alerts && state.data.alerts.items) || []).map(function (item) {
        return { type: item.type, instrument: item.instrument, op: item.op, price: item.price, regime: item.regime, channel: item.channel, id: item.id };
      });
      alerts.push({
        type: data.get('type'),
        instrument: data.get('instrument'),
        op: data.get('op'),
        price: data.get('price'),
        regime: data.get('regime'),
        channel: data.get('channel')
      });
      fetch('/api/members/alerts', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alerts: alerts })
      }).then(function () { return load(); });
    });
  }

  function submitAsk(event) {
    event.preventDefault();
    var form = document.getElementById('askForm');
    var out = document.getElementById('askOut');
    var question = new FormData(form).get('question');
    out.textContent = 'Reading the board…';
    fetch('/api/members/ask', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: question })
    }).then(function (res) { return res.json(); }).then(function (body) {
      out.textContent = body.answer || body.error || 'No answer.';
    }).catch(function () { out.textContent = 'The analyst could not be reached.'; });
  }

  function drawChart() {
    var box = document.getElementById('memChart');
    var note = document.getElementById('chartNote');
    if (!box) return;
    box.innerHTML = '';
    fetch('/api/members/candles?instrument=' + encodeURIComponent(state.instrument), { credentials: 'same-origin', cache: 'no-store' })
      .then(function (res) { return res.json().then(function (body) { return { status: res.status, body: body }; }); })
      .then(function (result) {
        if (result.status === 403) { box.innerHTML = lockedBox(result.body); return; }
        var bars = result.body.bars || [];
        if (!bars.length || !window.LightweightCharts) {
          note.textContent = result.body.note || 'No candles to draw.';
          return;
        }
        var chart = window.LightweightCharts.createChart(box, {
          width: box.clientWidth || 640,
          height: 360,
          layout: { background: { color: '#12182a' }, textColor: '#e8eaf2' },
          grid: { vertLines: { color: 'rgba(212,175,55,0.08)' }, horzLines: { color: 'rgba(212,175,55,0.08)' } },
          timeScale: { timeVisible: true }
        });
        var series = chart.addCandlestickSeries({
          upColor: '#2ecc71', downColor: '#e74c3c', borderVisible: false, wickUpColor: '#2ecc71', wickDownColor: '#e74c3c'
        });
        series.setData(bars);
        (result.body.overlays || []).forEach(function (line) {
          series.createPriceLine({ price: line.price, color: line.color, lineWidth: 1, title: line.title, lineStyle: 2 });
        });
        note.textContent = result.body.note || '';
      }).catch(function () { note.textContent = 'The candle request failed. No sample candles are drawn.'; });
  }

  function load() {
    return fetch('/api/members/workspace', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (res) { return res.json().then(function (body) { return { ok: res.ok, body: body }; }); })
      .then(function (result) {
        if (!result.ok) { state.data = null; paintWho(null); view(); return; }
        state.data = result.body;
        paintWho(result.body.member);
        if (!state.instrument && result.body.live && result.body.live.signals && result.body.live.signals[0]) {
          state.instrument = result.body.live.signals[0].instrument;
        }
        view();
      }).catch(function () { state.data = null; view(); });
  }

  function paintWho(member) {
    var who = document.getElementById('memWho');
    var tier = document.getElementById('memTier');
    var out = document.getElementById('memOut');
    if (!member) {
      who.innerHTML = '<a href="login.html">Log in</a> or <a href="signup.html">sign up</a>. New accounts are Free.';
      tier.textContent = 'Guest';
      out.hidden = true;
      return;
    }
    who.textContent = member.name + ' · ' + member.email;
    tier.textContent = String(member.tier || 'free').toUpperCase();
    out.hidden = false;
  }

  document.querySelectorAll('#memSide button').forEach(function (button) {
    button.addEventListener('click', function () {
      state.section = button.getAttribute('data-section');
      document.querySelectorAll('#memSide button').forEach(function (item) { item.classList.toggle('active', item === button); });
      document.getElementById('memSide').classList.remove('open');
      view();
    });
  });
  document.getElementById('memMenu').addEventListener('click', function () {
    document.getElementById('memSide').classList.toggle('open');
  });
  document.getElementById('memOut').addEventListener('click', function () {
    fetch('/api/members/logout', { method: 'POST', credentials: 'same-origin' }).then(function () { location.href = 'login.html'; });
  });
  load();
})();
