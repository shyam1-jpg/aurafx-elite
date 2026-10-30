/**
 * AuraFX analysis desk. Turns a signal-engine board into an overview and
 * one dossier per instrument. The engine still decides Buy, Sell and Wait.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AuraMarketDeskModel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var DISCLAIMER = 'Aura Elite FX provides AI-assisted market analysis, confidence scoring, backtesting and risk tools. Trading involves risk and no result is guaranteed.';
  var GROUPS = [
    ['forex', 'Forex'],
    ['metal', 'Metals'],
    ['commodity', 'Commodities']
  ];
  var ACTION_RANK = { BUY: 0, SELL: 1, WAIT: 2, NO_TRADE: 3 };
  var METALS = { XAUUSD: true, XAGUSD: true };
  var COMMODITIES = { USOIL: true, UKOIL: true, NATGAS: true, COPPER: true };

  function factorOf(signal, key) {
    var list = (signal && signal.factors) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].key === key) return list[i];
    }
    return null;
  }

  function finite(value) {
    return value != null && value !== '' && isFinite(Number(value));
  }

  function assetOf(signal) {
    if (signal && signal.asset) return signal.asset;
    var id = String((signal && signal.instrument) || '');
    if (METALS[id]) return 'metal';
    if (COMMODITIES[id]) return 'commodity';
    return id ? 'forex' : 'other';
  }

  function volatilityWord(ratio) {
    if (!finite(ratio)) return 'unmeasured';
    var value = Number(ratio);
    if (value >= 2.2) return 'wide';
    if (value >= 1.3) return 'elevated';
    if (value < 0.6) return 'quiet';
    return 'normal';
  }

  function scenario(signal, depth) {
    var action = (signal && signal.action) || 'WAIT';
    var bias = action === 'BUY' ? 'Buy' : action === 'SELL' ? 'Sell' : 'Wait';
    if (depth !== 'full') {
      return {
        title: 'Scenario outlook',
        bias: bias,
        horizon: null,
        holds_if: null,
        invalid_if: null,
        note: 'Factor notes, structure levels and scenario conditions are on Pro and Elite. Free keeps the bias, regime and session from this scan.'
      };
    }
    var regime = signal.regime || 'current';
    if (action === 'BUY' || action === 'SELL') {
      var holds = action === 'BUY'
        ? 'The buy bias holds while hourly trend, momentum and structure stay aligned and price holds above support.'
        : 'The sell bias holds while hourly trend, momentum and structure stay aligned and price holds below resistance.';
      var invalid = action === 'BUY'
        ? 'The read is no longer valid if price trades through support or the regime turns volatile.'
        : 'The read is no longer valid if price trades through resistance or the regime turns volatile.';
      return {
        title: 'Scenario outlook',
        bias: bias,
        horizon: 'Current H1 scan, checked against H4 and daily agreement.',
        holds_if: holds,
        invalid_if: invalid,
        note: 'This is a conditional read of the current scan. It is not a forecast of the next price.'
      };
    }
    var why = (signal.blockers && signal.blockers[0]) || 'The publication rules are not met on this scan.';
    return {
      title: 'Scenario outlook',
      bias: 'Wait',
      horizon: 'Current H1 scan. There is no separate 30-minute model.',
      holds_if: 'Wait stays in place until trend, momentum, structure and the higher timeframes agree, or a ranging market that is allowed to mean-revert reaches the edge those rules use.',
      invalid_if: why,
      note: 'Wait means no entry, stop or target is published. It is not a forecast that price will stay still.'
    };
  }

  function dossier(signal, depth) {
    var full = depth === 'full';
    var trend = factorOf(signal, 'trend');
    var momentum = factorOf(signal, 'momentum');
    var structure = factorOf(signal, 'structure');
    var volatility = factorOf(signal, 'volatility');
    var mtf = factorOf(signal, 'mtf');
    var published = full && (signal.action === 'BUY' || signal.action === 'SELL') && signal.entry != null;
    return {
      instrument: signal.instrument,
      name: signal.name || signal.instrument,
      asset: assetOf(signal),
      action: signal.action || 'WAIT',
      price: full && finite(signal.price) ? Number(signal.price) : null,
      regime: signal.regime || null,
      regime_note: full ? (signal.regime_note || null) : null,
      session: signal.session || null,
      trend: {
        state: full ? (signal.trend || (trend && trend.state) || null) : null,
        higher: full ? (signal.mtf || (mtf && mtf.state) || null) : null,
        note: full ? ((trend && trend.note) || 'Trend is scored from the hourly candles.') : null
      },
      momentum: {
        state: full ? ((momentum && momentum.state) || null) : null,
        rsi: full && finite(signal.rsi) ? Number(signal.rsi) : null,
        note: full ? ((momentum && momentum.note) || 'Momentum uses RSI on the hourly candles.') : null
      },
      volatility: {
        state: full ? volatilityWord(signal.atr_ratio) : null,
        atr: full && finite(signal.atr) ? Number(signal.atr) : null,
        atr_ratio: full && finite(signal.atr_ratio) ? Number(signal.atr_ratio) : null,
        note: full ? ((volatility && volatility.note) || 'Volatility is hourly ATR versus its recent average. It is a measurement, not a direction.') : null
      },
      structure: {
        state: full ? ((structure && structure.state) || null) : null,
        support: full && finite(signal.support) ? Number(signal.support) : null,
        resistance: full && finite(signal.resistance) ? Number(signal.resistance) : null,
        note: full ? ((structure && structure.note) || 'Support and resistance are recent swing levels on the hourly candles.') : null
      },
      plan: published ? {
        entry: Number(signal.entry),
        stop_loss: finite(signal.stop_loss) ? Number(signal.stop_loss) : null,
        take_profit_1: finite(signal.take_profit_1) ? Number(signal.take_profit_1) : null,
        take_profit_2: finite(signal.take_profit_2) ? Number(signal.take_profit_2) : null,
        risk_reward: finite(signal.risk_reward) ? Number(signal.risk_reward) : null
      } : null,
      plan_note: full
        ? (published
          ? 'These levels restate the published signal. They are not an order.'
          : 'No entry, stop or target is published on this scan.')
        : 'Plan levels stay on Pro and Elite.',
      confidence: full && signal.confidence != null && signal.confidence !== '' ? signal.confidence : null,
      confidence_basis: signal.confidence_basis || null,
      rationale: full ? (signal.rationale || null) : null,
      blockers: full ? (signal.blockers || []).slice(0, 3) : [],
      scenario: scenario(signal, depth),
      data_quality: full ? (signal.data_quality || null) : null,
      feed_note: full ? (signal.feed_note || null) : null
    };
  }

  function build(board, options) {
    var opts = options || {};
    var depth = opts.depth === 'teaser' ? 'teaser' : 'full';
    var signals = ((board && board.signals) || []).filter(function (signal) {
      return signal && signal.instrument;
    });
    var rows = signals.map(function (signal) { return dossier(signal, depth); });
    rows.sort(function (a, b) {
      var left = ACTION_RANK[a.action] == null ? 9 : ACTION_RANK[a.action];
      var right = ACTION_RANK[b.action] == null ? 9 : ACTION_RANK[b.action];
      if (left !== right) return left - right;
      return String(a.name).localeCompare(String(b.name));
    });
    var groups = GROUPS.map(function (pair) {
      return {
        id: pair[0],
        label: pair[1],
        count: rows.filter(function (row) { return row.asset === pair[0]; }).length
      };
    }).filter(function (group) { return group.count > 0; });
    var other = rows.filter(function (row) {
      return row.asset !== 'forex' && row.asset !== 'metal' && row.asset !== 'commodity';
    }).length;
    if (other) groups.push({ id: 'other', label: 'Other', count: other });
    var selected = opts.instrument || null;
    if (!selected || !rows.some(function (row) { return row.instrument === selected; })) {
      var gold = null;
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].instrument === 'XAUUSD') gold = rows[i];
      }
      selected = gold ? gold.instrument : (rows[0] ? rows[0].instrument : null);
    }
    return {
      ok: true,
      depth: depth,
      updated_at: (board && board.updated_at) || null,
      source: (board && board.source) || null,
      summary: {
        buy: rows.filter(function (row) { return row.action === 'BUY'; }).length,
        sell: rows.filter(function (row) { return row.action === 'SELL'; }).length,
        wait: rows.filter(function (row) { return row.action !== 'BUY' && row.action !== 'SELL'; }).length,
        scanned: rows.length
      },
      groups: groups,
      instruments: rows,
      selected: selected,
      risk: depth === 'full' ? {
        per_trade_pct: 1,
        max_daily_loss_pct: 3,
        max_weekly_loss_pct: 7,
        max_open_trades: 3,
        auto_trading: 'off'
      } : null,
      disclaimer: (board && board.disclaimer) || DISCLAIMER
    };
  }

  return { build: build, DISCLAIMER: DISCLAIMER };
});
