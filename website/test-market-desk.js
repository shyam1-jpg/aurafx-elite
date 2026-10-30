'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const desk = require('./public/js/market-desk-model');

const BANNED = /certain profit|sure win|risk[- ]free|guaranteed profit|(\b80\b|\b90\b|\b96\b|\b100\b)\s*%|%\s*accura|parslia/i;

function goldBuy() {
  return {
    instrument: 'XAUUSD',
    name: 'Gold',
    asset: 'metal',
    action: 'BUY',
    published: true,
    price: 2650.25,
    regime: 'trending',
    regime_note: 'Trend regime: the hourly swings are directional.',
    session: 'london',
    trend: 'bullish',
    mtf: 'bullish',
    rsi: 58.2,
    atr: 12.4,
    atr_ratio: 1.05,
    support: 2620.1,
    resistance: 2688.4,
    entry: 2650.25,
    stop_loss: 2630,
    take_profit_1: 2690.5,
    take_profit_2: 2710,
    risk_reward: 1.98,
    confidence: 74,
    confidence_basis: 'The confidence figure is setup quality, not a predicted win rate.',
    rationale: 'Buy bias on Gold. Trend, momentum and structure agree. The first target is 1.98R. The confidence figure is setup quality, not a predicted win rate.',
    blockers: [],
    factors: [
      { key: 'trend', state: 'bullish', note: 'Hourly trend points up.' },
      { key: 'momentum', state: 'bullish', note: 'RSI is rising without being exhausted.' },
      { key: 'volatility', state: 'clear', note: 'ATR is near its recent average.' },
      { key: 'structure', state: 'bullish', note: 'Price is holding above the last swing low.' },
      { key: 'mtf', state: 'bullish', note: '4-hour and daily trends both point up.' }
    ],
    data_quality: 'ok',
    feed_note: 'COMEX gold futures'
  };
}

function eurusdWait() {
  return {
    instrument: 'EURUSD',
    name: 'EUR/USD',
    action: 'WAIT',
    price: 1.08642,
    regime: 'ranging',
    session: 'london',
    rsi: 49,
    atr: 0.0008,
    atr_ratio: 0.4,
    support: 1.082,
    resistance: 1.09,
    entry: 1.08642,
    stop_loss: 1.08,
    confidence: 40,
    rationale: 'Wait on EUR/USD. Confluence is incomplete.',
    blockers: ['Higher timeframes do not agree.'],
    factors: [{ key: 'trend', state: 'neutral', note: 'Hourly trend is flat.' }]
  };
}

const board = {
  updated_at: '2026-10-30T07:00:00.000Z',
  source: 'yahoo',
  disclaimer: desk.DISCLAIMER,
  signals: [eurusdWait(), goldBuy(), { instrument: 'USOIL', name: 'WTI Crude', action: 'SELL', asset: 'commodity', price: 72.1 }]
};

const full = desk.build(board, { depth: 'full' });
assert.strictEqual(full.selected, 'XAUUSD');
assert.strictEqual(full.summary.buy, 1);
assert.strictEqual(full.summary.sell, 1);
assert.strictEqual(full.summary.wait, 1);
assert.deepStrictEqual(full.groups.map((group) => group.id), ['forex', 'metal', 'commodity']);
assert.strictEqual(full.risk.per_trade_pct, 1);
assert.strictEqual(full.risk.auto_trading, 'off');

const gold = full.instruments.find((row) => row.instrument === 'XAUUSD');
assert.ok(gold.plan);
assert.strictEqual(gold.plan.entry, 2650.25);
assert.strictEqual(gold.trend.state, 'bullish');
assert.strictEqual(gold.trend.higher, 'bullish');
assert.strictEqual(gold.momentum.rsi, 58.2);
assert.strictEqual(gold.volatility.state, 'normal');
assert.strictEqual(gold.structure.support, 2620.1);
assert.strictEqual(gold.scenario.bias, 'Buy');
assert.match(gold.scenario.note, /not a forecast/i);
assert.match(gold.plan_note, /not an order/i);

const euro = full.instruments.find((row) => row.instrument === 'EURUSD');
assert.strictEqual(euro.plan, null);
assert.match(euro.plan_note, /No entry, stop or target/);
assert.strictEqual(euro.scenario.bias, 'Wait');
assert.match(euro.scenario.invalid_if, /Higher timeframes/);
assert.strictEqual(euro.volatility.state, 'quiet');
assert.strictEqual(euro.asset, 'forex');

const teaser = desk.build({
  signals: [Object.assign({}, goldBuy(), { asset: undefined })]
}, { depth: 'teaser' });
const hidden = teaser.instruments[0];
assert.strictEqual(hidden.asset, 'metal');
assert.strictEqual(hidden.plan, null);
assert.strictEqual(hidden.price, null);
assert.strictEqual(hidden.rationale, null);
assert.strictEqual(hidden.trend.state, null);
assert.strictEqual(hidden.structure.support, null);
assert.strictEqual(hidden.momentum.rsi, null);
assert.strictEqual(hidden.confidence, null);
assert.match(hidden.confidence_basis, /setup quality/);
assert.match(hidden.scenario.note, /Pro and Elite/);
assert.match(hidden.plan_note, /Pro and Elite/);

const picked = desk.build(board, { instrument: 'USOIL' });
assert.strictEqual(picked.selected, 'USOIL');
const empty = desk.build({ signals: [{ name: 'Missing id' }] });
assert.strictEqual(empty.summary.scanned, 0);
assert.strictEqual(empty.selected, null);

const blob = JSON.stringify(full) + JSON.stringify(teaser);
assert.ok(!BANNED.test(blob), blob.match(BANNED));

const files = [
  'public/js/market-desk-model.js',
  'public/js/market-desk.js',
  'public/css/market-desk.css',
  'public/markets.html',
  'public/dashboard.html',
  'public/members.html'
];
files.forEach((name) => {
  const text = fs.readFileSync(path.join(__dirname, name), 'utf8');
  assert.ok(!/parslia/i.test(text), name);
  assert.ok(!/guaranteed profit|(\b90\b|\b96\b)\s*%/i.test(text), name);
});

const markets = fs.readFileSync(path.join(__dirname, 'public/markets.html'), 'utf8');
const dashboard = fs.readFileSync(path.join(__dirname, 'public/dashboard.html'), 'utf8');
const members = fs.readFileSync(path.join(__dirname, 'public/members.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, 'public/js/members-app.js'), 'utf8');
assert.ok(markets.includes('data-market-desk'));
assert.ok(dashboard.includes('id="dashMarketDesk"'));
assert.ok(members.includes('market-desk.js'));
assert.ok(app.includes("name === 'desk'"));
assert.ok(app.includes("gate('brief')"));
assert.ok(app.includes("state._deskDepth = full ? 'full' : 'teaser'"));

console.log('market desk tests ok');
