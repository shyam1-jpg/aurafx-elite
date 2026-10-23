'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const math = require('./signal-math');
const trackerMod = require('./signal-tracker');
const candles = require('./market-candles');
const rationale = require('./signal-rationale');
const signalService = require('./signal-service');
const { backtestInstrument } = require('./signal-backtest');

const EUR = { id: 'EURUSD', name: 'EUR/USD', asset: 'forex' };
const XAU = { id: 'XAUUSD', name: 'Gold', asset: 'metal' };

function hourly(n, startPrice, stepFn, origin) {
  const candlesH = [];
  let price = startPrice;
  for (let i = 0; i < n; i++) {
    const delta = stepFn(i, price);
    const o = price;
    const c = Math.max(0.0001, price + delta);
    const wick = Math.abs(startPrice) * 0.00012 + (i % 7) * Math.abs(startPrice) * 0.00003;
    candlesH.push({
      t: new Date(origin + i * 3600000).toISOString(),
      o,
      h: Math.max(o, c) + wick,
      l: Math.min(o, c) - wick * 0.85,
      c
    });
    price = c;
  }
  return candlesH;
}

function daily(n, startPrice, drift, origin) {
  const rows = [];
  let price = startPrice;
  for (let i = 0; i < n; i++) {
    const o = price;
    const c = price * (1 + drift);
    rows.push({
      t: new Date(origin + i * 86400000).toISOString(),
      o,
      h: Math.max(o, c) * 1.001,
      l: Math.min(o, c) * 0.999,
      c
    });
    price = c;
  }
  return rows;
}

function trendStep(sign) {
  return function step(i) {
    const cycle = i % 16;
    if (cycle < 8) return sign * 0.00018;
    return -sign * 0.00011;
  };
}

function findPublished(instrument, h1, d1, action) {
  const hits = [];
  for (let i = 240; i < h1.length; i++) {
    const now = new Date(h1[i].t);
    const setup = math.assessSetup(instrument, { h1: h1.slice(0, i + 1), d1 }, { now, newsImminent: false });
    if (setup.action === action) hits.push({ i, setup });
  }
  return hits;
}

function dump(setup) {
  return JSON.stringify({
    action: setup.action,
    confidence: setup.confidence,
    blockers: setup.blockers,
    factors: (setup.factors || []).map((f) => f.key + ':' + f.state + ' ' + f.note),
    history: setup.history,
    levels: [setup.entry, setup.stop_loss, setup.take_profit_1, setup.risk_reward]
  }, null, 2);
}

const upDaily = daily(120, 1.05, 0.0012, Date.UTC(2025, 5, 1));
const upH1 = hourly(420, upDaily[upDaily.length - 1].c, trendStep(1), Date.UTC(2026, 0, 5, 8));
const upHits = findPublished(EUR, upH1, upDaily, 'BUY');
assert.ok(upHits.length > 0, 'uptrend should publish at least one BUY\n' + dump(math.assessSetup(EUR, { h1: upH1, d1: upDaily }, { now: new Date(upH1[upH1.length - 1].t) })));

const buy = upHits[0].setup;
assert.ok(buy.stop_loss < buy.entry && buy.entry < buy.take_profit_1, 'BUY levels stack entry above stop and below target');
if (buy.take_profit_2 != null) assert.ok(buy.take_profit_2 > buy.take_profit_1);
assert.ok(buy.risk_reward >= 1.8);
assert.ok(buy.confidence >= 74 && buy.confidence <= 92);
assert.strictEqual(buy.disclaimer, math.DISCLAIMER);
assert.ok(!/guarant|80%|90%|accurate/i.test(buy.rationale || ''), 'engine payload has no rationale yet');
assert.ok(!JSON.stringify(buy).includes('80% accurate'));

const blocked = math.assessSetup(EUR, { h1: upH1.slice(0, upHits[0].i + 1), d1: upDaily }, {
  now: new Date(upH1[upHits[0].i].t),
  newsImminent: true,
  newsCurrency: 'USD',
  newsTitle: 'US CPI'
});
assert.strictEqual(blocked.action, 'WAIT');
assert.ok(blocked.blockers.some((b) => /news/i.test(b)));
assert.strictEqual(blocked.entry, null);

const saturday = math.assessSetup(EUR, { h1: upH1.slice(0, upHits[0].i + 1), d1: upDaily }, {
  now: new Date(Date.UTC(2026, 0, 10, 12, 0, 0))
});
assert.strictEqual(saturday.action, 'WAIT');
assert.ok(saturday.blockers.some((b) => /closed/i.test(b)));

const downDaily = daily(120, 1.3, -0.0012, Date.UTC(2025, 5, 1));
const downH1 = hourly(420, downDaily[downDaily.length - 1].c, trendStep(-1), Date.UTC(2026, 0, 5, 8));
const downHits = findPublished(EUR, downH1, downDaily, 'SELL');
assert.ok(downHits.length > 0, 'downtrend should publish at least one SELL\n' + dump(math.assessSetup(EUR, { h1: downH1, d1: downDaily }, { now: new Date(downH1[downH1.length - 1].t) })));
const sell = downHits[0].setup;
assert.ok(sell.stop_loss > sell.entry && sell.entry > sell.take_profit_1);

const flatDaily = daily(120, 1.1, 0.00001, Date.UTC(2025, 5, 1));
const flatH1 = hourly(420, 1.1, (i) => Math.sin(i / 2) * 0.00005, Date.UTC(2026, 0, 5, 8));
const flatBuy = findPublished(EUR, flatH1, flatDaily, 'BUY');
const flatSell = findPublished(EUR, flatH1, flatDaily, 'SELL');
assert.strictEqual(flatBuy.length, 0, 'chop must not publish BUY');
assert.strictEqual(flatSell.length, 0, 'chop must not publish SELL');

const goldNews = math.assessSetup(XAU, { h1: upH1, d1: upDaily }, {
  now: new Date(upH1[upH1.length - 1].t),
  newsImminent: true,
  newsCurrency: 'EUR',
  newsTitle: 'Euro CPI'
});
assert.ok(!goldNews.blockers.some((b) => /news/i.test(b)), 'non-USD news does not block gold');

const both = { t: '2026-01-06T12:00:00Z', o: 1.1, h: 1.3, l: 0.9, c: 1.1 };
assert.strictEqual(math.barOutcome({
  action: 'BUY', entry: 1.1, stop_loss: 1.0, take_profit_1: 1.25, take_profit_2: 1.4
}, both).status, 'sl');
assert.strictEqual(math.barOutcome({
  action: 'BUY', entry: 1.1, stop_loss: 1.0, take_profit_1: 1.2, take_profit_2: 1.3
}, { t: '2026-01-06T12:00:00Z', o: 1.1, h: 1.21, l: 1.05, c: 1.2 }).status, 'tp');

const flatEma = math.ema([2, 2, 2, 2, 2], 3);
assert.ok(Math.abs(flatEma[4] - 2) < 1e-9);

const parsed = candles.parseYahooChart({
  chart: {
    result: [{
      timestamp: [1700000000],
      indicators: { quote: [{ open: [1.1], high: [1.2], low: [1.0], close: [1.15] }] }
    }]
  }
});
assert.strictEqual(parsed.length, 1);
assert.strictEqual(parsed[0].c, 1.15);
assert.strictEqual(candles.parseYahooChart({ chart: { result: null } }).length, 0);

assert.strictEqual(rationale.acceptableRationale('This setup is guaranteed 90% accurate and always profit.'), false);
assert.strictEqual(rationale.acceptableRationale('Wait on EUR/USD until the hourly trend and the daily trend agree. No trade is published.'), true);

(async () => {
  const file = path.join(os.tmpdir(), 'aurafx-signal-test-' + Date.now() + '.json');
  const tracker = trackerMod.createTracker({ file, disableNeon: true });
  const setup = {
    instrument: 'EURUSD',
    name: 'EUR/USD',
    published: true,
    action: 'BUY',
    confidence: 82,
    entry: 1.1,
    stop_loss: 1.0,
    take_profit_1: 1.3,
    take_profit_2: 1.4,
    risk_reward: 2
  };
  const t0 = new Date('2026-03-02T12:00:00Z');
  const first = await tracker.sync([setup], { EURUSD: [] }, t0);
  assert.strictEqual(first.measured.open, 1);
  const second = await tracker.sync([setup], { EURUSD: [] }, new Date('2026-03-02T13:00:00Z'));
  assert.strictEqual(second.logged, 1, 'open signal is not duplicated');

  const hit = await tracker.sync([setup], {
    EURUSD: [{ t: '2026-03-02T14:00:00Z', o: 1.1, h: 1.31, l: 1.08, c: 1.2 }]
  }, new Date('2026-03-02T15:00:00Z'));
  assert.strictEqual(hit.measured.wins, 1);
  assert.strictEqual(hit.measured.resolved, 1);
  assert.strictEqual(hit.measured.win_rate, 1);
  assert.ok(hit.history[0].status === 'tp');
  assert.ok(/not a forecast/i.test(hit.measured.win_rate_basis));
  assert.strictEqual(hit.logged, 1, 'cooldown blocks an immediate re-entry');

  const slTracker = trackerMod.createTracker({ file: file + '.sl', disableNeon: true });
  const slSetup = { ...setup, instrument: 'GBPUSD', take_profit_1: 1.4, take_profit_2: 1.5 };
  await slTracker.sync([slSetup], { GBPUSD: [] }, t0);
  const sl = await slTracker.sync([slSetup], {
    GBPUSD: [{ t: '2026-03-02T16:00:00Z', o: 1.1, h: 1.15, l: 0.99, c: 1.0 }]
  }, new Date('2026-03-02T17:00:00Z'));
  assert.strictEqual(sl.measured.losses, 1);
  assert.strictEqual(sl.measured.win_rate, 0);

  const previousProvider = process.env.AI_RATIONALE_PROVIDER;
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.AI_RATIONALE_PROVIDER = 'openai';
  process.env.OPENAI_API_KEY = 'test-key';
  const llmSetup = {
    action: 'BUY',
    instrument: 'EURUSD',
    name: 'EUR/USD',
    entry: 1.1,
    stop_loss: 1.0,
    take_profit_1: 1.3,
    take_profit_2: null,
    risk_reward: 2,
    factors: [{ key: 'trend', state: 'bullish', note: 'Hourly trend is up.' }],
    blockers: []
  };
  await rationale.applyRationales([llmSetup], {
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ output_text: 'Guaranteed 90% accurate. This will always profit.' })
    })
  });
  assert.strictEqual(llmSetup.action, 'BUY');
  assert.strictEqual(llmSetup.rationale_source, 'engine');
  assert.ok(!/guarant/i.test(llmSetup.rationale));

  const clean = { ...llmSetup, rationale: undefined, rationale_source: undefined };
  await rationale.applyRationales([clean], {
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        output_text: 'Buy bias on EUR/USD while trend and higher timeframes agree. Levels stay with the calculated stop and target. This is analysis, not a promise.'
      })
    })
  });
  assert.strictEqual(clean.action, 'BUY');
  assert.strictEqual(clean.entry, 1.1);
  assert.strictEqual(clean.rationale_source, 'openai');

  if (previousProvider === undefined) delete process.env.AI_RATIONALE_PROVIDER;
  else process.env.AI_RATIONALE_PROVIDER = previousProvider;
  if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousKey;

  const bt = backtestInstrument(EUR, upH1, upDaily);
  assert.ok(bt.trade_count >= 1, 'backtest should record the published uptrend signal');
  assert.ok(bt.measured.win_rate === null || (bt.measured.win_rate >= 0 && bt.measured.win_rate <= 1));
  assert.ok(/not a forecast/i.test(bt.measured.win_rate_basis));

  fs.rmSync(file, { force: true });
  fs.rmSync(file + '.sl', { force: true });

  const gzipPayload = Buffer.from(JSON.stringify({ ok: true, n: 3 }));
  const gzipped = zlib.gzipSync(gzipPayload);
  assert.strictEqual(JSON.parse(candles.decodeHttpBody(gzipped, 'gzip').toString('utf8')).n, 3);
  assert.strictEqual(JSON.parse(candles.decodeHttpBody(gzipped, '').toString('utf8')).n, 3);

  function yahooBars(count) {
    const timestamp = [];
    const open = [];
    const high = [];
    const low = [];
    const close = [];
    for (let i = 0; i < count; i++) {
      timestamp.push(1700000000 + i * 3600);
      open.push(1.1);
      high.push(1.12);
      low.push(1.08);
      close.push(1.11);
    }
    return { chart: { result: [{ timestamp, indicators: { quote: [{ open, high, low, close }] } }] } };
  }

  function krakenBars(count, start, step) {
    const rows = [];
    let price = start;
    for (let i = 0; i < count; i++) {
      const open = price;
      const close = price + start * 0.0001;
      rows.push([1700000000 + i * step, String(open), String(open + 0.001), String(Math.max(0.0001, open - 0.001)), String(close), '0', '1', 1]);
      price = close;
    }
    return { error: [], result: { PAIR: rows, last: rows[rows.length - 1][0] } };
  }

  const previousTwelve = process.env.TWELVE_DATA_API_KEY;
  delete process.env.TWELVE_DATA_API_KEY;
  const nzd = candles.INSTRUMENTS.find((row) => row.id === 'NZDUSD');
  const eur = candles.INSTRUMENTS.find((row) => row.id === 'EURUSD');
  const gbpjpy = candles.INSTRUMENTS.find((row) => row.id === 'GBPJPY');
  const gzChart = zlib.gzipSync(Buffer.from(JSON.stringify(yahooBars(90))));
  candles.clearCache();
  const decodedFeed = await candles.loadInstrument(nzd, {
    force: true,
    fetchImpl: async () => ({ status: 200, body: gzChart, encoding: 'gzip' })
  });
  assert.strictEqual(decodedFeed.source, 'Yahoo Finance');
  assert.ok(decodedFeed.h1.length >= 80, 'gzip chart body should decode to candles');

  candles.clearCache();
  const krakenFeed = await candles.loadInstrument(eur, {
    force: true,
    fetchImpl: async (url) => {
      const target = String(url);
      if (target.includes('api.kraken.com')) {
        const step = target.includes('interval=1440') ? 86400 : 3600;
        return { status: 200, body: krakenBars(90, 1.1, step) };
      }
      return { status: 200, body: '<!DOCTYPE html><html>consent</html>' };
    }
  });
  assert.strictEqual(krakenFeed.source, 'Kraken');
  assert.strictEqual(krakenFeed.feed, 'EURUSD');
  assert.ok(krakenFeed.h1.length >= 80, 'Kraken fallback should fill hourly history');
  assert.ok(krakenFeed.errors.some((message) => /HTML/i.test(message)));

  candles.clearCache();
  const cross = candles.crossMultiply(
    [{ t: '2026-01-01T00:00:00.000Z', o: 1.2, h: 1.3, l: 1.1, c: 1.25 }],
    [{ t: '2026-01-01T00:00:00.000Z', o: 150, h: 151, l: 149, c: 150.5 }]
  );
  assert.strictEqual(cross.length, 1);
  assert.ok(Math.abs(cross[0].c - 1.25 * 150.5) < 1e-9);
  const crossFeed = await candles.loadInstrument(gbpjpy, {
    force: true,
    fetchImpl: async (url) => {
      const target = String(url);
      if (!target.includes('api.kraken.com')) return { status: 200, body: '<html>blocked</html>' };
      const step = target.includes('interval=1440') ? 86400 : 3600;
      const start = target.includes('pair=USDJPY') ? 150 : 1.25;
      return { status: 200, body: krakenBars(90, start, step) };
    }
  });
  assert.strictEqual(crossFeed.source, 'Kraken cross');
  assert.ok(crossFeed.h1.length >= 80);
  assert.ok(/cross/i.test(crossFeed.feed_note));

  process.env.TWELVE_DATA_API_KEY = 'unit-test-key';
  candles.clearCache();
  const twelveFallback = await candles.loadInstrument(eur, {
    force: true,
    fetchImpl: async (url) => {
      const target = String(url);
      if (target.includes('twelvedata.com')) return { status: 200, body: { status: 'error', message: 'apikey=unit-test-key was rejected' } };
      if (target.includes('api.kraken.com')) {
        const step = target.includes('interval=1440') ? 86400 : 3600;
        return { status: 200, body: krakenBars(90, 1.1, step) };
      }
      return { status: 200, body: '<html>blocked</html>' };
    }
  });
  assert.strictEqual(twelveFallback.source, 'Kraken');
  assert.ok(!twelveFallback.errors.join(' ').includes('unit-test-key'));
  if (previousTwelve === undefined) delete process.env.TWELVE_DATA_API_KEY;
  else process.env.TWELVE_DATA_API_KEY = previousTwelve;

  candles.clearCache();
  let yahooPhase = 'ok';
  const staleFeedImpl = async (url) => {
    if (yahooPhase === 'ok' && String(url).includes('/v8/finance/chart/')) return { status: 200, body: yahooBars(90) };
    return { status: 200, body: '<html>blocked</html>' };
  };
  const freshNzd = await candles.loadInstrument(nzd, { force: true, fetchImpl: staleFeedImpl });
  assert.strictEqual(freshNzd.stale, false);
  yahooPhase = 'down';
  const staleNzd = await candles.loadInstrument(nzd, { force: true, fetchImpl: staleFeedImpl });
  assert.strictEqual(staleNzd.stale, true);
  assert.ok(staleNzd.h1.length >= 80, 'last good candles stay available for six hours');
  candles.clearCache();

  const down = signalService.describeFeed([{ h1: [], errors: ['Yahoo query1 200 returned HTML instead of data'] }]);
  assert.strictEqual(down.status, 'down');
  assert.ok(/Price history is down/.test(down.detail));
  const degraded = signalService.describeFeed([
    { h1: new Array(80), source: 'Kraken' },
    { h1: [], errors: ['Yahoo returned no candles'] }
  ]);
  assert.strictEqual(degraded.status, 'degraded');
  const stale = signalService.describeFeed([
    { h1: new Array(80), stale: true, source: 'Yahoo Finance' },
    { h1: new Array(80), stale: true, source: 'Yahoo Finance' }
  ]);
  assert.strictEqual(stale.status, 'stale');
  const live = signalService.describeFeed([{ h1: new Array(80), source: 'Yahoo Finance' }]);
  assert.strictEqual(live.status, 'live');

  console.log('Signal engine tests passed. Sample BUY confidence ' + buy.confidence + ', backtest trades ' + bt.trade_count + ', measured win rate ' + bt.measured.win_rate + ' on ' + bt.measured.resolved + ' resolved.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
