/**
 * Server-side live quote + institutional snapshot (owner preview only).
 * Uses shared live-quotes-service.
 */
const quotesService = require('./live-quotes-service');

function scoreFromChange(pct) {
  const s = Math.min(95, Math.max(55, Math.round(70 + Math.abs(pct) * 8)));
  return s;
}

function signalFromChange(pct) {
  if (pct > 0.35) return 'Momentum';
  if (pct < -0.35) return 'Pullback';
  return 'Range';
}

function buildScanner(quotes) {
  const rows = [];
  const e = quotes.forex.EURUSD;
  const b = quotes.crypto.BTC;
  const x = quotes.metals.XAUUSD;
  const ch = quotes.changes || {};
  if (e) {
    const pct = ch.EURUSD != null ? ch.EURUSD : 0;
    rows.push({ name: 'EURUSD', type: signalFromChange(pct), score: scoreFromChange(pct) });
  }
  if (b) {
    const pct = ch.BTC != null ? ch.BTC : 0;
    rows.push({ name: 'BTC', type: signalFromChange(pct), score: scoreFromChange(pct) });
  }
  if (x) {
    rows.push({ name: 'XAUUSD', type: 'Breakout watch', score: 82 });
  }
  rows.push({ name: 'US500', type: 'Reversal watch', score: 72 });
  return rows.slice(0, 4);
}

function pctLabel(sym, changes) {
  const p = changes && changes[sym] != null ? changes[sym] : 0;
  return (p >= 0 ? '+' : '') + Number(p).toFixed(2) + '%';
}

function buildWatchlist(quotes) {
  const items = [];
  const ch = quotes.changes || {};
  const fxPairs = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD'];
  fxPairs.forEach((sym) => {
    if (quotes.forex[sym]) {
      items.push({ symbol: sym, price: quotes.forex[sym], dailyChange: pctLabel(sym, ch), cat: 'forex' });
    }
  });
  ['BTC', 'ETH', 'BNB', 'SOL', 'XRP'].forEach((sym) => {
    if (quotes.crypto[sym]) {
      items.push({ symbol: sym, price: quotes.crypto[sym], dailyChange: pctLabel(sym, ch), cat: 'crypto' });
    }
  });
  if (quotes.metals.XAUUSD) {
    items.push({
      symbol: 'XAUUSD',
      price: quotes.metals.XAUUSD,
      dailyChange: pctLabel('XAUUSD', ch),
      cat: 'metals'
    });
  }
  return items;
}

function buildInstitutional(quotes, mood) {
  const e = quotes.forex.EURUSD;
  const j = quotes.forex.USDJPY;
  const b = quotes.crypto.BTC;
  const x = quotes.metals.XAUUSD;
  const fxN = Object.keys(quotes.forex).length;
  const crN = Object.keys(quotes.crypto).length;

  return {
    cot: 'Live snapshot — gold ' + (x ? '$' + x.toFixed(2) : 'n/a') + '; JPY ' + (j ? j.toFixed(3) : 'n/a'),
    openInterest: 'Live FX pairs: ' + fxN + ' · Live crypto: ' + crN,
    optionsPositioning: 'Indices put skew — feed TBD',
    whaleTracking: b ? 'BTC $' + b.toFixed(0) + ' live' : 'Awaiting quotes',
    etfFlows: 'Gold ETF flows — feed TBD',
    centralBank: (mood || 'CAUTION') + ' — calendar from /api/status',
    smartMoney: e ? 'EURUSD ' + e.toFixed(5) + ' live' : 'Awaiting quotes',
    sentiment: mood === 'SAFE' ? 'Risk-on' : mood === 'DANGER' ? 'Risk-off' : 'Moderate risk-on',
    livePreview: true,
    dataSource: quotes.source,
    quotesUpdatedAt: quotes.updatedAt
  };
}

function ownerKeyOk(req, expected) {
  const got = req.headers['x-owner-key'];
  return got && got === expected;
}

async function getLivePayload(serverCache) {
  const quotes = await quotesService.getQuotes();
  const mood = serverCache && serverCache.mood ? serverCache.mood : 'CAUTION';
  return {
    mode: 'live-preview',
    notPublic: true,
    quotes,
    institutional: buildInstitutional(quotes, mood),
    scanner: buildScanner(quotes),
    watchlist: buildWatchlist(quotes),
    warnings: [
      'LIVE PRICES — refreshed every ' + (quotes.refreshSeconds || 30) + 's from ' + quotes.source,
      'COT / ETF / options feeds still require premium API keys for full institutional data'
    ],
    updatedAt: new Date().toISOString()
  };
}

module.exports = {
  getLivePayload,
  ownerKeyOk,
  INSTITUTIONAL_MODES: ['demo', 'preview', 'public']
};
