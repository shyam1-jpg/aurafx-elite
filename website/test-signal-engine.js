'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const math = require('./signal-math');
const trackerMod = require('./signal-tracker');
const candles = require('./market-candles');
const position = require('./public/js/position-size');
const alertsMod = require('./signal-alerts');
const net = require('net');
const rationale = require('./signal-rationale');
const assistant = require('./signal-assistant');
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
assert.ok('rsi' in buy && 'atr' in buy && 'atr_ratio' in buy && 'support' in buy && 'resistance' in buy && 'trend' in buy && 'mtf' in buy);
assert.strictEqual(buy.action, 'BUY');
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

const flatRegime = math.detectRegime(flatH1);
let trendAdx = null;
for (let i = 240; i < upH1.length; i += 4) {
  const regime = math.detectRegime(upH1.slice(0, i + 1));
  if (regime.name === 'trending' && regime.adx >= 25) {
    trendAdx = regime.adx;
    break;
  }
}
assert.ok(trendAdx >= 25, 'a directional stretch should read trending with ADX at least 25');
assert.strictEqual(flatRegime.name, 'ranging', 'flat chop should read ranging, ADX ' + flatRegime.adx);
assert.ok(flatRegime.adx < 25, 'flat ADX should stay under 25');
assert.ok(buy.regime === 'trending' || buy.regime === 'ranging', 'a trend-rule buy keeps a regime chip');
assert.ok(buy.factors.some((factor) => factor.key === 'regime' && factor.state === buy.regime));
assert.ok(/trend/i.test(buy.regime_note));

const spike = upH1.slice(0, upHits[0].i + 1).map((bar) => Object.assign({}, bar));
const spikeAt = spike.length - 1;
const spiked = spike[spikeAt];
spike[spikeAt] = Object.assign({}, spiked, {
  h: Math.max(spiked.o, spiked.c) * 1.04,
  l: Math.min(spiked.o, spiked.c) * 0.995
});
const volatile = math.assessSetup(EUR, { h1: spike, d1: upDaily }, { now: new Date(spike[spike.length - 1].t) });
assert.strictEqual(volatile.regime, 'volatile', 'a wide bar should switch the regime to volatile');
assert.strictEqual(volatile.action, 'WAIT');
assert.strictEqual(volatile.entry, null);
assert.ok(volatile.blockers.some((line) => /too wide/i.test(line)));

function rangeBar(origin, i, o, c) {
  const wick = 0.00012;
  return {
    t: new Date(origin + i * 3600000).toISOString(),
    o,
    c,
    h: Math.max(o, c) + wick,
    l: Math.min(o, c) - wick
  };
}
const rangeOrigin = Date.UTC(2026, 0, 7, 13) - 345 * 3600000;
const rangeH1 = [];
let rangePrice = 1.1;
for (let i = 0; i < 40; i++) {
  const close = rangePrice + 0.00018;
  rangeH1.push(rangeBar(rangeOrigin, i, rangePrice, close));
  rangePrice = close;
}
for (let i = 40; i < 70; i++) {
  const close = rangePrice - 0.00012;
  rangeH1.push(rangeBar(rangeOrigin, i, rangePrice, close));
  rangePrice = close;
}
for (let i = 70; i < 340; i++) {
  const close = rangePrice + Math.sin(i) * 0.00022;
  rangeH1.push(rangeBar(rangeOrigin, i, rangePrice, close));
  rangePrice = close;
}
rangeH1.push(rangeBar(rangeOrigin, 340, rangePrice, rangePrice - 0.0011));
rangePrice = rangeH1[rangeH1.length - 1].c;
for (let k = 1; k <= 8; k++) {
  const close = rangePrice + 0.00005;
  rangeH1.push(rangeBar(rangeOrigin, 340 + k, rangePrice, close));
  rangePrice = close;
}
const rangeDaily = daily(100, 1.1, 0.00002, Date.UTC(2025, 6, 1));
function scaleCandles(rows, factor) {
  return rows.map((c) => ({ t: c.t, o: c.o * factor, h: c.h * factor, l: c.l * factor, c: c.c * factor }));
}
const goldH1 = scaleCandles(rangeH1, 1800);
const goldDaily = scaleCandles(rangeDaily, 1800);
const rangeWhen = { now: new Date(goldH1[300].t) };
const rangeMid = math.assessSetup(XAU, { h1: goldH1.slice(0, 301), d1: goldDaily }, rangeWhen);
assert.strictEqual(rangeMid.regime, 'ranging');
assert.strictEqual(rangeMid.action, 'WAIT');
assert.ok(rangeMid.blockers.some((line) => /not at the edge/i.test(line)));
const rangeForex = math.assessSetup(EUR, { h1: rangeH1.slice(0, 346), d1: rangeDaily }, {
  now: new Date(rangeH1[345].t)
});
assert.strictEqual(rangeForex.regime, 'ranging');
assert.strictEqual(rangeForex.action, 'WAIT', 'forex keeps the trend rules while ranging\n' + dump(rangeForex));
assert.ok(!rangeForex.blockers.some((line) => /not at the edge/i.test(line)));
const rangeHit = math.assessSetup(XAU, { h1: goldH1.slice(0, 346), d1: goldDaily }, {
  now: new Date(goldH1[345].t)
});
assert.strictEqual(rangeHit.action, 'BUY', 'gold range edge should publish mean reversion\n' + dump(rangeHit));
assert.strictEqual(rangeHit.regime, 'ranging');
assert.ok(rangeHit.confidence >= 74 && rangeHit.confidence <= 92);
assert.ok(rangeHit.risk_reward >= 1.8);
assert.ok(/within one ATR of support/i.test(rangeHit.regime_note));
assert.ok(rangeHit.factors.some((factor) => factor.key === 'trend' && factor.state !== 'bullish'), 'range buy does not require a bullish hourly trend');
const rangeOptIn = math.assessSetup(EUR, { h1: rangeH1.slice(0, 346), d1: rangeDaily }, {
  now: new Date(rangeH1[345].t),
  rangeInstruments: ['EURUSD']
});
assert.strictEqual(rangeOptIn.action, 'BUY');
const rangeOff = math.assessSetup(XAU, { h1: goldH1.slice(0, 346), d1: goldDaily }, {
  now: new Date(goldH1[345].t),
  rangeInstruments: []
});
assert.strictEqual(rangeOff.action, 'WAIT');
assert.deepStrictEqual(math.rangeInstrumentIds({}), ['XAUUSD']);
assert.deepStrictEqual(math.rangeInstrumentIds({ rangeInstruments: ['xauusd', 'usoil'] }), ['XAUUSD', 'USOIL']);
const rangeWords = rationale.engineRationale(rangeHit);
assert.ok(/ranging/i.test(rangeWords));
assert.ok(!/guarant|(\b80\b|\b90\b|\b96\b)\s*%/i.test(rangeWords));

const calibratedRows = [];
for (let i = 0; i < 8; i++) calibratedRows.push({ status: 'tp', regime: 'trending', action: 'BUY' });
for (let i = 0; i < 8; i++) calibratedRows.push({ status: 'sl', regime: 'ranging', action: 'SELL' });
const calibrated = math.calibrateConfidence({ action: 'BUY', regime: 'trending', confidence: 90 }, calibratedRows);
assert.strictEqual(calibrated.confidence, 83);
assert.strictEqual(calibrated.confidence_raw, 90);
assert.strictEqual(calibrated.confidence_calibrated, true);
assert.ok(/8 closed signals \(trending BUY\)/.test(calibrated.confidence_basis));
assert.ok(/not a forecast/i.test(calibrated.confidence_basis));
const uncalibrated = math.calibrateConfidence({ action: 'BUY', regime: 'trending', confidence: 88 }, calibratedRows.slice(0, 3));
assert.strictEqual(uncalibrated.confidence, 88);
assert.strictEqual(uncalibrated.confidence_calibrated, false);
assert.ok(/Fewer than 8/.test(uncalibrated.confidence_basis));
const mixedRows = calibratedRows.slice(0, 3).concat([
  { status: 'sl', regime: 'ranging', action: 'SELL' },
  { status: 'sl', regime: 'ranging', action: 'SELL' },
  { status: 'sl', regime: 'ranging', action: 'SELL' },
  { status: 'sl', regime: 'ranging', action: 'SELL' },
  { status: 'sl', regime: 'ranging', action: 'SELL' }
]);
const mixed = math.calibrateConfidence({ action: 'BUY', regime: 'trending', confidence: 80 }, mixedRows);
assert.strictEqual(mixed.confidence, 42);
assert.ok(/all closed signals/.test(mixed.confidence_basis));
const waitScore = math.calibrateConfidence({ action: 'WAIT', regime: 'ranging', confidence: 40 }, calibratedRows);
assert.strictEqual(waitScore.confidence, 40);
assert.strictEqual(waitScore.confidence_calibrated, false);
assert.strictEqual(buy.confidence_calibrated, false, 'the backtest path must keep the raw setup-quality score');

const goldNews = math.assessSetup(XAU, { h1: upH1, d1: upDaily }, {
  now: new Date(upH1[upH1.length - 1].t),
  newsImminent: true,
  newsCurrency: 'EUR',
  newsTitle: 'Euro CPI'
});
assert.ok(!goldNews.blockers.some((b) => /news/i.test(b)), 'non-USD news does not block gold');
assert.ok(blocked.factors.some((factor) => factor.key === 'news' && factor.state === 'blocked'));

const clock = new Date('2026-03-18T13:00:00Z');
const calendar = [
  { title: 'US CPI', currency: 'USD', risk: 'HIGH', time: '2026-03-18T13:20:00Z' },
  { title: 'BOJ', currency: 'JPY', risk: 'HIGH', time: '2026-03-18T12:40:00Z' },
  { title: 'Old NFP', currency: 'USD', risk: 'HIGH', time: '2026-03-18T12:00:00Z' },
  { title: 'Far FOMC', currency: 'USD', risk: 'HIGH', time: '2026-03-18T15:00:00Z' },
  { title: 'Retail', currency: 'USD', risk: 'MEDIUM', time: '2026-03-18T13:10:00Z' }
];
const windowed = math.selectNewsEvents(calendar, clock, 30, 30);
assert.deepStrictEqual(windowed.map((event) => event.title), ['US CPI', 'BOJ']);
const paused = math.assessSetup(EUR, { h1: upH1.slice(0, upHits[0].i + 1), d1: upDaily }, {
  now: new Date(upH1[upHits[0].i].t),
  newsEvents: windowed
});
assert.strictEqual(paused.action, 'WAIT');
assert.ok(paused.blockers.some((line) => /US CPI/.test(line) && /before/.test(line)));
const jpy = { id: 'USDJPY', name: 'USD/JPY', asset: 'forex' };
const afterBoj = math.newsBlockersFor(jpy, { newsEvents: windowed });
assert.ok(afterBoj.some((line) => /BOJ/.test(line) && /after/.test(line)));
const goldUsd = math.newsBlockersFor(XAU, { newsEvents: windowed });
assert.ok(goldUsd.some((line) => /US CPI/.test(line)));
assert.strictEqual(math.newsBlockersFor(XAU, { newsEvents: [{ title: 'BOJ', currency: 'JPY', minutesUntil: -5 }] }).length, 0);

const eurusdLot = position.calculate({
  balance: 10000, risk_pct: 1, account_currency: 'USD', instrument: 'EURUSD', entry: 1.1, stop: 1.095
});
assert.strictEqual(eurusdLot.ok, true);
assert.strictEqual(eurusdLot.lots, 0.2);
const usdjpyLot = position.calculate({
  balance: 10000, risk_pct: 1, account_currency: 'USD', instrument: 'USDJPY', entry: 156, stop: 155.5
});
assert.strictEqual(usdjpyLot.lots, 0.31);
const goldLot = position.calculate({
  balance: 10000, risk_pct: 1, account_currency: 'USD', instrument: 'XAUUSD', entry: 4000, stop: 3980
});
assert.strictEqual(goldLot.lots, 0.05);
const silverLot = position.calculate({
  balance: 10000, risk_pct: 1, account_currency: 'USD', instrument: 'XAGUSD', entry: 50, stop: 49.5
});
assert.strictEqual(silverLot.lots, 0.04);
const jpyAccount = position.calculate({
  balance: 1000000, risk_pct: 1, account_currency: 'JPY', instrument: 'EURUSD', entry: 1.1, stop: 1.095,
  rates: { USDJPY: 156 }
});
assert.strictEqual(jpyAccount.lots, 0.13);
assert.strictEqual(position.calculate({ balance: 10000, risk_pct: 9, instrument: 'EURUSD', entry: 1.1, stop: 1.09 }).ok, false);

const curve = trackerMod.equityCurve([
  { status: 'tp', result_r: 2, closed_at: '2026-01-02T00:00:00Z', instrument: 'EURUSD' },
  { status: 'sl', result_r: -1, closed_at: '2026-01-03T00:00:00Z', instrument: 'EURUSD' },
  { status: 'sl', result_r: -1, closed_at: '2026-01-04T00:00:00Z', instrument: 'XAUUSD' },
  { status: 'expired', result_r: 9, closed_at: '2026-01-05T00:00:00Z', instrument: 'EURUSD' },
  { status: 'open', result_r: null, opened_at: '2026-02-01T00:00:00Z', instrument: 'GBPUSD' }
]);
assert.strictEqual(curve.ending_r, 0);
assert.strictEqual(curve.max_drawdown_r, 2);
const record = trackerMod.buildTrackRecord([
  { id: 'a', instrument: 'EURUSD', name: 'EUR/USD', action: 'BUY', entry: 1.1, stop_loss: 1.09, take_profit_1: 1.12, opened_at: '2026-01-02T00:00:00Z', closed_at: '2026-01-02T05:00:00Z', status: 'tp', result_r: 2 },
  { id: 'b', instrument: 'XAUUSD', name: 'Gold', action: 'SELL', entry: 4000, stop_loss: 4020, take_profit_1: 3960, opened_at: '2026-02-02T00:00:00Z', closed_at: '2026-02-02T05:00:00Z', status: 'sl', result_r: -1 }
], { month: '2026-01' });
assert.strictEqual(record.signals.length, 1);
assert.strictEqual(record.measured.wins, 1);
assert.strictEqual(record.measured.max_drawdown_r, 0);
assert.ok(record.sample_note == null || /not a forecast/i.test(record.basis));
assert.ok(/not a forecast/i.test(record.basis));
assert.ok(!/accurat|guarant|90%/i.test(JSON.stringify(record)));

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

  delete process.env.AI_RATIONALE_PROVIDER;
  delete process.env.OPENAI_API_KEY;
  let assistantFetched = false;
  const engineReply = await assistant.answer('What is the risk on EURUSD right now?', {
    signals: [{
      instrument: 'EURUSD',
      name: 'EUR/USD',
      action: 'WAIT',
      regime: 'ranging',
      blockers: ['Range regime: price is not at the edge of the range.'],
      confidence: 48
    }],
    tracker: { measured: { resolved: 2, wins: 1, losses: 1, open: 0 } }
  }, {
    fetchImpl: async () => {
      assistantFetched = true;
      throw new Error('fetch should not run without a key');
    }
  });
  assert.strictEqual(assistantFetched, false);
  assert.strictEqual(engineReply.source, 'engine');
  assert.ok(/EUR\/USD/.test(engineReply.answer));
  assert.ok(/1% per trade/.test(engineReply.answer));
  assert.ok(!/(\b80\b|\b90\b|\b96\b|\b100\b)\s*%|%\s*accura|guarant/i.test(engineReply.answer));

  process.env.AI_RATIONALE_PROVIDER = 'openai';
  process.env.OPENAI_API_KEY = 'test-key';
  const rejected = await assistant.answer('Should I buy gold?', {
    signals: [{ instrument: 'XAUUSD', name: 'Gold', action: 'WAIT', regime: 'volatile', blockers: ['Volatility is too wide for a new signal.'], confidence: 40 }],
    tracker: { measured: { resolved: 0, wins: 0, losses: 0, open: 0 } }
  }, {
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ output_text: 'Gold is a sure win and 90% accurate. This will always profit.' })
    })
  });
  assert.strictEqual(rejected.source, 'engine');
  assert.ok(/Gold/.test(rejected.answer));
  assert.ok(!/90%|guarant|sure win/i.test(rejected.answer));
  const accepted = await assistant.answer('Why is gold waiting?', {
    signals: [{ instrument: 'XAUUSD', name: 'Gold', action: 'WAIT', regime: 'volatile', blockers: ['Volatility is too wide for a new signal.'], confidence: 40 }],
    tracker: { measured: { resolved: 0, wins: 0, losses: 0, open: 0 } }
  }, {
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        output_text: 'Gold is waiting because the regime is volatile, so no new signal is published. Risk stays at the stated limits. This is analysis only.'
      })
    })
  });
  assert.strictEqual(accepted.source, 'openai');
  assert.ok(/volatile/i.test(accepted.answer));
  const emptyAsk = await assistant.answer('   ', { signals: [] });
  assert.strictEqual(emptyAsk.ok, false);

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

  const alertFile = path.join(os.tmpdir(), 'aurafx-alerts-' + Date.now() + '.json');
  const sent = [];
  const alerts = alertsMod.createAlerts({
    file: alertFile,
    disableNeon: true,
    smtp: { configured: true, from: 'alerts@example.com', host: '127.0.0.1', port: 2525 },
    telegram: { configured: true, token: 'test-token' },
    deliverEmail: async (message) => { sent.push(message); },
    deliverTelegram: async (chatId, text) => { sent.push({ chatId, text }); }
  });
  await assert.rejects(() => alerts.subscribe({ email: 'trader@example.com', consent: false }), /Consent/);
  const signup = await alerts.subscribe({
    email: 'trader@example.com',
    telegram_chat_id: '123456789',
    consent: true,
    instruments: ['EURUSD']
  });
  assert.ok(signup.token);
  const published = {
    type: 'published',
    signal: {
      id: 'sig1', instrument: 'EURUSD', name: 'EUR/USD', action: 'BUY',
      entry: 1.12, stop_loss: 1.11, take_profit_1: 1.14, confidence: 84,
      opened_at: '2026-03-02T12:00:00Z'
    }
  };
  const firstSend = await alerts.dispatch([published, {
    type: 'published',
    signal: { id: 'sig2', instrument: 'XAUUSD', name: 'Gold', action: 'SELL', entry: 4000, stop_loss: 4020, take_profit_1: 3960, opened_at: '2026-03-02T12:00:00Z' }
  }]);
  assert.strictEqual(firstSend.delivered, 1);
  assert.strictEqual(sent.length, 2);
  assert.ok(sent.every((item) => !/(\b80\b|\b90\b|\b96\b)\s*%|%\s*accura|always profit/i.test(JSON.stringify(item))));
  assert.ok(/no result is guaranteed/i.test(sent[1].text));
  assert.ok(/not a predicted win rate/.test(sent[1].text));
  const secondSend = await alerts.dispatch([published]);
  assert.strictEqual(secondSend.delivered, 0);
  await alerts.unsubscribe(signup.token);
  await assert.rejects(() => alerts.unsubscribe(signup.token), /not active/);
  fs.rmSync(alertFile, { force: true });

  await new Promise((resolve, reject) => {
    const server = net.createServer((socket) => {
      socket.write('220 ready\r\n');
      let buf = '';
      let dataMode = false;
      socket.on('data', (chunk) => {
        buf += chunk.toString('utf8');
        if (dataMode) {
          if (buf.includes('\r\n.\r\n')) {
            dataMode = false;
            buf = '';
            socket.write('250 queued\r\n');
          }
          return;
        }
        const lines = buf.split('\r\n');
        buf = lines.pop();
        lines.forEach((line) => {
          if (/^EHLO/i.test(line)) socket.write('250 hello\r\n');
          else if (/^MAIL FROM/i.test(line)) socket.write('250 ok\r\n');
          else if (/^RCPT TO/i.test(line)) socket.write('250 ok\r\n');
          else if (/^DATA/i.test(line)) {
            dataMode = true;
            buf = '';
            socket.write('354 go\r\n');
          } else if (/^QUIT/i.test(line)) socket.end();
        });
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      alertsMod.deliverSmtp({
        from: 'alerts@example.com',
        to: 'trader@example.com',
        subject: 'AuraFX Elite — signal published',
        text: 'Analysis only'
      }, { host: '127.0.0.1', port, mode: 'plain', user: '', from: 'alerts@example.com' })
        .then(() => { server.close(); resolve(); })
        .catch((error) => { server.close(); reject(error); });
    });
  });

  const { buildPlans } = require('./signal-plans');
  const publishedBuy = {
    instrument: 'EURUSD',
    name: 'EUR/USD',
    action: 'BUY',
    published: true,
    regime: 'trending',
    regime_note: 'Trend regime: trend, momentum, structure and higher timeframes agree.',
    price: 1.1,
    entry: 1.1,
    stop_loss: 1.09,
    take_profit_1: 1.12,
    take_profit_2: null,
    risk_reward: 2,
    confidence: 86,
    confidence_basis: 'Setup quality. Fewer than 8 closed signals, so this is not calibrated.',
    blockers: [],
    session: 'London'
  };
  const waiting = {
    instrument: 'GBPUSD',
    name: 'GBP/USD',
    action: 'WAIT',
    published: false,
    regime: 'ranging',
    regime_note: 'Regime is ranging.',
    price: 1.27,
    entry: 1.27,
    stop_loss: 1.26,
    take_profit_1: 1.29,
    blockers: ['Range regime: price is not at the edge of the range.'],
    confidence: 48
  };
  const plans = buildPlans({ updated_at: '2026-10-23T00:00:00.000Z', signals: [publishedBuy, waiting] });
  assert.strictEqual(plans.plans[0].bias, 'BUY');
  assert.strictEqual(plans.plans[0].key_levels.entry, 1.1);
  assert.strictEqual(plans.plans[0].key_levels.stop_loss, 1.09);
  assert.strictEqual(plans.plans[1].key_levels, null);
  assert.ok(!/1\.26|1\.29/.test(JSON.stringify(plans.plans[1])));
  assert.ok(/not at the edge/.test(plans.plans[1].scenario.detail));
  assert.strictEqual(plans.risk.per_trade_pct, 1);
  assert.strictEqual(plans.risk.max_daily_loss_pct, 3);
  assert.strictEqual(plans.risk.max_weekly_loss_pct, 7);
  assert.strictEqual(plans.risk.max_open_trades, 3);
  assert.strictEqual(plans.risk.auto_trading, 'off');
  assert.ok(/not an order/.test(plans.plans[0].note));
  assert.ok(/no result is guaranteed/i.test(plans.disclaimer));
  const planBlob = JSON.stringify(plans);
  assert.ok(!/(\b80\b|\b90\b|\b96\b|\b100\b)\s*%|%\s*accura|guaranteed profit|let ai trade|high accuracy/i.test(planBlob));
  assert.deepStrictEqual(buildPlans({ signals: [] }).plans, []);

  const pricing = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'pricing.json'), 'utf8'));
  const freeTier = pricing.tiers.find((tier) => tier.id === 'free');
  const proTier = pricing.tiers.find((tier) => tier.id === 'pro');
  const eliteTier = pricing.tiers.find((tier) => tier.id === 'elite');
  assert.strictEqual(pricing.currency, 'GBP');
  assert.strictEqual(pricing.currency_symbol, '£');
  assert.strictEqual(pricing.contact, 'support@aurafxelite.com');
  assert.strictEqual(freeTier.price, 0);
  assert.strictEqual(freeTier.delay_minutes, 15);
  assert.ok(freeTier.features.some((line) => /delayed signals/i.test(line)));
  assert.strictEqual(proTier.price, 19);
  assert.strictEqual(proTier.period, 'month');
  assert.strictEqual(proTier.annual_price, 190);
  assert.strictEqual(eliteTier.price, 49);
  assert.strictEqual(eliteTier.period, 'month');
  assert.strictEqual(eliteTier.annual_price, 490);
  assert.strictEqual(proTier.annual_price, proTier.price * 10);
  assert.strictEqual(eliteTier.annual_price, eliteTier.price * 10);
  assert.ok(!/parslia/i.test(JSON.stringify(pricing)));
  const pricingPage = fs.readFileSync(path.join(__dirname, 'public', 'pricing.html'), 'utf8');
  assert.ok(/Contact us/.test(pricingPage));
  assert.ok(/support@aurafxelite.com/.test(pricingPage));
  assert.ok(/£19/.test(pricingPage) && /£49/.test(pricingPage) && /£190/.test(pricingPage) && /£490/.test(pricingPage));
  assert.ok(!/parslia/i.test(pricingPage));

  const priorDelay = process.env.SIGNAL_FREE_DELAY_MIN;
  delete process.env.SIGNAL_FREE_DELAY_MIN;
  signalService.clearSnapshotsForTests();
  const notReady = signalService.getDelayedBoard(Date.now());
  assert.strictEqual(notReady.ready, false);
  assert.strictEqual(notReady.delayed, true);
  assert.deepStrictEqual(notReady.signals, []);
  assert.ok(/old enough/i.test(notReady.note));
  assert.ok(!/live board is delayed/i.test(notReady.note));
  signalService.rememberSnapshotForTests({ signals: [{ instrument: 'EURUSD', action: 'WAIT' }], disclaimer: math.DISCLAIMER }, Date.now() - 16 * 60 * 1000);
  signalService.rememberSnapshotForTests({ signals: [{ instrument: 'FRESH', action: 'BUY' }] }, Date.now());
  const delayed = signalService.getDelayedBoard(Date.now());
  assert.strictEqual(delayed.ready, true);
  assert.strictEqual(delayed.delayed, true);
  assert.strictEqual(delayed.signals[0].instrument, 'EURUSD');
  assert.ok(/not the live board/i.test(delayed.note));
  process.env.SIGNAL_FREE_DELAY_MIN = '0';
  const immediate = signalService.getDelayedBoard(Date.now());
  assert.strictEqual(immediate.ready, true);
  assert.strictEqual(immediate.signals[0].instrument, 'FRESH');
  if (priorDelay == null) delete process.env.SIGNAL_FREE_DELAY_MIN;
  else process.env.SIGNAL_FREE_DELAY_MIN = priorDelay;
  signalService.clearSnapshotsForTests();

  const bannedPage = /let ai trade for you|think with ai|high accuracy|(\b80\b|\b90\b|\b96\b)\s*%|%\s*accura|guaranteed profit|risk[- ]free/i;
  ['index.html', 'trading-plans.html', 'ai-engine.html', 'pricing.html', 'legal.html', 'disclaimer.html', 'how-it-works.html'].forEach((file) => {
    const html = fs.readFileSync(path.join(__dirname, 'public', file), 'utf8');
    assert.ok(!bannedPage.test(html), file + ' has a disallowed claim');
    assert.ok(/no result is guaranteed/i.test(html), file + ' is missing the disclaimer');
  });

  console.log('Signal engine tests passed. Sample BUY confidence ' + buy.confidence + ', backtest trades ' + bt.trade_count + ', measured win rate ' + bt.measured.win_rate + ' on ' + bt.measured.resolved + ' resolved.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
