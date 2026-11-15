/**
 * Server-side live market quotes — single source of truth for AuraFX.
 * Sources: Yahoo Finance (FX/metals), open.er-api.com (FX backup), CoinGecko (crypto + gold).
 * A failing provider is skipped. Last good prices stay in cache. Refresh errors are logged, not thrown.
 */
const https = require('https');

const UPSTREAM_MS = Number(process.env.QUOTES_UPSTREAM_MS) || 5000;
const CLIENT_POLL_SEC = Number(process.env.CLIENT_POLL_SEC) || 1;
/** @deprecated use UPSTREAM_MS — kept for env compatibility */
const CACHE_TTL_MS = UPSTREAM_MS;
const FINNHUB_KEY = String(process.env.FINNHUB_API_KEY || '').trim();
const BACKOFF_MIN_MS = 1000;
const BACKOFF_MAX_MS = 15 * 60 * 1000;
const BACKOFF_DEFAULT_MS = 60000;

let cache = { at: 0, payload: null };
let inflight = null;
let attemptedAt = 0;
const hostBackoffUntil = Object.create(null);

function hostFromUrl(url) {
  try {
    return new URL(url).host;
  } catch (e) {
    return '';
  }
}

function retryAfterMs(header) {
  if (header == null || header === '') return BACKOFF_DEFAULT_MS;
  const sec = Number(header);
  if (isFinite(sec)) return Math.min(BACKOFF_MAX_MS, Math.max(BACKOFF_MIN_MS, sec * 1000));
  const when = Date.parse(String(header));
  if (!isNaN(when)) return Math.min(BACKOFF_MAX_MS, Math.max(BACKOFF_MIN_MS, when - Date.now()));
  return BACKOFF_DEFAULT_MS;
}

function emptyFx() {
  return { forex: {}, changes: {}, times: {}, source: '' };
}

function emptyMetals() {
  return { metals: {}, changes: {}, times: {}, source: '' };
}

function emptyCrypto() {
  return { crypto: {}, changes: {}, times: {}, source: '' };
}

function emptyPayload() {
  return {
    loaded: false,
    live: false,
    source: 'Live feeds unavailable',
    updatedAt: new Date().toISOString(),
    refreshSeconds: CLIENT_POLL_SEC,
    upstreamSeconds: Math.round(UPSTREAM_MS / 1000),
    forex: {},
    metals: {},
    crypto: {},
    changes: {},
    symbolTimes: {}
  };
}

function numMap(obj) {
  const out = {};
  if (!obj || typeof obj !== 'object') return out;
  Object.keys(obj).forEach((k) => {
    const v = obj[k];
    if (typeof v === 'number' && isFinite(v)) out[k] = v;
  });
  return out;
}

/**
 * Always settles. Non-JSON and non-2xx resolve with status and body:null.
 * HTTP 429 backs off that host so later calls skip the network until Retry-After.
 */
function httpsJson(url, headers) {
  return new Promise((resolve) => {
    const host = hostFromUrl(url);
    if (host && Date.now() < (hostBackoffUntil[host] || 0)) {
      resolve({ status: 429, body: null, backoff: true });
      return;
    }

    let settled = false;
    let req = null;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (req) {
        try { req.setTimeout(0); } catch (_) { /* timeout already cleared */ }
      }
      resolve(result);
    };

    try {
      req = https.get(url, {
        headers: Object.assign({
          'User-Agent': 'AuraFX-Elite/1.0',
          Accept: 'application/json'
        }, headers || {})
      }, (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('error', (e) => {
          console.warn('[AuraFX quotes] response error ' + (host || 'upstream') + ':', e && e.message ? e.message : e);
          finish({ status: res.statusCode || 0, body: null, error: e && e.message ? e.message : 'response error' });
        });
        res.on('end', () => {
          const status = res.statusCode || 0;
          let body = null;
          let parseError = null;
          const trimmed = String(raw || '').trim();
          if (trimmed) {
            try {
              body = JSON.parse(trimmed);
            } catch (e) {
              parseError = 'Bad JSON from ' + (host || 'upstream');
            }
          }
          if (status === 429 && host) {
            const wait = retryAfterMs(res.headers && res.headers['retry-after']);
            hostBackoffUntil[host] = Date.now() + wait;
            console.warn(
              '[AuraFX quotes] HTTP 429 from ' + host +
              (parseError ? ' (non-JSON body)' : '') +
              ' — backing off ' + Math.round(wait / 1000) + 's'
            );
          } else if (parseError) {
            console.warn('[AuraFX quotes] ' + parseError + ' (HTTP ' + status + ')');
          } else if (status < 200 || status >= 300) {
            console.warn('[AuraFX quotes] HTTP ' + status + ' from ' + (host || 'upstream'));
          }
          finish({ status: status, body: body, error: parseError });
        });
      });
    } catch (e) {
      console.warn('[AuraFX quotes] request failed ' + (host || 'upstream') + ':', e && e.message ? e.message : e);
      finish({ status: 0, body: null, error: e && e.message ? e.message : 'request failed' });
      return;
    }

    req.on('error', (e) => {
      console.warn('[AuraFX quotes] request failed ' + (host || 'upstream') + ':', e && e.message ? e.message : e);
      finish({ status: 0, body: null, error: e && e.message ? e.message : 'request failed' });
    });
    req.setTimeout(12000, () => {
      console.warn('[AuraFX quotes] timeout ' + (host || 'upstream'));
      finish({ status: 0, body: null, error: 'Timeout ' + (host || 'upstream') });
      try { req.destroy(); } catch (_) { /* socket already closed */ }
    });
  });
}

async function yahooChart(symbol) {
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' +
    encodeURIComponent(symbol) + '?interval=1m&range=1d';
  const res = await httpsJson(url);
  const result = res && res.body && res.body.chart && res.body.chart.result && res.body.chart.result[0];
  if (!res || res.status !== 200 || !result) return null;
  const meta = result.meta || {};
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
    'USDCAD=X': 'USDCAD',
    'EURGBP=X': 'EURGBP',
    'EURJPY=X': 'EURJPY',
    'EURAUD=X': 'EURAUD',
    'EURNZD=X': 'EURNZD',
    'EURCAD=X': 'EURCAD',
    'GBPJPY=X': 'GBPJPY',
    'GBPAUD=X': 'GBPAUD',
    'GBPCAD=X': 'GBPCAD',
    'AUDJPY=X': 'AUDJPY',
    'AUDNZD=X': 'AUDNZD',
    'AUDCAD=X': 'AUDCAD',
    'NZDJPY=X': 'NZDJPY',
    'USDTRY=X': 'USDTRY',
    'USDZAR=X': 'USDZAR',
    'USDMXN=X': 'USDMXN',
    'USDSGD=X': 'USDSGD',
    'USDHKD=X': 'USDHKD',
    'USDSEK=X': 'USDSEK',
    'USDNOK=X': 'USDNOK',
    'USDDKK=X': 'USDDKK',
    'USDPLN=X': 'USDPLN',
    'USDCNH=X': 'USDCNH'
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
  const empty = emptyFx();
  try {
    const res = await httpsJson('https://open.er-api.com/v6/latest/USD');
    if (!res || res.status !== 200 || !res.body || !res.body.rates) return empty;
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
    let t = new Date().toISOString();
    if (res.body.time_last_update_utc) {
      const parsed = new Date(res.body.time_last_update_utc);
      if (!isNaN(parsed.getTime())) t = parsed.toISOString();
    }
    return { forex, changes: {}, times: { _fx: t }, source: 'open.er-api.com' };
  } catch (e) {
    console.warn('[AuraFX quotes] FX backup failed:', e && e.message ? e.message : e);
    return empty;
  }
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
    if (res && res.status === 200 && res.body) {
      const pax = res.body['pax-gold'];
      const xaut = res.body['tether-gold'];
      const prices = [];
      if (pax && pax.usd && isFinite(pax.usd)) prices.push(Number(pax.usd));
      if (xaut && xaut.usd && isFinite(xaut.usd)) prices.push(Number(xaut.usd));
      if (prices.length) {
        metals.XAUUSD = prices.reduce((a, b) => a + b, 0) / prices.length;
        const ch = (pax && pax.usd_24h_change) || (xaut && xaut.usd_24h_change);
        if (ch != null && isFinite(ch)) changes.XAUUSD = Number(ch);
        times.XAUUSD = new Date().toISOString();
        sources.push('CoinGecko gold');
      }
    }
  } catch (e) {
    console.warn('[AuraFX quotes] CoinGecko gold failed:', e && e.message ? e.message : e);
  }

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

  return { metals, changes, times, source: sources.join(' + ') || '' };
}

async function fetchCryptoFinnhub() {
  if (!FINNHUB_KEY) return emptyCrypto();
  const map = {
    'BINANCE:BTCUSDT': 'BTC', 'BINANCE:ETHUSDT': 'ETH', 'BINANCE:BNBUSDT': 'BNB',
    'BINANCE:SOLUSDT': 'SOL', 'BINANCE:XRPUSDT': 'XRP', 'BINANCE:ADAUSDT': 'ADA',
    'BINANCE:DOGEUSDT': 'DOGE', 'BINANCE:TRXUSDT': 'TRX', 'BINANCE:AVAXUSDT': 'AVAX',
    'BINANCE:LINKUSDT': 'LINK', 'BINANCE:DOTUSDT': 'DOT', 'BINANCE:LTCUSDT': 'LTC'
  };
  const crypto = {};
  const changes = {};
  await Promise.all(Object.keys(map).map(async (sym) => {
    try {
      const res = await httpsJson(
        'https://finnhub.io/api/v1/quote?symbol=' + encodeURIComponent(sym) +
        '&token=' + encodeURIComponent(FINNHUB_KEY)
      );
      if (!res || res.status !== 200 || !res.body || !res.body.c || !isFinite(res.body.c)) return;
      crypto[map[sym]] = Number(res.body.c);
      if (res.body.dp != null && isFinite(res.body.dp)) changes[map[sym]] = Number(res.body.dp);
    } catch (_) { /* skip */ }
  }));
  return {
    crypto,
    changes,
    times: Object.keys(crypto).length ? { _crypto: new Date().toISOString() } : {},
    source: Object.keys(crypto).length ? 'Finnhub crypto' : ''
  };
}

async function fetchCrypto() {
  let finn = emptyCrypto();
  try {
    finn = await fetchCryptoFinnhub();
  } catch (e) {
    console.warn('[AuraFX quotes] Finnhub crypto failed:', e && e.message ? e.message : e);
    finn = emptyCrypto();
  }
  if (finn.crypto && Object.keys(finn.crypto).length >= 6) return finn;

  const ids = 'bitcoin,ethereum,binancecoin,solana,ripple,cardano,dogecoin,tron,avalanche-2,chainlink,polkadot,litecoin';
  try {
    const res = await httpsJson(
      'https://api.coingecko.com/api/v3/simple/price?ids=' + ids + '&vs_currencies=usd&include_24hr_change=true'
    );
    const map = {
      bitcoin: 'BTC', ethereum: 'ETH', binancecoin: 'BNB', solana: 'SOL', ripple: 'XRP',
      cardano: 'ADA', dogecoin: 'DOGE', tron: 'TRX', 'avalanche-2': 'AVAX', chainlink: 'LINK',
      polkadot: 'DOT', litecoin: 'LTC'
    };
    const cgCrypto = {};
    const cgChanges = {};
    if (res && res.status === 200 && res.body) {
      Object.keys(map).forEach((id) => {
        const row = res.body[id];
        if (row && row.usd && isFinite(row.usd)) {
          cgCrypto[map[id]] = Number(row.usd);
          if (row.usd_24h_change != null && isFinite(row.usd_24h_change)) {
            cgChanges[map[id]] = Number(row.usd_24h_change);
          }
        }
      });
    }
    const crypto = Object.assign({}, finn.crypto, cgCrypto);
    const changes = Object.assign({}, finn.changes, cgChanges);
    const parts = [];
    if (finn.source) parts.push(finn.source);
    if (Object.keys(cgCrypto).length) parts.push('CoinGecko');
    const times = Object.assign({}, finn.times);
    if (Object.keys(crypto).length) times._crypto = new Date().toISOString();
    return { crypto, changes, times, source: parts.join(' + ') };
  } catch (e) {
    console.warn('[AuraFX quotes] CoinGecko crypto failed:', e && e.message ? e.message : e);
    return finn;
  }
}

function caught(label, fn, fallback) {
  try {
    return Promise.resolve(fn()).catch((e) => {
      console.warn('[AuraFX quotes] ' + label + ' failed:', e && e.message ? e.message : e);
      return fallback;
    });
  } catch (e) {
    console.warn('[AuraFX quotes] ' + label + ' failed:', e && e.message ? e.message : e);
    return Promise.resolve(fallback);
  }
}

async function fetchAllQuotes() {
  const [fxY, fxE, met, cr] = await Promise.all([
    caught('Yahoo FX', fetchForexYahoo, emptyFx()),
    caught('FX backup', fetchForexErApi, emptyFx()),
    caught('metals', fetchMetals, emptyMetals()),
    caught('crypto', fetchCrypto, emptyCrypto())
  ]);

  const forex = Object.assign({}, fxE.forex, fxY.forex);
  const metals = Object.assign({}, met.metals);
  const crypto = Object.assign({}, cr.crypto);
  const changes = Object.assign({}, fxE.changes, fxY.changes, met.changes, cr.changes);
  const symbolTimes = Object.assign({}, fxE.times, fxY.times, met.times, cr.times);

  const parts = [];
  if (Object.keys(fxY.forex).length) parts.push(fxY.source);
  else if (Object.keys(fxE.forex).length) parts.push(fxE.source);
  if (met.source) parts.push(met.source);
  if (Object.keys(crypto).length && cr.source) parts.push(cr.source);

  const live = Object.keys(forex).length + Object.keys(metals).length + Object.keys(crypto).length > 0;

  return {
    loaded: live,
    live,
    source: live ? (parts.filter(Boolean).join(' · ') || 'Live quotes') : 'Live feeds unavailable',
    updatedAt: new Date().toISOString(),
    refreshSeconds: CLIENT_POLL_SEC,
    upstreamSeconds: Math.round(UPSTREAM_MS / 1000),
    forex,
    metals,
    crypto,
    changes,
    symbolTimes
  };
}

function decoratePayload(payload) {
  if (!payload) return payload;
  const ageMs = cache.at ? Math.max(0, Date.now() - cache.at) : 0;
  return Object.assign({}, payload, {
    refreshSeconds: CLIENT_POLL_SEC,
    upstreamSeconds: Math.round(UPSTREAM_MS / 1000),
    cacheAgeMs: ageMs
  });
}

function commitQuotes(payload) {
  const prev = cache.payload;
  const freshForex = numMap(payload && payload.forex);
  const freshMetals = numMap(payload && payload.metals);
  const freshCrypto = numMap(payload && payload.crypto);
  const anyFresh = Object.keys(freshForex).length + Object.keys(freshMetals).length + Object.keys(freshCrypto).length > 0;

  if (!anyFresh) {
    console.warn('[AuraFX quotes] refresh returned no prices — keeping last good cache');
    if (prev) return prev;
    const empty = emptyPayload();
    cache.at = Date.now();
    cache.payload = empty;
    return empty;
  }

  const forex = Object.assign({}, numMap(prev && prev.forex), freshForex);
  const metals = Object.assign({}, numMap(prev && prev.metals), freshMetals);
  const crypto = Object.assign({}, numMap(prev && prev.crypto), freshCrypto);
  const changes = Object.assign({}, numMap(prev && prev.changes), numMap(payload && payload.changes));
  const symbolTimes = Object.assign({}, (prev && prev.symbolTimes) || {}, (payload && payload.symbolTimes) || {});

  const kept = [];
  if (!Object.keys(freshForex).length && Object.keys(numMap(prev && prev.forex)).length) kept.push('forex');
  if (!Object.keys(freshMetals).length && Object.keys(numMap(prev && prev.metals)).length) kept.push('metals');
  if (!Object.keys(freshCrypto).length && Object.keys(numMap(prev && prev.crypto)).length) kept.push('crypto');

  let source = payload && payload.source && payload.source !== 'Live feeds unavailable'
    ? payload.source
    : ((prev && prev.source) || '');
  if (kept.length) source = (source ? source + ' · ' : '') + 'last good ' + kept.join(', ');

  const stored = {
    loaded: true,
    live: true,
    source: source || 'Live quotes',
    updatedAt: new Date().toISOString(),
    refreshSeconds: CLIENT_POLL_SEC,
    upstreamSeconds: Math.round(UPSTREAM_MS / 1000),
    forex: forex,
    metals: metals,
    crypto: crypto,
    changes: changes,
    symbolTimes: symbolTimes
  };
  cache.at = Date.now();
  cache.payload = stored;
  return stored;
}

function beginRefresh() {
  if (inflight) return inflight;
  attemptedAt = Date.now();
  inflight = fetchAllQuotes()
    .then((payload) => commitQuotes(payload))
    .catch((e) => {
      console.warn('[AuraFX quotes] refresh failed — keeping last good cache:', e && e.message ? e.message : e);
      return cache.payload || emptyPayload();
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

function kickBackgroundRefresh() {
  // Nothing awaits this promise. Swallow failures here so Node does not exit.
  beginRefresh().catch((e) => {
    console.warn('[AuraFX quotes] stale refresh failed — keeping cache:', e && e.message ? e.message : e);
  });
}

async function getQuotes(force) {
  const age = cache.at ? Date.now() - cache.at : Infinity;
  const stale = age >= UPSTREAM_MS;

  if (!force && cache.payload && !stale) {
    return decoratePayload(cache.payload);
  }

  if (!force && cache.payload && stale) {
    if (Date.now() - attemptedAt >= UPSTREAM_MS) kickBackgroundRefresh();
    return decoratePayload(cache.payload);
  }

  const payload = await beginRefresh();
  return decoratePayload(payload || emptyPayload());
}

function startAutoRefresh() {
  setInterval(() => {
    getQuotes(true).catch((e) => {
      console.warn('[AuraFX quotes] scheduled refresh failed — keeping cache:', e && e.message ? e.message : e);
    });
  }, UPSTREAM_MS);
}

module.exports = { getQuotes, startAutoRefresh, CACHE_TTL_MS, UPSTREAM_MS, CLIENT_POLL_SEC };
