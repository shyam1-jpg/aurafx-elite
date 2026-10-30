/**
 * Renders the AuraFX analysis desk from /api/signals or a member workspace board.
 * Analysis only. Buy, Sell and Wait stay with the rule engine.
 */
(function () {
  var API = window.AURAFX_API_BASE != null ? window.AURAFX_API_BASE : '';

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function digitsFor(id) {
    if (id === 'USDJPY' || id === 'EURJPY' || id === 'GBPJPY' || id === 'XAGUSD' || id === 'NATGAS') return 3;
    if (id === 'XAUUSD' || id === 'USOIL' || id === 'UKOIL') return 2;
    if (id === 'COPPER') return 4;
    return 5;
  }

  function price(id, value) {
    if (value == null || !isFinite(Number(value))) return '—';
    return Number(value).toFixed(digitsFor(id));
  }

  function title(value) {
    if (!value) return '—';
    var text = String(value);
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function actionWord(action) {
    if (action === 'BUY') return 'Buy';
    if (action === 'SELL') return 'Sell';
    return 'Wait';
  }

  function actionClass(action) {
    if (action === 'BUY') return 'buy';
    if (action === 'SELL') return 'sell';
    return 'wait';
  }

  function quality(value) {
    if (value === 'stale') return 'Hourly feed is stale';
    if (value === 'closed') return 'Market closed';
    if (value === 'insufficient') return 'Not enough history';
    if (value === 'unavailable') return 'Price history unavailable';
    return '';
  }

  function when(iso) {
    if (!iso) return '';
    var date = new Date(iso);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleString();
  }

  function selectedRow(desk) {
    var rows = desk.instruments || [];
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].instrument === desk.selected) return rows[i];
    }
    return rows[0] || null;
  }

  function visibleGroups(desk, filter) {
    if (!filter || filter === 'all') return desk.groups || [];
    return (desk.groups || []).filter(function (group) { return group.id === filter; });
  }

  function tierNote(state, desk) {
    if (desk.depth !== 'full') {
      return '<p class="desk-tier"><a href="pricing.html">Pro and Elite</a> open the factor notes, structure levels and scenario conditions. Free keeps the bias, regime and session.</p>';
    }
    var risk = 'Defaults if you size a published plan: 1% per trade, 3% daily loss, 7% weekly loss, 3 open trades. Auto trading is off.';
    if (state.tier === 'elite') {
      return '<p class="desk-tier">Elite can size a published plan in Risk. ' + esc(risk) + '</p>';
    }
    if (state.tier === 'pro') {
      return '<p class="desk-tier">Position sizing for a published plan is on Elite. ' + esc(risk) + '</p>';
    }
    return '<p class="desk-tier">' + esc(risk) + '</p>';
  }

  function fact(label, value, note) {
    return '<article class="desk-fact"><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong><p>' + esc(note || '') + '</p></article>';
  }

  function facts(row) {
    var trendNote = row.trend.note || '';
    if (row.trend.higher) trendNote = 'Higher timeframes: ' + title(row.trend.higher) + '. ' + trendNote;
    var mom = title(row.momentum.state);
    if (row.momentum.rsi != null) mom += ' · RSI ' + Number(row.momentum.rsi).toFixed(1);
    var vol = title(row.volatility.state);
    if (row.volatility.atr != null) vol += ' · ATR ' + price(row.instrument, row.volatility.atr);
    if (row.volatility.atr_ratio != null) vol += ' · ' + Number(row.volatility.atr_ratio).toFixed(2) + '×';
    var levels = '<article class="desk-fact"><span>Key levels</span>' +
      '<strong>Support ' + esc(price(row.instrument, row.structure.support)) + '</strong>' +
      '<strong>Resistance ' + esc(price(row.instrument, row.structure.resistance)) + '</strong>' +
      '<p>' + esc(row.structure.note || '') + '</p></article>';
    return '<div class="desk-facts">' +
      fact('Trend', title(row.trend.state), trendNote) +
      fact('Momentum', mom, row.momentum.note) +
      fact('Volatility', vol, row.volatility.note) +
      levels +
      '</div>';
  }

  function planHtml(row) {
    if (!row.plan) return '<p class="desk-note">' + esc(row.plan_note || '') + '</p>';
    var cells = [
      ['Entry', row.plan.entry],
      ['Stop', row.plan.stop_loss],
      ['Target 1', row.plan.take_profit_1],
      ['Target 2', row.plan.take_profit_2],
      ['Risk / reward', row.plan.risk_reward == null ? null : row.plan.risk_reward + 'R']
    ];
    return '<div class="desk-plan">' + cells.map(function (cell) {
      var shown = cell[0] === 'Risk / reward'
        ? (cell[1] == null ? '—' : cell[1])
        : price(row.instrument, cell[1]);
      return '<div class="desk-level"><span>' + esc(cell[0]) + '</span><strong>' + esc(shown) + '</strong></div>';
    }).join('') + '</div><p class="desk-note">' + esc(row.plan_note || '') + '</p>';
  }

  function scenarioHtml(row) {
    var scene = row.scenario || {};
    var split = '';
    if (scene.holds_if || scene.invalid_if) {
      split = '<div class="desk-split">' +
        '<div><span>Holds while</span><p>' + esc(scene.holds_if || '—') + '</p></div>' +
        '<div><span>Changes if</span><p>' + esc(scene.invalid_if || '—') + '</p></div>' +
        '</div>';
    }
    var extra = (row.blockers || []).filter(function (line) { return line && line !== scene.invalid_if; });
    var list = extra.length
      ? '<ul class="desk-blockers">' + extra.map(function (line) { return '<li>' + esc(line) + '</li>'; }).join('') + '</ul>'
      : '';
    return '<aside class="desk-scenario"><p class="desk-kicker">' + esc(scene.title || 'Scenario outlook') + '</p>' +
      '<h3>' + esc(scene.bias || actionWord(row.action)) + ' bias</h3>' +
      (scene.horizon ? '<p class="desk-note">' + esc(scene.horizon) + '</p>' : '') +
      split + list +
      (scene.note ? '<p class="desk-note">' + esc(scene.note) + '</p>' : '') +
      '</aside>';
  }

  function sheetHtml(row) {
    if (!row) return '<p class="desk-status">No instrument is on this scan.</p>';
    var flag = quality(row.data_quality);
    var chips = '';
    if (row.regime) chips += '<span class="desk-chip">' + esc(title(row.regime)) + '</span>';
    if (row.session) chips += '<span class="desk-chip">' + esc(title(row.session)) + '</span>';
    if (flag) chips += '<span class="desk-chip warn">' + esc(flag) + '</span>';
    var score = row.confidence == null
      ? '<div class="desk-score"><span>Confidence</span><strong>—</strong></div>'
      : '<div class="desk-score"><span>Confidence</span><strong>' + esc(row.confidence) + '</strong></div>';
    var showFacts = !!(row.scenario && row.scenario.holds_if);
    return '<article class="desk-sheet" aria-live="polite">' +
      '<div class="desk-sheet-top"><div class="desk-identity">' +
      '<p class="desk-kicker">' + esc(row.instrument) + '</p>' +
      '<h3>' + esc(row.name) + (row.price == null ? '' : ' <span class="desk-tile-price">' + esc(price(row.instrument, row.price)) + '</span>') + '</h3>' +
      '<p><span class="desk-action ' + actionClass(row.action) + '">' + esc(actionWord(row.action)) + '</span>' + chips + '</p>' +
      (row.regime_note ? '<p class="desk-regime">' + esc(row.regime_note) + '</p>' : '') +
      (row.confidence_basis ? '<p class="desk-basis">' + esc(row.confidence_basis) + '</p>' : '') +
      (row.feed_note ? '<p class="desk-feed">' + esc(row.feed_note) + '</p>' : '') +
      '</div>' + score + '</div>' +
      (showFacts ? facts(row) + planHtml(row) : (row.plan_note ? '<p class="desk-note">' + esc(row.plan_note) + '</p>' : '')) +
      (row.rationale ? '<h4 class="desk-kicker desk-why">Why the engine decided this</h4><p class="desk-rationale">' + esc(row.rationale) + '</p>' : '') +
      scenarioHtml(row) +
      '</article>';
  }

  function railHtml(desk, filter) {
    var html = '';
    visibleGroups(desk, filter).forEach(function (group) {
      var rows = (desk.instruments || []).filter(function (row) { return row.asset === group.id; });
      if (!rows.length) return;
      html += '<h3 class="desk-group-label">' + esc(group.label) + '</h3><div class="desk-board">';
      html += rows.map(function (row) {
        var on = row.instrument === desk.selected ? ' is-on' : '';
        var meta = [row.regime ? title(row.regime) : '', row.session ? title(row.session) : ''].filter(Boolean).join(' · ');
        return '<button type="button" class="desk-tile ' + actionClass(row.action) + on + '" data-desk-pick="' + esc(row.instrument) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
          '<span class="desk-tile-name">' + esc(row.name) + '</span>' +
          '<span class="desk-tile-action">' + esc(actionWord(row.action)) + '</span>' +
          (meta ? '<span class="desk-tile-meta">' + esc(meta) + '</span>' : '') +
          (row.price == null ? '' : '<span class="desk-tile-price">' + esc(price(row.instrument, row.price)) + '</span>') +
          (row.confidence == null ? '' : '<span class="desk-tile-meta">Confidence ' + esc(row.confidence) + '</span>') +
          '</button>';
      }).join('');
      html += '</div>';
    });
    return html || '<p class="desk-status">No instruments match this filter.</p>';
  }

  function pageHead(variant, state) {
    var refresh = state.refresh === false ? '' : '<button type="button" class="desk-refresh" data-desk-refresh>Refresh scan</button>';
    if (variant === 'embedded') {
      var lead = state.depth === 'teaser'
        ? 'Bias, regime and session for this scan. Factor notes, structure levels and scenario conditions open on Pro and Elite.'
        : 'Trend, momentum, volatility and key levels from the same rule engine as the signal board. The scenario is conditional. It is not a forecast of the next price.';
      return '<div class="desk-head"><p class="desk-lead">' + lead + '</p>' + refresh + '</div>';
    }
    return '<div class="desk-head"><div><p class="desk-kicker">Aura analysis desk</p><h2 id="deskHeading">Markets overview</h2>' +
      '<p class="desk-lead">Forex, gold, metals and commodities in one scan. Open a market for the trend, key levels, momentum, volatility, confidence and the reason for Buy, Sell or Wait.</p></div>' +
      refresh + '</div>';
  }

  function markup(desk, state) {
    var stamp = when(desk.updated_at);
    var meta = [desk.summary.scanned + ' markets'];
    if (desk.source) meta.push(desk.source);
    if (stamp) meta.push(stamp);
    var filters = '<div class="desk-filters" role="group" aria-label="Market groups">' +
      '<button type="button" data-desk-filter="all"' + (state.filter === 'all' ? ' class="is-on"' : '') + '>All</button>' +
      (desk.groups || []).map(function (group) {
        var on = state.filter === group.id ? ' class="is-on"' : '';
        return '<button type="button" data-desk-filter="' + esc(group.id) + '"' + on + '>' + esc(group.label) + ' ' + group.count + '</button>';
      }).join('') + '</div>';
    var counts = '<div class="desk-counts" aria-label="Scan summary">' +
      '<div class="desk-count buy"><span>Buy</span><strong>' + esc(desk.summary.buy) + '</strong></div>' +
      '<div class="desk-count sell"><span>Sell</span><strong>' + esc(desk.summary.sell) + '</strong></div>' +
      '<div class="desk-count wait"><span>Wait</span><strong>' + esc(desk.summary.wait) + '</strong></div>' +
      '</div>';
    return pageHead(state.variant, state) + counts +
      '<p class="desk-meta">' + esc(meta.join(' · ')) + ' · Buy and Sell are published signals. Wait means the rules did not publish a plan.</p>' +
      filters + railHtml(desk, state.filter) + sheetHtml(selectedRow(desk)) +
      tierNote(state, desk) +
      '<p class="desk-disclaimer">' + esc(desk.disclaimer) + '</p>';
  }

  function paint(el) {
    var model = window.AuraMarketDeskModel;
    if (!model || !el._desk || !el._desk.board) return;
    var desk = model.build(el._desk.board, { depth: el._desk.depth, instrument: el._desk.instrument });
    if (el._desk.filter && el._desk.filter !== 'all') {
      var visible = (desk.instruments || []).filter(function (row) { return row.asset === el._desk.filter; });
      if (visible.length && !visible.some(function (row) { return row.instrument === desk.selected; })) {
        el._desk.instrument = visible[0].instrument;
        desk = model.build(el._desk.board, { depth: el._desk.depth, instrument: el._desk.instrument });
      }
    }
    el._desk.instrument = desk.selected;
    if (!desk.summary.scanned) {
      el.innerHTML = pageHead(el._desk.variant, el._desk) + '<p class="desk-status">No instruments are on this scan yet.</p><p class="desk-disclaimer">' + esc(desk.disclaimer) + '</p>';
      return;
    }
    el.innerHTML = markup(desk, el._desk);
  }

  function onClick(event) {
    var el = event.currentTarget;
    var filterBtn = event.target.closest('[data-desk-filter]');
    if (filterBtn && el.contains(filterBtn)) {
      el._desk.filter = filterBtn.getAttribute('data-desk-filter') || 'all';
      paint(el);
      return;
    }
    var tile = event.target.closest('[data-desk-pick]');
    if (tile && el.contains(tile)) {
      el._desk.instrument = tile.getAttribute('data-desk-pick');
      paint(el);
      var sheet = el.querySelector('.desk-sheet');
      if (sheet && window.matchMedia && window.matchMedia('(max-width: 720px)').matches) {
        sheet.scrollIntoView({ block: 'nearest' });
      }
      return;
    }
    if (event.target.closest('[data-desk-refresh]') && el._desk && el._desk.refresh !== false) loadPublic(el);
  }

  function ensure(el) {
    if (el._deskBound) return;
    el._deskBound = true;
    el.addEventListener('click', onClick);
  }

  function mount(el, options) {
    if (!el) return;
    var opts = options || {};
    ensure(el);
    el.classList.add('desk');
    el.classList.toggle('desk-embedded', (opts.variant || el.getAttribute('data-desk-variant')) === 'embedded');
    el._desk = {
      board: opts.board || { signals: [] },
      depth: opts.depth === 'teaser' ? 'teaser' : 'full',
      variant: opts.variant || el.getAttribute('data-desk-variant') || 'page',
      tier: opts.tier || '',
      filter: (el._desk && el._desk.filter) || 'all',
      instrument: (el._desk && el._desk.instrument) || opts.instrument || null,
      refresh: opts.refresh !== false && el.getAttribute('data-desk-source') !== 'members'
    };
    if (opts.instrument) el._desk.instrument = opts.instrument;
    paint(el);
  }

  function loadPublic(el) {
    ensure(el);
    el.classList.add('desk');
    var variant = el.getAttribute('data-desk-variant') || 'page';
    el.classList.toggle('desk-embedded', variant === 'embedded');
    el.innerHTML = '<p class="desk-status">Reading the signal engine…</p>';
    fetch(API + '/api/signals', { cache: 'no-store' })
      .then(function (res) { return res.json().then(function (body) { return { ok: res.ok, body: body }; }); })
      .then(function (result) {
        if (!result.ok || !result.body || !result.body.signals) throw new Error('desk');
        mount(el, { board: result.body, depth: 'full', variant: variant, refresh: true });
      })
      .catch(function () {
        el.innerHTML = '<p class="desk-status">The analysis desk could not reach the signal engine. Try again when the feed is back.</p>' +
          '<button type="button" class="desk-refresh" data-desk-refresh>Try again</button>';
        el._desk = el._desk || { refresh: true, variant: variant, filter: 'all' };
      });
  }

  function boot() {
    document.querySelectorAll('[data-market-desk]').forEach(loadPublic);
  }

  window.AuraMarketDesk = { mount: mount, load: loadPublic };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
