'use strict';

const https = require('https');

/**
 * Candle source for the signal engine.
 * Default: Yahoo Finance chart API (no key).
 * Optional: Twelve Data when TWELVE_DATA_API_KEY is set. Keys stay in the environment.
 */

const INSTRUMENTS = [
  { id: 'EURUSD', name: 'EUR/USD', asset: 'forex', yahoo: 'EURUSD=X', twelve: 'EUR/USD' },
  { id: 'GBPUSD', name: 'GBP/USD', asset: 'forex', yahoo: 'GBPUSD=X', twelve: 'GBP/USD' },
  { id: 'USDJPY', name: 'USD/JPY', asset: 'forex', yahoo: 'USDJPY=X', twelve: 'USD/JPY' },
  { id: 'USDCHF', name: 'USD/CHF', asset: 'forex', yahoo: 'USDCHF=X', twelve: 'USD/CHF' },
  { id: 'AUDUSD', name: 'AUD/USD', asset: 'forex', yahoo: 'AUDUSD=X', twelve: 'AUD/USD' },
  { id: 'NZDUSD', name: 'NZD/USD', asset: 'forex', yahoo: 'NZDUSD=X', twelve: 'NZD/USD' },
  { id: 'USDCAD', name: 'USD/CAD', asset: 'forex', yahoo: 'USDCAD=X', twelve: 'USD/CAD' },
  { id: 'EURJPY', name: 'EUR/JPY', asset: 'forex', yahoo: 'EURJPY=X', twelve: 'EUR/JPY' },
  { id: 'GBPJPY', name: 'GBP/JPY', asset: 'forex', yahoo: 'GBPJPY=X', twelve: 'GBP/JPY' },
  { id: 'XAUUSD', name: 'Gold', asset: 'metal', yahoo: 'GC=F', twelve: 'XAU/USD', feedNote: 'COMEX gold futures' },
  { id: 'XAGUSD', name: 'Silver', asset: 'metal', yahoo: 'SI=F', twelve: 'XAG/USD', feedNote: 'COMEX silver futures' },
  { id: 'USOIL', name: 'WTI Crude', asset: 'commodity', yahoo: 'CL=F', twelve: 'WTI/USD', feedNote: 'NYMEX WTI futures' },
  { id: 'UKOIL', name: 'Brent Crude', asset: 'commodity', yahoo: 'BZ=F', twelve: 'BRENT/USD', feedNote: 'Brent futures' },
  { id: 'NATGAS', name: 'Natural Gas', asset: 'commodity', yahoo: 'NG=F', twelve: 'NG/USD', feedNote: 'NYMEX natural gas futures' },
  { id: 'COPPER', name: 'Copper', asset: 'commodity', yahoo: 'HG=F', twelve: 'XCU/USD', feedNote: 'COMEX copper futures' }
];

const candleCache = new Map();

function httpsGetJson(url, fetchImpl) {
  if (fetchImpl) return fetchImpl(url);
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'AuraFX-Elite/1.0', Accept: 'application/json' }
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch (error) {
          reject(new Error('Bad JSON from price feed'));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(12000, () => req.destroy(new Error('Price feed timeout')));
  });
}

function parseYahooChart(body) {
  const result = body && body.chart && body.chart.result && body.chart.result[0];
  if (!result || !result.timestamp || !result.indicators || !result.indicators.quote) return [];
  const q = result.indicators.quote[0] || {};
  const candles = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    const o = q.open && q.open[i];
    const h = q.high && q.high[i];
    const l = q.low && q.low[i];
    const c = q.close && q.close[i];
    if (![o, h, l, c].every((n) => typeof n === 'number' && Number.isFinite(n))) continue;
    candles.push({ t: new Date(result.timestamp[i] * 1000).toISOString(), o, h, l, c });
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
    const stamp = row.datetime ? new Date(row.datetime.replace(' ', 'T') + 'Z') : null;
    if (!stamp || Number.isNaN(stamp.getTime())) continue;
    candles.push({ t: stamp.toISOString(), o, h, l, c });
  }
  candles.sort((a, b) => new Date(a.t) - new Date(b.t));
  return candles;
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

async function cached(key, force, ttl, loader) {
  const hit = candleCache.get(key);
  if (!force && hit && Date.now() - hit.at < ttl) return hit.value;
  const value = await loader();
  candleCache.set(key, { at: Date.now(), value });
  return value;
}

async function fetchYahoo(symbol, interval, range, fetchImpl) {
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' +
    encodeURIComponent(symbol) + '?interval=' + interval + '&range=' + range;
  const res = await httpsGetJson(url, fetchImpl);
  if (!res || res.status !== 200) throw new Error('Yahoo chart ' + res.status);
  const candles = parseYahooChart(res.body);
  if (!candles.length) throw new Error('Yahoo returned no candles for ' + symbol);
  return candles;
}

async function fetchTwelve(symbol, interval, outputsize, fetchImpl) {
  const key = String(process.env.TWELVE_DATA_API_KEY || '').trim();
  if (!key) throw new Error('Twelve Data key not set');
  const url = 'https://api.twelvedata.com/time_series?symbol=' + encodeURIComponent(symbol) +
    '&interval=' + encodeURIComponent(interval) + '&outputsize=' + outputsize +
    '&apikey=' + encodeURIComponent(key);
  const res = await httpsGetJson(url, fetchImpl);
  if (!res || res.status !== 200 || (res.body && res.body.status === 'error')) {
    throw new Error((res && res.body && res.body.message) || 'Twelve Data request failed');
  }
  const candles = parseTwelveSeries(res.body);
  if (!candles.length) throw new Error('Twelve Data returned no candles for ' + symbol);
  return candles;
}

async function loadInstrument(instrument, options) {
  const opts = options || {};
  const ttl = Number(process.env.SIGNAL_CANDLE_CACHE_MS) || 10 * 60 * 1000;
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
          return { candles, source: 'Twelve Data', feed: instrument.twelve };
        } catch (error) {
          errors.push(error.message);
        }
      }
      const ranges = side === 'h1' ? ['60d', '30d', '5d'] : ['2y', '1y', '6mo'];
      const interval = side === 'h1' ? '1h' : '1d';
      let lastError = null;
      for (const range of ranges) {
        try {
          const candles = await fetchYahoo(instrument.yahoo, interval, range, opts.fetchImpl);
          return { candles, source: 'Yahoo Finance', feed: instrument.yahoo };
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError || new Error('No candles');
    });
  }

  try {
    const [h1, d1] = await Promise.all([loadSide('h1'), loadSide('d1')]);
    return {
      instrument,
      h1: h1.candles,
      d1: d1.candles,
      source: h1.source,
      feed: h1.feed,
      feed_note: instrument.feedNote || null,
      errors
    };
  } catch (error) {
    errors.push(error.message);
    return { instrument, h1: [], d1: [], source: null, feed: instrument.yahoo, feed_note: instrument.feedNote || null, errors };
  }
}

async function loadAll(options) {
  const opts = options || {};
  const wanted = opts.symbols
    ? INSTRUMENTS.filter((i) => opts.symbols.includes(i.id))
    : INSTRUMENTS.slice();
  const rows = await mapPool(wanted, opts.concurrency || 4, (instrument) => loadInstrument(instrument, opts));
  return rows;
}

function clearCache() {
  candleCache.clear();
}

module.exports = {
  INSTRUMENTS,
  parseYahooChart,
  parseTwelveSeries,
  loadInstrument,
  loadAll,
  clearCache
};
