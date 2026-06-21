/**
 * Server-side live market quotes — single source of truth for AuraFX.
 * Sources: Yahoo Finance (FX/metals), open.er-api.com (FX backup), CoinGecko (crypto + gold).
 */
const https = require('https');

const CACHE_TTL_MS = Number(process.env.QUOTES_CACHE_MS) || 30000;
const FINNHUB_KEY = String(process.env.FINNHUB_API_KEY || '').trim();

let cache = { at: 0, payload: null };
let inflight = null;

function httpsJson(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'AuraFX-Elite/1.0', Accept: 'application/json', ...headers } }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch (e) {
          reject(new Error('Bad JSON from ' + url));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(12000, () => { req.destroy(new Error('Timeout')); });
  });
}

async function yahooChart(symbol) {
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' +
    encodeURIComponent(symbol) + '?interval=1m&range=1d';
  const res = await httpsJson(url);
  if (res.status !== 200 || !res.body.chart || !res.body.chart.result || !res.body.chart.result[0]) {
    return null;
  }
  const meta = res.body.chart.result[0].meta;
  const price = meta.regularMarketPrice;
  if (!price || !isFinite(price)) return null;
  return {
    price: Number(price),
    time: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null,
    changePct: meta.chartPreviousClose
      ? ((price - meta.chartPreviousClose) / meta.chartPreviousClose) * 100
      : null
  };
}

async function fetchForexYahoo() {
  const map = {
    'EURUSD=X': 'EURUSD',
    'GBPUSD=X': 'GBPUSD',
    'USDJPY=X': 'USDJPY',
    'USDCHF=X': 'USDCHF',
    'AUDUSD=X': 'AUDUSD',
    'NZDUSD=X': 'NZDUSD',
    'USDCAD=X': 'USDCAD'
  };
  const forex = {};
  const changes = {};
  const times = {};
  await Promise.all(Object.keys(map).map(async (sym) => {
    try {
      const q = await yahooChart(sym);
      if (q) {
        forex[map[sym]] = q.price;
        if (q.changePct != null) changes[map[sym]] = q.changePct;
        if (q.time) times[map[sym]] = q.time;
      }
    } catch (_) { /* skip */ }
  }));
  const e = forex.EURUSD;
  const g = forex.GBPUSD;
  const j = forex.USDJPY;
  if (e && g) forex.EURGBP = e / g;
  if (e && j) forex.EURJPY = e * j;
  if (g && j) forex.GBPJPY = g * j;
  return { forex, changes, times, source: 'Yahoo Finance' };
}

async function fetchForexErApi() {
  const res = await httpsJson('https://open.er-api.com/v6/latest/USD');
  if (res.status !== 200 || !res.body.rates) return { forex: {}, changes: {}, times: {}, source: '' };
  const r = res.body.rates;
  const forex = {};
  if (r.EUR) forex.EURUSD = 1 / r.EUR;
  if (r.GBP) forex.GBPUSD = 1 / r.GBP;
  if (r.JPY) forex.USDJPY = r.JPY;
  if (r.CHF) forex.USDCHF = r.CHF;
  if (r.AUD) forex.AUDUSD = 1 / r.AUD;
  if (r.NZD) forex.NZDUSD = 1 / r.NZD;
  if (r.CAD) forex.USDCAD = r.CAD;
  if (r.TRY) forex.USDTRY = r.TRY;
  if (r.ZAR) forex.USDZAR = r.ZAR;
  if (r.MXN) forex.USDMXN = r.MXN;
  if (r.SGD) forex.USDSGD = r.SGD;
  if (r.SEK) forex.USDSEK = r.SEK;
  if (r.NOK) forex.USDNOK = r.NOK;
  if (r.PLN) forex.USDPLN = r.PLN;
  const e = forex.EURUSD;
  const g = forex.GBPUSD;
  const j = forex.USDJPY;
  if (e && g) forex.EURGBP = e / g;
  if (e && j) forex.EURJPY = e * j;
  if (g && j) forex.GBPJPY = g * j;
  const t = res.body.time_last_update_utc
    ? new Date(res.body.time_last_update_utc).toISOString()
    : new Date().toISOString();
  return { forex, changes: {}, times: { _fx: t }, source: 'open.er-api.com' };
}

async function fetchMetals() {
  const metals = {};
  const changes = {};
  const times = {};
  const sources = [];

  try {
    const res = await httpsJson(
      'https://api.coingecko.com/api/v3/simple/price?ids=pax-gold,tether-gold&vs_currencies=usd&include_24hr_change=true'
    );
    if (res.status === 200 && res.body) {
      const pax = res.body['pax-gold'];
      const xaut = res.body['tether-gold'];
      const prices = [];
      if (pax && pax.usd) prices.push(pax.usd);
      if (xaut && xaut.usd) prices.push(xaut.usd);
      if (prices.length) {
        metals.XAUUSD = prices.reduce((a, b) => a + b, 0) / prices.length;
        const ch = (pax && pax.usd_24h_change) || (xaut && xaut.usd_24h_change);
        if (ch != null) changes.XAUUSD = ch;
        times.XAUUSD = new Date().toISOString();
        sources.push('CoinGecko gold');
      }
    }
  } catch (_) { /* skip */ }

  try {
    const gc = await yahooChart('GC=F');
    if (gc && gc.price) {
      if (!metals.XAUUSD) metals.XAUUSD = gc.price;
      else metals.XAUUSD = (metals.XAUUSD + gc.price) / 2;
      if (gc.changePct != null) changes.XAUUSD = changes.XAUUSD != null ? (changes.XAUUSD + gc.changePct) / 2 : gc.changePct;
      times.XAUUSD = gc.time || times.XAUUSD;
      sources.push('Yahoo GC=F');
    }
  } catch (_) { /* skip */ }

  try {
    const si = await yahooChart('SI=F');
    if (si && si.price) {
      metals.XAGUSD = si.price;
      if (si.changePct != null) changes.XAGUSD = si.changePct;
      times.XAGUSD = si.time;
      sources.push('Yahoo silver');
    }
  } catch (_) { /* skip */ }

  if (metals.XAUUSD && !metals.XAGUSD) metals.XAGUSD = metals.XAUUSD / 88;

  return { metals, changes, times, source: sources.join(' + ') || 'Metals API' };
}

async function fetchCrypto() {
  const ids = 'bitcoin,ethereum,binancecoin,solana,ripple,cardano,dogecoin,tron,avalanche-2,chainlink,polkadot,litecoin';
  const res = await httpsJson(
    'https://api.coingecko.com/api/v3/simple/price?ids=' + ids + '&vs_currencies=usd&include_24hr_change=true'
  );
  if (res.status !== 200) return { crypto: {}, changes: {}, times: {}, source: '' };
  const map = {
    bitcoin: 'BTC', ethereum: 'ETH', binancecoin: 'BNB', solana: 'SOL', ripple: 'XRP',
    cardano: 'ADA', dogecoin: 'DOGE', tron: 'TRX', 'avalanche-2': 'AVAX', chainlink: 'LINK',
    polkadot: 'DOT', litecoin: 'LTC'
  };
  const crypto = {};
  const changes = {};
  Object.keys(map).forEach((id) => {
    if (res.body[id] && res.body[id].usd) {
      crypto[map[id]] = res.body[id].usd;
      if (res.body[id].usd_24h_change != null) changes[map[id]] = res.body[id].usd_24h_change;
    }
  });
  return {
    crypto,
    changes,
    times: { _crypto: new Date().toISOString() },
    source: 'CoinGecko'
  };
}

async function fetchAllQuotes() {
  const [fxY, fxE, met, cr] = await Promise.all([
    fetchForexYahoo(),
    fetchForexErApi(),
    fetchMetals(),
    fetchCrypto()
  ]);

  const forex = { ...fxE.forex, ...fxY.forex };
  const metals = { ...met.metals };
  const crypto = { ...cr.crypto };
  const changes = { ...fxE.changes, ...fxY.changes, ...met.changes, ...cr.changes };
  const symbolTimes = { ...fxE.times, ...fxY.times, ...met.times, ...cr.times };

  const parts = [];
  if (Object.keys(fxY.forex).length) parts.push(fxY.source);
  else if (Object.keys(fxE.forex).length) parts.push(fxE.source);
  if (met.source) parts.push(met.source);
  if (Object.keys(crypto).length) parts.push(cr.source);

  const live = Object.keys(forex).length + Object.keys(metals).length + Object.keys(crypto).length > 0;

  return {
    loaded: live,
    live,
    source: live ? parts.join(' · ') : 'Reference fallback',
    updatedAt: new Date().toISOString(),
    refreshSeconds: Math.round(CACHE_TTL_MS / 1000),
    forex,
    metals,
    crypto,
    changes,
    symbolTimes
  };
}

async function getQuotes(force) {
  if (!force && cache.payload && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.payload;
  }
  if (inflight) return inflight;
  inflight = fetchAllQuotes()
    .then((payload) => {
      cache.at = Date.now();
      cache.payload = payload;
      inflight = null;
      return payload;
    })
    .catch((e) => {
      inflight = null;
      if (cache.payload) return cache.payload;
      throw e;
    });
  return inflight;
}

function startAutoRefresh() {
  setInterval(() => {
    getQuotes(true).catch(() => {});
  }, CACHE_TTL_MS);
}

module.exports = { getQuotes, startAutoRefresh, CACHE_TTL_MS };
