'use strict';

/**
 * Aura Elite FX — rule-based signal engine (data-driven, not AI-only).
 * AI layer explains signals; this module calculates them.
 */

const SCANNER_PAIRS = [
  'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'NZDUSD', 'USDCAD',
  'EURGBP', 'EURJPY', 'GBPJPY', 'AUDJPY', 'CADJPY', 'XAUUSD', 'XAGUSD'
];

const TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'];

const TF_WEIGHT = { M1: 0.4, M5: 0.5, M15: 0.65, M30: 0.75, H1: 1, H4: 1.1, D1: 1.2, W1: 1.15 };

function pipSize(pair) {
  const p = String(pair || '').toUpperCase();
  if (p.includes('JPY') && !p.startsWith('XAU') && !p.startsWith('XAG')) return 0.01;
  if (p.startsWith('XAU') || p.startsWith('XAG')) return 0.1;
  return 0.0001;
}

function decimals(pair) {
  const p = String(pair || '').toUpperCase();
  if (p.includes('JPY') && !p.startsWith('XAU')) return 3;
  if (p.startsWith('XAU') || p.startsWith('XAG')) return 2;
  return 5;
}

function fmt(price, pair) {
  if (price == null || !isFinite(price)) return null;
  return Number(price).toFixed(decimals(pair));
}

function trendFromChange(changePct, tf) {
  const w = TF_WEIGHT[tf] || 1;
  const adj = (changePct || 0) * w;
  if (adj > 0.08) return 'bullish';
  if (adj < -0.08) return 'bearish';
  return 'neutral';
}

function volatilityLevel(changePct) {
  const a = Math.abs(changePct || 0);
  if (a >= 0.8) return 'high';
  if (a >= 0.25) return 'medium';
  return 'low';
}

function scoreSignal(pair, price, changePct, tf, riskContext) {
  const newsNear = !!(riskContext && riskContext.news_imminent);
  const newsCur = riskContext && riskContext.next_event && riskContext.next_event.currency;
  const base = String(pair).slice(0, 3);
  const quote = String(pair).slice(3, 6);
  const newsHitsPair = newsNear && newsCur &&
    (newsCur === base || newsCur === quote || newsCur === 'USD');

  let score = 50;
  const ch = changePct || 0;
  if (ch > 0) score += Math.min(18, ch * 8);
  else score -= Math.min(18, Math.abs(ch) * 8);

  const tfBoost = (TF_WEIGHT[tf] || 1) * 4;
  score += tfBoost - 4;

  if (newsHitsPair) score -= 22;
  if (Math.abs(ch) < 0.03) score -= 12;

  score = Math.max(0, Math.min(100, Math.round(score)));

  let signal_type = 'WAIT';
  let final_action = 'WAIT';
  if (newsHitsPair && score < 55) {
    signal_type = 'NO_TRADE';
    final_action = 'NO_TRADE';
  } else if (score >= 68 && ch > 0.05) {
    signal_type = 'BUY';
    final_action = 'BUY';
  } else if (score >= 68 && ch < -0.05) {
    signal_type = 'SELL';
    final_action = 'SELL';
  } else if (score < 45 || Math.abs(ch) < 0.02) {
    signal_type = 'NO_TRADE';
    final_action = 'NO_TRADE';
  }

  const rr = final_action === 'NO_TRADE' || final_action === 'WAIT' ? null : 2.0;
  if (final_action !== 'NO_TRADE' && final_action !== 'WAIT' && rr != null && rr < 1.5) {
    signal_type = 'WAIT';
    final_action = 'WAIT';
  }

  return { score, signal_type, final_action, rr };
}

function levels(pair, price, action) {
  if (!price || !isFinite(price)) {
    return { entry_zone: null, stop_loss: null, take_profit_1: null, take_profit_2: null, risk_reward: null };
  }
  const pip = pipSize(pair);
  const isMetal = String(pair).startsWith('XAU') || String(pair).startsWith('XAG');
  const slPips = isMetal ? 120 : 25;
  const tp1Pips = isMetal ? 200 : 50;
  const tp2Pips = isMetal ? 350 : 90;
  const slDist = slPips * pip;
  const tp1Dist = tp1Pips * pip;
  const tp2Dist = tp2Pips * pip;
  const zoneW = pip * (isMetal ? 80 : 8);

  if (action === 'BUY') {
    return {
      entry_zone: [fmt(price - zoneW, pair), fmt(price, pair)],
      stop_loss: fmt(price - slDist, pair),
      take_profit_1: fmt(price + tp1Dist, pair),
      take_profit_2: fmt(price + tp2Dist, pair),
      risk_reward: 2.0
    };
  }
  if (action === 'SELL') {
    return {
      entry_zone: [fmt(price, pair), fmt(price + zoneW, pair)],
      stop_loss: fmt(price + slDist, pair),
      take_profit_1: fmt(price - tp1Dist, pair),
      take_profit_2: fmt(price - tp2Dist, pair),
      risk_reward: 2.0
    };
  }
  return {
    entry_zone: [fmt(price - zoneW, pair), fmt(price + zoneW, pair)],
    stop_loss: null,
    take_profit_1: null,
    take_profit_2: null,
    risk_reward: null
  };
}

function buildSignal(pair, tf, quotes, riskContext) {
  const p = String(pair).toUpperCase();
  let price = null;
  let changePct = null;

  if (quotes) {
    if (quotes.forex && quotes.forex[p]) {
      price = quotes.forex[p];
      changePct = quotes.changes && quotes.changes[p];
    } else if (quotes.metals && quotes.metals[p]) {
      price = quotes.metals[p];
      changePct = quotes.changes && quotes.changes[p];
    }
  }

  const trend = trendFromChange(changePct, tf);
  const { score, signal_type, final_action, rr } = scoreSignal(p, price, changePct, tf, riskContext);
  const lv = levels(p, price, final_action);
  const vol = volatilityLevel(changePct);
  const newsNear = !!(riskContext && riskContext.news_imminent);

  const reasons = [];
  if (trend === 'bullish') reasons.push('Short-term momentum bullish on live quote feed');
  if (trend === 'bearish') reasons.push('Short-term momentum bearish on live quote feed');
  if (trend === 'neutral') reasons.push('Trend unclear — mixed momentum');
  if (vol === 'high') reasons.push('Volatility elevated — wider stops advised');
  if (newsNear) reasons.push('High-impact news nearby — confidence reduced');

  let risk_warning = 'Trading involves risk. Past performance does not guarantee future results.';
  if (final_action === 'NO_TRADE') {
    risk_warning = 'Conditions not clear enough for a trade setup. Wait for better structure.';
  } else if (newsNear) {
    risk_warning = 'High-impact news nearby. Trade risk increased. Consider waiting.';
  }

  return {
    signal_id: `${p}_${tf}_${Date.now()}`,
    pair: p,
    timeframe: tf,
    signal_type,
    trend,
    confidence_score: score,
    entry_zone: lv.entry_zone,
    stop_loss: lv.stop_loss,
    take_profit_1: lv.take_profit_1,
    take_profit_2: lv.take_profit_2,
    risk_reward: lv.risk_reward || rr,
    reason: reasons.join('. ') || 'Scanning market structure.',
    risk_warning,
    news_warning: newsNear ? (riskContext.next_event && riskContext.next_event.title) || 'High-impact event soon' : null,
    spread_warning: vol === 'high' ? 'Spread may widen in volatile conditions' : null,
    volatility: vol,
    final_action,
    price: price != null ? fmt(price, p) : null,
    change_pct: changePct != null ? Math.round(changePct * 100) / 100 : null,
    updated_at: new Date().toISOString(),
    disclaimer: 'Aura Elite FX provides AI-assisted market analysis, confidence scoring, backtesting and risk tools. Trading involves risk and no result is guaranteed.'
  };
}

function scanAll(quotes, riskContext, options) {
  const tf = (options && options.timeframe) || 'H1';
  const pairs = (options && options.pairs) || SCANNER_PAIRS;
  const signals = pairs.map((pair) => buildSignal(pair, tf, quotes, riskContext));
  signals.sort((a, b) => b.confidence_score - a.confidence_score);
  return {
    timeframe: tf,
    updated_at: new Date().toISOString(),
    pairs_scanned: pairs.length,
    signals,
    summary: {
      buy: signals.filter((s) => s.final_action === 'BUY').length,
      sell: signals.filter((s) => s.final_action === 'SELL').length,
      wait: signals.filter((s) => s.final_action === 'WAIT').length,
      no_trade: signals.filter((s) => s.final_action === 'NO_TRADE').length
    },
    disclaimer: 'Educational analysis only — not financial advice. No guaranteed accuracy.'
  };
}

module.exports = {
  SCANNER_PAIRS,
  TIMEFRAMES,
  buildSignal,
  scanAll
};
