'use strict';

const https = require('https');
const zlib = require('zlib');

/**
 * Candle source for the signal engine.
 * Order: Twelve Data when TWELVE_DATA_API_KEY is set, then Yahoo Finance, then
 * Kraken public OHLC for the pairs it actually lists. Keys stay in the environment.
 */

const INSTRUMENTS = [
  { id: 'EURUSD', name: 'EUR/USD', asset: 'forex', yahoo: 'EURUSD=X', twelve: 'EUR/USD', kraken: 'EURUSD' },
  { id: 'GBPUSD', name: 'GBP/USD', asset: 'forex', yahoo: 'GBPUSD=X', twelve: 'GBP/USD', kraken: 'GBPUSD' },
  { id: 'USDJPY', name: 'USD/JPY', asset: 'forex', yahoo: 'USDJPY=X', twelve: 'USD/JPY', kraken: 'USDJPY' },
  { id: 'USDCHF', name: 'USD/CHF', asset: 'forex', yahoo: 'USDCHF=X', twelve: 'USD/CHF', kraken: 'USDCHF' },
  { id: 'AUDUSD', name: 'AUD/USD', asset: 'forex', yahoo: 'AUDUSD=X', twelve: 'AUD/USD', kraken: 'AUDUSD' },
  { id: 'NZDUSD', name: 'NZD/USD', asset: 'forex', yahoo: 'NZDUSD=X', twelve: 'NZD/USD' },
  { id: 'USDCAD', name: 'USD/CAD', asset: 'forex', yahoo: 'USDCAD=X', twelve: 'USD/CAD', kraken: 'USDCAD' },
  { id: 'EURJPY', name: 'EUR/JPY', asset: 'forex', yahoo: 'EURJPY=X', twelve: 'EUR/JPY', kraken: 'EURJPY' },
  { id: 'GBPJPY', name: 'GBP/JPY', asset: 'forex', yahoo: 'GBPJPY=X', twelve: 'GBP/JPY', krakenCross: true },
  { id: 'XAUUSD', name: 'Gold', asset: 'metal', yahoo: 'GC=F', twelve: 'XAU/USD', kraken: 'PAXGUSD', feedNote: 'COMEX gold futures', krakenNote: 'Kraken PAXG tokenized gold tracks spot and is not COMEX futures' },
  { id: 'XAGUSD', name: 'Silver', asset: 'metal', yahoo: 'SI=F', twelve: 'XAG/USD', feedNote: 'COMEX silver futures' },
  { id: 'USOIL', name: 'WTI Crude', asset: 'commodity', yahoo: 'CL=F', twelve: 'WTI/USD', feedNote: 'NYMEX WTI futures' },
  { id: 'UKOIL', name: 'Brent Crude', asset: 'commodity', yahoo: 'BZ=F', twelve: 'BRENT/USD', feedNote: 'Brent futures' },
  { id: 'NATGAS', name: 'Natural Gas', asset: 'commodity', yahoo: 'NG=F', twelve: 'NG/USD', feedNote: 'NYMEX natural gas futures' },
  { id: 'COPPER', name: 'Copper', asset: 'commodity', yahoo: 'HG=F', twelve: 'XCU/USD', feedNote: 'COMEX copper futures' }
];

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const YAHOO_HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
const STALE_MS = 6 * 60 * 60 * 1000;
const NEGATIVE_MS = 45 * 1000;

const candleCache = new Map();
let yahooCrumb = null;
let crumbFailedAt = 0;
let crumbInflight = null;
let krakenTail = Promise.resolve();

function decodeHttpBody(buffer, encoding) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const enc = String(encoding || '').toLowerCase();
  const gzipMagic = buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b;
  try {
    if (enc.includes('br')) return zlib.brotliDecompressSync(buf);
    if (enc.includes('gzip') || gzipMagic) return zlib.gunzipSync(buf);
    if (enc.includes('deflate')) {
      try { return zlib.inflateSync(buf); } catch (error) { return zlib.inflateRawSync(buf); }
    }
  } catch (error) {
    const head = buf[0];
    if (head === 0x7b || head === 0x5b || head === 0x3c) return buf;
    throw error;
  }
  return buf;
}

function safeError(message) {
  return String(message || 'Price feed failed').replace(/apikey=[^&\s]+/gi, 'apikey=redacted').slice(0, 180);
}

function pushError(list, error) {
  const msg = safeError(error && error.message);
  if (msg && !list.includes(msg) && list.length < 6) list.push(msg);
}

function isHardFailure(error) {
  if (!error) return false;
  if (error.hard === false) return false;
  if (error.hard === true) return true;
  return /HTML|not JSON|empty body|429|403|401|Unauthorized|decompress|timeout|crumb/i.test(error.message || '');
}

function shouldTryCrumb(error) {
  const message = String(error && error.message || '');
  return !!(error && error.auth) || /HTML|Unauthorized|401|403|crumb|consent/i.test(message);
}

function mergeCookies(previous, setCookie) {
  const jar = new Map();
  String(previous || '').split(';').forEach((part) => {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq > 0) jar.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  });
  const list = Array.isArray(setCookie) ? setCookie : (setCookie ? [setCookie] : []);
  list.forEach((cookie) => {
    const pair = String(cookie).split(';')[0];
    const eq = pair.indexOf('=');
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  });
  return Array.from(jar.entries()).map(([key, value]) => key + '=' + value).join('; ');
}

function requestRaw(urlString, headers, redirectsLeft) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(urlString); } catch (error) { reject(error); return; }
    const reqHeaders = {
      'User-Agent': BROWSER_UA,
      Accept: 'application/json,text/plain,*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache'
    };
    Object.keys(headers || {}).forEach((key) => { reqHeaders[key] = headers[key]; });
    const req = https.request({
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: reqHeaders
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const status = res.statusCode || 0;
        const cookie = mergeCookies(headers && headers.Cookie, res.headers['set-cookie']);
        const location = res.headers.location;
        if ([301, 302, 303, 307, 308].includes(status) && location && redirectsLeft > 0) {
          const nextHeaders = Object.assign({}, headers);
          if (cookie) nextHeaders.Cookie = cookie;
          resolve(requestRaw(new URL(location, urlString).toString(), nextHeaders, redirectsLeft - 1));
          return;
        }
        let decoded;
        try {
          decoded = decodeHttpBody(Buffer.concat(chunks), res.headers['content-encoding']);
        } catch (error) {
          const err = new Error('Could not decompress price feed');
          err.hard = true;
          reject(err);
          return;
        }
        resolve({ status, text: decoded.toString('utf8'), cookie });
      });
    });
    req.on('error', (error) => {
      const err = new Error(error.message || 'Price feed request failed');
      err.hard = true;
      reject(err);
    });
    req.setTimeout(12000, () => {
      req.destroy();
      const err = new Error('Price feed timeout');
      err.hard = true;
      reject(err);
    });
    req.end();
  });
}

async function readFeed(url, fetchImpl, extraHeaders) {
  if (fetchImpl) {
    const res = await fetchImpl(url, extraHeaders);
    if (!res) {
      const err = new Error('Empty price feed response');
      err.hard = true;
      throw err;
    }
    if (typeof res.body === 'string') return { status: res.status || 200, text: res.body, cookie: res.cookie || '' };
    if (Buffer.isBuffer(res.body)) {
      const text = decodeHttpBody(res.body, res.encoding || '').toString('utf8');
      return { status: res.status || 200, text, cookie: res.cookie || '' };
    }
    return { status: res.status || 200, text: '', json: res.body, cookie: res.cookie || '' };
  }
  return requestRaw(url, extraHeaders || {}, 4);
}

function asJson(res, label) {
  if (res.status === 429 || res.status === 403 || res.status === 401) {
    const err = new Error(label + ' ' + res.status);
    err.hard = true;
    err.auth = res.status === 401 || res.status === 403;
    throw err;
  }
  if (res.json !== undefined) {
    if (res.status && res.status !== 200) {
      const err = new Error(label + ' ' + res.status);
      err.hard = true;
      throw err;
    }
    return res.json;
  }
  const text = String(res.text || '').replace(/^\uFEFF/, '').trim();
  if (!text) {
    const err = new Error(label + ' ' + res.status + ' returned an empty body');
    err.hard = true;
    throw err;
  }
  if (text.charAt(0) === '<' || /^<!doctype/i.test(text)) {
    const err = new Error(label + ' ' + res.status + ' returned HTML instead of data');
    err.hard = true;
    throw err;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    const err = new Error(label + ' ' + res.status + ' was not JSON');
    err.hard = true;
    throw err;
  }
}

function parseYahooChart(body) {
  const result = body && body.chart && body.chart.result && body.chart.result[0];
  if (!result || !result.timestamp || !result.indicators || !result.indicators.quote) return [];
  const quote = result.indicators.quote[0] || {};
  const candles = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    const o = quote.open && quote.open[i];
    const h = quote.high && quote.high[i];
    const l = quote.low && quote.low[i];
    const c = quote.close && quote.close[i];
    if (![o, h, l, c].every((n) => typeof n === 'number' && Number.isFinite(n))) continue;
    candles.push({ t: new Date(result.timestamp[i] * 1000).toISOString(), o, h, l, c });
  }
  return candles;
}

function candlesFromYahoo(body, symbol) {
  if (body && body.chart && body.chart.error) {
    const code = String(body.chart.error.code || '');
    const desc = body.chart.error.description || code || 'chart error';
    const err = new Error('Yahoo ' + desc);
    err.auth = /unauthor|crumb|forbidden/i.test(code + ' ' + desc);
    err.hard = err.auth || /invalid|not found/i.test(code + ' ' + desc);
    throw err;
  }
  const candles = parseYahooChart(body);
  if (!candles.length) {
    const err = new Error('Yahoo returned no candles for ' + symbol);
    err.hard = false;
    throw err;
  }
  return candles;
}

function parseTwelveSeries(body) {
  const values = body && Array.isArray(body.values) ? body.values : [];
  const candles = [];
  for (const row of values) {
    const o = Number(row.open);
    const h = Number(row.high);
    const l = Number(row.low);
    const c = Number(row.close);
    if (![o, h, l, c].every((n) => Number.isFinite(n))) continue;
    const stamp = row.datetime ? new Date(String(row.datetime).replace(' ', 'T') + 'Z') : null;
    if (!stamp || Number.isNaN(stamp.getTime())) continue;
    candles.push({ t: stamp.toISOString(), o, h, l, c });
  }
  candles.sort((a, b) => new Date(a.t) - new Date(b.t));
  return candles;
}

function parseKrakenOhlc(body) {
  const result = body && body.result;
  if (!result || typeof result !== 'object') return [];
  const key = Object.keys(result).find((name) => name !== 'last' && Array.isArray(result[name]));
  if (!key) return [];
  const candles = [];
  for (const row of result[key]) {
    if (!Array.isArray(row) || row.length < 5) continue;
    const t = Number(row[0]);
    const o = Number(row[1]);
    const h = Number(row[2]);
    const l = Number(row[3]);
    const c = Number(row[4]);
    if (![t, o, h, l, c].every((n) => Number.isFinite(n))) continue;
    candles.push({ t: new Date(t * 1000).toISOString(), o, h, l, c });
  }
  candles.sort((a, b) => new Date(a.t) - new Date(b.t));
  return candles;
}

function crossMultiply(base, quote) {
  const map = new Map((quote || []).map((candle) => [candle.t, candle]));
  const out = [];
  for (const row of base || []) {
    const other = map.get(row.t);
    if (!other) continue;
    const products = [row.o * other.o, row.h * other.h, row.l * other.l, row.c * other.c, row.h * other.l, row.l * other.h];
    if (!products.every((n) => Number.isFinite(n))) continue;
    out.push({
      t: row.t,
      o: row.o * other.o,
      c: row.c * other.c,
      h: Math.max.apply(null, products),
      l: Math.min.apply(null, products)
    });
  }
  return out;
}

async function mapPool(items, limit, fn) {
  const ret = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      ret[idx] = await fn(items[idx], idx);
    }
  }
  const n = Math.max(1, Math.min(limit || 4, items.length || 1));
  await Promise.all(Array.from({ length: n }, worker));
  return ret;
}

function cacheTtl() {
  return Number(process.env.SIGNAL_CANDLE_CACHE_MS) || 10 * 60 * 1000;
}

async function cached(key, force, ttl, loader) {
  const hit = candleCache.get(key);
  if (!force && hit && hit.ok && Date.now() - hit.at < ttl) return hit.value;
  if (!force && hit && hit.ok === false && Date.now() - hit.at < NEGATIVE_MS) throw hit.error;
  try {
    const value = await loader();
    candleCache.set(key, { at: Date.now(), ok: true, value });
    return value;
  } catch (error) {
    if (hit && hit.ok && Date.now() - hit.at < STALE_MS) {
      return Object.assign({}, hit.value, { stale: true });
    }
    candleCache.set(key, { at: Date.now(), ok: false, error });
    throw error;
  }
}

function krakenSlot(work, live) {
  if (!live) return work();
  const run = krakenTail.then(work, work);
  krakenTail = run.then(() => new Promise((resolve) => setTimeout(resolve, 160)), () => new Promise((resolve) => setTimeout(resolve, 160)));
  return run;
}

async function loadCrumb(fetchImpl) {
  const home = await readFeed('https://fc.yahoo.com', fetchImpl);
  const cookie = home.cookie || '';
  const crumbRes = await readFeed(
    'https://query1.finance.yahoo.com/v1/test/getcrumb',
    fetchImpl,
    cookie ? { Cookie: cookie } : {}
  );
  const text = String(crumbRes.text || '').trim();
  if (!text || text.charAt(0) === '<' || text.length > 64 || /\s/.test(text)) {
    const err = new Error('Yahoo crumb unavailable');
    err.hard = true;
    throw err;
  }
  yahooCrumb = { crumb: text, cookie, at: Date.now() };
  return yahooCrumb;
}

function yahooAuth(fetchImpl) {
  if (yahooCrumb && Date.now() - yahooCrumb.at < 30 * 60 * 1000) return Promise.resolve(yahooCrumb);
  if (crumbFailedAt && Date.now() - crumbFailedAt < 60 * 1000) {
    const err = new Error('Yahoo crumb unavailable');
    err.hard = true;
    return Promise.reject(err);
  }
  if (!crumbInflight) {
    crumbInflight = loadCrumb(fetchImpl).catch((error) => {
      crumbFailedAt = Date.now();
      throw error;
    }).finally(() => { crumbInflight = null; });
  }
  return crumbInflight;
}

async function yahooOnce(host, symbol, interval, range, fetchImpl, auth) {
  let url = 'https://' + host + '/v8/finance/chart/' + encodeURIComponent(symbol) +
    '?interval=' + encodeURIComponent(interval) + '&range=' + encodeURIComponent(range);
  const headers = {};
  if (auth && auth.crumb) {
    url += '&crumb=' + encodeURIComponent(auth.crumb);
    if (auth.cookie) headers.Cookie = auth.cookie;
  }
  const res = await readFeed(url, fetchImpl, headers);
  return candlesFromYahoo(asJson(res, 'Yahoo ' + host), symbol);
}

async function fetchYahoo(symbol, interval, range, fetchImpl) {
  let last = null;
  for (const host of YAHOO_HOSTS) {
    try {
      return await yahooOnce(host, symbol, interval, range, fetchImpl, null);
    } catch (error) {
      last = error;
      if (shouldTryCrumb(error)) {
        try {
          const auth = await yahooAuth(fetchImpl);
          return await yahooOnce(host, symbol, interval, range, fetchImpl, auth);
        } catch (crumbError) {
          last = crumbError && crumbError.message === 'Yahoo crumb unavailable' ? error : (crumbError || error);
        }
      }
    }
  }
  if (last && isHardFailure(last)) last.hard = true;
  throw last || Object.assign(new Error('Yahoo chart failed'), { hard: true });
}

async function fetchTwelve(symbol, interval, outputsize, fetchImpl) {
  const key = String(process.env.TWELVE_DATA_API_KEY || '').trim();
  if (!key) throw new Error('Twelve Data key not set');
  const url = 'https://api.twelvedata.com/time_series?symbol=' + encodeURIComponent(symbol) +
    '&interval=' + encodeURIComponent(interval) + '&outputsize=' + outputsize +
    '&apikey=' + encodeURIComponent(key);
  const res = await readFeed(url, fetchImpl);
  const body = asJson(res, 'Twelve Data');
  if (!res || res.status !== 200 || (body && body.status === 'error')) {
    const err = new Error((body && body.message) || 'Twelve Data request failed');
    err.hard = false;
    throw err;
  }
  const candles = parseTwelveSeries(body);
  if (!candles.length) {
    const err = new Error('Twelve Data returned no candles for ' + symbol);
    err.hard = false;
    throw err;
  }
  return candles;
}

async function fetchKraken(pair, interval, fetchImpl) {
  return cached('kraken:' + pair + ':' + interval, false, cacheTtl(), () => krakenSlot(async () => {
    const url = 'https://api.kraken.com/0/public/OHLC?pair=' + encodeURIComponent(pair) + '&interval=' + interval;
    const res = await readFeed(url, fetchImpl);
    const body = asJson(res, 'Kraken');
    if (body && Array.isArray(body.error) && body.error.length) {
      const err = new Error('Kraken ' + body.error[0]);
      err.hard = true;
      throw err;
    }
    const candles = parseKrakenOhlc(body);
    if (candles.length < 30) {
      const err = new Error('Kraken returned too few candles for ' + pair);
      err.hard = true;
      throw err;
    }
    return candles;
  }, !fetchImpl));
}

async function loadInstrument(instrument, options) {
  const opts = options || {};
  const ttl = cacheTtl();
  const force = !!opts.force;
  const useTwelve = !!String(process.env.TWELVE_DATA_API_KEY || '').trim();
  const errors = [];

  async function loadSide(side) {
    const cacheKey = instrument.id + ':' + side + ':' + (useTwelve ? 'td' : 'yh');
    return cached(cacheKey, force, ttl, async () => {
      if (useTwelve) {
        try {
          const candles = await fetchTwelve(
            instrument.twelve,
            side === 'h1' ? '1h' : '1day',
            side === 'h1' ? 500 : 400,
            opts.fetchImpl
          );
          return { candles, source: 'Twelve Data', feed: instrument.twelve, note: null, stale: false };
        } catch (error) {
          pushError(errors, error);
        }
      }
      const ranges = side === 'h1' ? ['60d', '30d', '5d'] : ['2y', '1y', '6mo'];
      const interval = side === 'h1' ? '1h' : '1d';
      let lastError = null;
      for (const range of ranges) {
        try {
          const candles = await fetchYahoo(instrument.yahoo, interval, range, opts.fetchImpl);
          return { candles, source: 'Yahoo Finance', feed: instrument.yahoo, note: null, stale: false };
        } catch (error) {
          lastError = error;
          if (isHardFailure(error)) break;
        }
      }
      if (lastError) pushError(errors, lastError);
      if (instrument.kraken) {
        try {
          const candles = await fetchKraken(instrument.kraken, side === 'h1' ? 60 : 1440, opts.fetchImpl);
          return {
            candles,
            source: 'Kraken',
            feed: instrument.kraken,
            note: instrument.krakenNote || null,
            stale: false
          };
        } catch (error) {
          pushError(errors, error);
        }
      }
      if (instrument.krakenCross) {
        try {
          const step = side === 'h1' ? 60 : 1440;
          const base = await fetchKraken('GBPUSD', step, opts.fetchImpl);
          const quote = await fetchKraken('USDJPY', step, opts.fetchImpl);
          const candles = crossMultiply(base, quote);
          if (candles.length < 30) throw new Error('GBP/JPY cross has too few aligned candles');
          return {
            candles,
            source: 'Kraken cross',
            feed: 'GBPUSD*USDJPY',
            note: 'GBP/JPY is built from the GBP/USD and USD/JPY cross',
            stale: false
          };
        } catch (error) {
          pushError(errors, error);
        }
      }
      throw lastError || new Error('No candles for ' + instrument.id);
    });
  }

  const [h1Result, d1Result] = await Promise.all([
    loadSide('h1').catch((error) => { pushError(errors, error); return null; }),
    loadSide('d1').catch((error) => { pushError(errors, error); return null; })
  ]);
  const sources = [];
  [h1Result, d1Result].forEach((side) => {
    if (side && side.source && !sources.includes(side.source)) sources.push(side.source);
  });
  const notes = [];
  if (h1Result && h1Result.note) notes.push(h1Result.note);
  else if (instrument.feedNote) notes.push(instrument.feedNote);
  if (d1Result && d1Result.note && !notes.includes(d1Result.note)) notes.push(d1Result.note);
  return {
    instrument,
    h1: (h1Result && h1Result.candles) || [],
    d1: (d1Result && d1Result.candles) || [],
    source: sources.length ? sources.join(' + ') : null,
    feed: (h1Result && h1Result.feed) || instrument.yahoo,
    feed_note: notes.length ? notes.join(' · ') : null,
    stale: !!((h1Result && h1Result.stale) || (d1Result && d1Result.stale)),
    errors
  };
}

async function loadAll(options) {
  const opts = options || {};
  const wanted = opts.symbols
    ? INSTRUMENTS.filter((instrument) => opts.symbols.includes(instrument.id))
    : INSTRUMENTS.slice();
  return mapPool(wanted, opts.concurrency || 4, (instrument) => loadInstrument(instrument, opts));
}

function clearCache() {
  candleCache.clear();
  yahooCrumb = null;
  crumbFailedAt = 0;
  crumbInflight = null;
}

module.exports = {
  INSTRUMENTS,
  parseYahooChart,
  parseTwelveSeries,
  parseKrakenOhlc,
  decodeHttpBody,
  crossMultiply,
  loadInstrument,
  loadAll,
  clearCache
};
