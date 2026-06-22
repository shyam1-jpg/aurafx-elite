/**
 * Live multi-asset market builder — Yahoo Finance + CoinGecko.
 * Powers /api/markets with real prices and 24h changes only.
 */
const quotesService = require('./live-quotes-service');

const YAHOO = {
  US30: '^DJI', US500: '^GSPC', NAS100: '^IXIC', RUT2000: '^RUT',
  DAX40: '^GDAXI', FTSE100: '^FTSE', CAC40: '^FCHI', NIK225: '^N225',
  HSI: '^HSI', ASX200: '^AXJO', STOXX50: '^STOXX50E', IBEX35: '^IBEX', SMI: '^SSMI',
  WTI: 'CL=F', BRENT: 'BZ=F', NATGAS: 'NG=F', HEATOIL: 'HO=F', GASOLINE: 'RB=F',
  XPTUSD: 'PL=F', XPDUSD: 'PA=F', COPPER: 'HG=F',
  CORN: 'ZC=F', WHEAT: 'ZW=F', SOYBEANS: 'ZS=F', COFFEE: 'KC=F',
  SUGAR: 'SB=F', COTTON: 'CT=F', COCOA: 'CC=F', OJ: 'OJ=F', LUMBER: 'LBS=F',
  EURGBP: 'EURGBP=X', EURJPY: 'EURJPY=X', EURAUD: 'EURAUD=X', EURNZD: 'EURNZD=X',
  EURCAD: 'EURCAD=X', GBPJPY: 'GBPJPY=X', GBPAUD: 'GBPAUD=X', GBPCAD: 'GBPCAD=X',
  AUDJPY: 'AUDJPY=X', AUDNZD: 'AUDNZD=X', AUDCAD: 'AUDCAD=X', NZDJPY: 'NZDJPY=X',
  USDTRY: 'USDTRY=X', USDZAR: 'USDZAR=X', USDMXN: 'USDMXN=X', USDSGD: 'USDSGD=X',
  USDHKD: 'USDHKD=X', USDSEK: 'USDSEK=X', USDNOK: 'USDNOK=X', USDDKK: 'USDDKK=X',
  USDPLN: 'USDPLN=X', USDCNH: 'USDCNH=X', VIX: '^VIX'
};

const FOREX_MAJORS = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'NZDUSD', 'USDCAD'];
const FOREX_MINORS = ['EURGBP', 'EURJPY', 'EURAUD', 'EURNZD', 'EURCAD', 'GBPJPY', 'GBPAUD', 'GBPCAD', 'AUDJPY', 'AUDNZD', 'AUDCAD', 'NZDJPY'];
const FOREX_EXOTICS = ['USDTRY', 'USDZAR', 'USDMXN', 'USDSGD', 'USDHKD', 'USDSEK', 'USDNOK', 'USDDKK', 'USDPLN', 'USDCNH'];
const METALS = ['XAUUSD', 'XAGUSD', 'XPTUSD', 'XPDUSD', 'COPPER'];
const ENERGY = ['WTI', 'BRENT', 'NATGAS', 'HEATOIL', 'GASOLINE'];
const INDICES = ['US30', 'US500', 'NAS100', 'RUT2000', 'DAX40', 'FTSE100', 'CAC40', 'NIK225', 'HSI', 'ASX200', 'STOXX50', 'IBEX35', 'SMI'];
const AG = ['CORN', 'WHEAT', 'SOYBEANS', 'COFFEE', 'SUGAR', 'COTTON', 'COCOA', 'OJ', 'LUMBER'];

let cache = { at: 0, payload: null };
let cryptoMarketsCache = { at: 0, list: [] };

function httpsJson(url) {
  const https = require('https');
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'AuraFX-Elite/1.0', Accept: 'application/json' } }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(new Error('Timeout')); });
  });
}

async function yahooChart(symbol) {
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' +
    encodeURIComponent(symbol) + '?interval=1m&range=1d';
  try {
    const res = await httpsJson(url);
    if (res.status !== 200 || !res.body.chart?.result?.[0]) return null;
    const meta = res.body.chart.result[0].meta;
    const price = meta.regularMarketPrice;
    if (!price || !isFinite(price)) return null;
    return {
      price: Number(price),
      changePct: meta.chartPreviousClose
        ? ((price - meta.chartPreviousClose) / meta.chartPreviousClose) * 100
        : null,
      time: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null
    };
  } catch (_) {
    return null;
  }
}

function fmtPct(p) {
  if (p == null || !isFinite(p)) return '—';
  return (p >= 0 ? '+' : '') + p.toFixed(2) + '%';
}

function trendFromPct(p) {
  if (p == null || !isFinite(p)) return 'Neutral';
  if (p > 0.15) return 'Bullish';
  if (p < -0.15) return 'Bearish';
  return 'Neutral';
}

function fxDecimals(sym) {
  if (sym.indexOf('JPY') >= 0) return 3;
  return 5;
}

function fmtPrice(sym, cat, price) {
  if (price == null || !isFinite(price)) return '—';
  if (cat === 'forex') return price.toFixed(fxDecimals(sym));
  if (cat === 'crypto') return price < 1 ? price.toFixed(6) : price.toFixed(2);
  if (cat === 'indices') return price.toFixed(0);
  if (cat === 'ag') return price.toFixed(0);
  return price.toFixed(2);
}

function rowFromQuote(sym, cat, price, changePct) {
  const p = price != null ? Number(price) : null;
  const dec = cat === 'forex' ? fxDecimals(sym) : 2;
  return {
    symbol: sym,
    price: p != null ? fmtPrice(sym, cat, p) : '—',
    priceNum: p,
    dailyChange: fmtPct(changePct),
    changePct: changePct,
    trend: trendFromPct(changePct),
    support: p != null ? (p * 0.995).toFixed(dec) : '—',
    resistance: p != null ? (p * 1.005).toFixed(dec) : '—',
    live: p != null
  };
}

async function fetchYahooBatch(symbols) {
  const out = {};
  await Promise.all(symbols.map(async (sym) => {
    const ysym = YAHOO[sym];
    if (!ysym) return;
    const q = await yahooChart(ysym);
    if (q) out[sym] = q;
  }));
  return out;
}

async function fetchCryptoMarkets() {
  if (cryptoMarketsCache.list.length && Date.now() - cryptoMarketsCache.at < 300000) {
    return cryptoMarketsCache.list;
  }
  const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h';
  try {
    const res = await httpsJson(url);
    if (res.status !== 200 || !Array.isArray(res.body)) return cryptoMarketsCache.list;
    const list = res.body.map((c) => ({
      symbol: String(c.symbol || '').toUpperCase(),
      price: c.current_price,
      changePct: c.price_change_percentage_24h,
      marketCap: c.market_cap,
      volume24h: c.total_volume,
      supply: c.circulating_supply,
      name: c.name
    }));
    cryptoMarketsCache.at = Date.now();
    cryptoMarketsCache.list = list;
    return list;
  } catch (_) {
    return cryptoMarketsCache.list;
  }
}

function buildForexRows(symbols, quotes, yahooData) {
  const fx = quotes.forex || {};
  const ch = quotes.changes || {};
  return symbols.map((sym) => {
    let price = fx[sym];
    let changePct = ch[sym];
    if (yahooData && yahooData[sym]) {
      if (price == null) price = yahooData[sym].price;
      if (changePct == null) changePct = yahooData[sym].changePct;
    }
    return rowFromQuote(sym, 'forex', price, changePct);
  }).filter((r) => r.live);
}

function buildMetalRows(quotes, yahooExtra) {
  const metals = quotes.metals || {};
  const ch = quotes.changes || {};
  return METALS.map((sym) => {
    let price = metals[sym];
    let changePct = ch[sym];
    if (yahooExtra[sym]) {
      if (price == null) price = yahooExtra[sym].price;
      if (yahooExtra[sym].changePct != null && changePct == null) changePct = yahooExtra[sym].changePct;
    }
    const row = rowFromQuote(sym, 'metals', price, changePct);
    return {
      symbol: sym,
      spotPrice: row.price,
      priceNum: row.priceNum,
      dailyChange: row.dailyChange,
      changePct: row.changePct,
      trend: row.trend,
      support: row.support,
      resistance: row.resistance,
      live: row.live
    };
  }).filter((r) => r.live);
}

function buildSimpleRows(symbols, yahooData, cat, valueKey) {
  return symbols.map((sym) => {
    const q = yahooData[sym];
    if (!q) return null;
    const row = rowFromQuote(sym, cat, q.price, q.changePct);
    const base = { symbol: sym, dailyChange: row.dailyChange, changePct: row.changePct, trend: row.trend, live: true };
    base[valueKey || 'price'] = row.price;
    if (cat === 'indices') {
      base.value = row.price;
      base.heatScore = (q.changePct || 0) / 2;
    }
    return base;
  }).filter(Boolean);
}

function buildCryptoRows(quotes, coinGeckoList) {
  const map = {};
  coinGeckoList.forEach((c) => { map[c.symbol] = c; });
  const fromQuotes = quotes.crypto || {};
  const ch = quotes.changes || {};
  const symbols = new Set([...Object.keys(fromQuotes), ...coinGeckoList.map((c) => c.symbol)]);
  const rows = [];
  symbols.forEach((sym) => {
    const cg = map[sym];
    const price = cg?.price ?? fromQuotes[sym];
    const changePct = cg?.changePct ?? ch[sym];
    if (price == null) return;
    const mc = cg?.marketCap;
    const vol = cg?.volume24h;
    const sup = cg?.supply;
    rows.push({
      symbol: sym,
      price: fmtPrice(sym, 'crypto', price),
      priceNum: price,
      change24h: fmtPct(changePct),
      changePct: changePct,
      marketCap: mc != null ? '$' + (mc >= 1e9 ? (mc / 1e9).toFixed(2) + 'B' : (mc / 1e6).toFixed(0) + 'M') : '—',
      volume24h: vol != null ? '$' + (vol >= 1e9 ? (vol / 1e9).toFixed(2) + 'B' : (vol / 1e6).toFixed(0) + 'M') : '—',
      supply: sup != null ? (sup >= 1e9 ? (sup / 1e9).toFixed(2) + 'B' : (sup / 1e6).toFixed(2) + 'M') + ' circ.' : '—',
      trend: trendFromPct(changePct),
      live: true
    });
  });
  rows.sort((a, b) => (b.priceNum || 0) - (a.priceNum || 0));
  return rows.slice(0, 50);
}

function buildScanner(forex, crypto, metals, indices) {
  const all = []
    .concat((forex.majors || []).map((r) => ({ symbol: r.symbol, changePct: r.changePct, cat: 'forex' })))
    .concat((crypto || []).slice(0, 10).map((r) => ({ symbol: r.symbol, changePct: r.changePct, cat: 'crypto' })))
    .concat((metals || []).map((r) => ({ symbol: r.symbol, changePct: r.changePct, cat: 'metals' })))
    .concat((indices || []).slice(0, 5).map((r) => ({ symbol: r.symbol, changePct: r.changePct, cat: 'indices' })));
  return all
    .filter((r) => r.changePct != null && isFinite(r.changePct))
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, 8)
    .map((r) => ({
      name: r.symbol,
      type: Math.abs(r.changePct) > 1 ? 'Momentum' : 'Range',
      score: Math.min(95, Math.round(60 + Math.abs(r.changePct) * 8))
    }));
}

async function buildLiveMarkets(calendarNews, warnings) {
  const quotes = await quotesService.getQuotes();
  const yahooSyms = [...INDICES, ...ENERGY, ...AG, 'XPTUSD', 'XPDUSD', 'COPPER', 'VIX',
    ...FOREX_MINORS.filter((s) => YAHOO[s]), ...FOREX_EXOTICS.filter((s) => YAHOO[s])];
  const [yahooData, coinGeckoList] = await Promise.all([
    fetchYahooBatch(yahooSyms),
    fetchCryptoMarkets()
  ]);

  const forex = {
    majors: buildForexRows(FOREX_MAJORS, quotes, yahooData),
    minors: buildForexRows(FOREX_MINORS, quotes, yahooData),
    exotics: buildForexRows(FOREX_EXOTICS, quotes, yahooData)
  };
  const metals = buildMetalRows(quotes, yahooData);
  const crypto = buildCryptoRows(quotes, coinGeckoList);
  const energy = buildSimpleRows(ENERGY, yahooData, 'energy', 'price');
  const indices = buildSimpleRows(INDICES, yahooData, 'indices', 'value');
  const ag = buildSimpleRows(AG, yahooData, 'ag', 'price');

  const vix = yahooData.VIX;
  const gainers = [];
  const losers = [];
  Object.entries(quotes.changes || {}).forEach(([sym, pct]) => {
    if (pct == null) return;
    const item = { n: sym, v: fmtPct(pct) };
    if (pct > 0) gainers.push(item);
    else losers.push(item);
  });
  gainers.sort((a, b) => parseFloat(b.v) - parseFloat(a.v));
  losers.sort((a, b) => parseFloat(a.v) - parseFloat(b.v));

  return {
    live: true,
    dataMode: 'live',
    source: quotes.source + ' · Yahoo Finance · CoinGecko markets',
    updatedAt: new Date().toISOString(),
    quotes,
    forex,
    crypto,
    metals,
    energy,
    indices,
    ag,
    vix: vix ? { value: vix.price.toFixed(2), change: fmtPct(vix.changePct) } : null,
    marketOverview: {
      gainers: gainers.slice(0, 5),
      losers: losers.slice(0, 5),
      vix: vix ? vix.price.toFixed(2) : null
    },
    scanner: buildScanner(forex, crypto, metals, indices),
    news: calendarNews || [],
    warnings: warnings || [],
    disclaimer: 'Live prices from public APIs. Not financial advice. Verify with your broker.'
  };
}

async function getMarkets(calendarNews, warnings, force) {
  if (!force && cache.payload && Date.now() - cache.at < 60000) {
    return cache.payload;
  }
  const payload = await buildLiveMarkets(calendarNews, warnings);
  cache.at = Date.now();
  cache.payload = payload;
  return payload;
}

module.exports = { getMarkets, buildLiveMarkets };
