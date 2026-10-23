'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const analytics = require('./market-analytics');
const { createMembersStore, tierAllows, passwordMatches } = require('./members-store');
const { createMemberDesk } = require('./member-desk');
const assistant = require('./signal-assistant');

function candles(count, start, step) {
  const rows = [];
  let price = start;
  for (let i = 0; i < count; i++) {
    price += step;
    const t = new Date(Date.UTC(2026, 0, 1, i)).toISOString();
    rows.push({ t, o: price - step, h: price + 0.1, l: price - 0.1, c: price });
  }
  return rows;
}

const rising = candles(40, 1.1, 0.001);
const falling = candles(40, 150, -0.05);
const map = { EURUSD: rising, USDJPY: falling };
const strength = analytics.currencyStrength(map, 24);
assert.ok(strength.currencies.find((row) => row.currency === 'EUR'));
assert.ok(strength.currencies.find((row) => row.currency === 'USD'));
assert.ok(!strength.currencies.find((row) => row.currency === 'GBP'), 'a currency with no pair is omitted');
assert.ok(!JSON.stringify(strength).includes('62'));
const eur = strength.currencies.find((row) => row.currency === 'EUR');
assert.ok(eur.change_pct > 0, 'EUR strength follows the measured EURUSD rise');

const shortMap = { EURUSD: candles(10, 1, 0.01), GBPUSD: candles(10, 1.2, 0.01) };
const matrix = analytics.correlationMatrix(shortMap, ['EURUSD', 'GBPUSD'], 20);
assert.strictEqual(matrix.matrix.EURUSD.GBPUSD, null);

const same = candles(40, 1, 0.01);
const matched = analytics.correlationMatrix({ EURUSD: same, GBPUSD: same }, ['EURUSD', 'GBPUSD'], 20);
assert.strictEqual(matched.matrix.EURUSD.GBPUSD, 1);

const clock = analytics.sessionsAt(new Date(Date.UTC(2026, 5, 2, 14, 30)));
assert.strictEqual(clock.label, 'London / New York overlap');
assert.ok(clock.windows.find((row) => row.name === 'London' && row.active));

const brief = analytics.briefFor({
  instrument: 'XAUUSD',
  name: 'Gold',
  action: 'WAIT',
  regime: 'ranging',
  confidence: 40,
  confidence_calibrated: false,
  support: null,
  resistance: 2400,
  blockers: ['Range regime: price is not at the edge of the range.']
});
assert.strictEqual(brief.bias, 'Wait');
assert.strictEqual(brief.levels, null);
assert.ok(/not a probability|No probability/i.test(brief.confidence_text));
assert.ok(!/90%|guaranteed profit/i.test(JSON.stringify(brief)));

const overlays = analytics.chartOverlays({
  action: 'WAIT',
  entry: 1.1,
  stop_loss: 1.0,
  support: 1.05,
  resistance: null
});
assert.deepStrictEqual(overlays.map((line) => line.title), ['Support']);

const paused = analytics.annotateCalendar([
  { title: 'US CPI', currency: 'USD', risk: 'HIGH', time: new Date(Date.UTC(2026, 5, 2, 13, 20)).toISOString() },
  { title: 'Speech', currency: 'USD', risk: 'LOW', time: new Date(Date.UTC(2026, 5, 2, 13, 20)).toISOString() }
], new Date(Date.UTC(2026, 5, 2, 13, 0)), 30, 30);
assert.strictEqual(paused[0].pauses_new_signals, true);
assert.strictEqual(paused[1].pauses_new_signals, false);

const answer = assistant.engineAnswer('What is the gold half-hour trend?', {
  signals: [{ instrument: 'XAUUSD', name: 'Gold', action: 'WAIT', regime: 'ranging', blockers: ['Volatility is too wide for a new signal.'], trend: 'neutral', mtf: 'neutral' }]
});
assert.ok(/does not run a separate 30-minute/i.test(answer));
assert.ok(!/90%|guaranteed profit/i.test(answer));

assert.strictEqual(tierAllows('free', 'sessions'), true);
assert.strictEqual(tierAllows('free', 'calendar'), true);
assert.strictEqual(tierAllows('free', 'scanner'), false);
assert.strictEqual(tierAllows('pro', 'scanner'), true);
assert.strictEqual(tierAllows('pro', 'journal'), false);
assert.strictEqual(tierAllows('elite', 'alerts'), true);

const file = path.join(os.tmpdir(), 'aura-members-' + process.pid + '.json');
const store = createMembersStore({ file });
const user = store.register({ name: 'Ada Tester', email: 'ada@example.com', password: 'correct-horse', acceptRisk: true });
assert.strictEqual(user.tier, 'free');
assert.ok(!user.hash && !user.salt);
const raw = fs.readFileSync(file, 'utf8');
assert.ok(!raw.includes('correct-horse'));
const stored = JSON.parse(raw).members[0];
assert.ok(passwordMatches('correct-horse', stored));
let rejected = false;
try { store.login('ada@example.com', 'wrong-password-1', 'ip-a'); } catch (error) { rejected = error.status === 401; }
assert.ok(rejected);
store.setTier('ada@example.com', 'elite');
assert.strictEqual(store.findByEmail('ada@example.com').tier, 'elite');

const fakeSignals = {
  async getBoard() {
    return {
      updated_at: '2026-10-23T12:00:00.000Z',
      summary: { buy: 0, sell: 0, wait: 1, scanned: 1 },
      feed: { status: 'live', detail: 'test' },
      signals: [{
        instrument: 'EURUSD',
        name: 'EUR/USD',
        action: 'WAIT',
        published: false,
        regime: 'ranging',
        session: 'London',
        price: 1.1,
        rsi: 44,
        atr: 0.0012,
        atr_ratio: 1.1,
        support: 1.08,
        resistance: 1.12,
        trend: 'neutral',
        mtf: 'neutral',
        confidence: 40,
        confidence_calibrated: false,
        blockers: ['Confluence is present but the setup-quality score is below the publication threshold.']
      }]
    };
  },
  getDelayedBoard() { return { ok: true, ready: false, delayed: true, signals: [] }; },
  getPlans() { return { plans: [], disclaimer: 'Aura Elite FX provides AI-assisted market analysis, confidence scoring, backtesting and risk tools. Trading involves risk and no result is guaranteed.' }; },
  async getTrackRecord() { return { ok: true, signals: [], measured: { resolved: 0, by_session: {} }, equity: [] }; },
  async ask(question) { return { ok: true, answer: 'Measured board only. ' + question, source: 'engine' }; }
};

const desk = createMemberDesk({ store, signals: fakeSignals });

function harness() {
  return {
    res: { status: 0, body: null, headers: {}, setHeader(key, value) { this.headers[key] = value; }, writeHead() {}, end() {} },
    json(res, code, obj) { res.status = code; res.body = obj; }
  };
}

(async () => {
  const free = createMembersStore({ file: path.join(os.tmpdir(), 'aura-free-' + process.pid + '.json') });
  const freeDesk = createMemberDesk({ store: free, signals: fakeSignals });
  free.register({ name: 'Free User', email: 'free@example.com', password: 'free-pass-1', acceptRisk: true });
  const login = harness();
  await freeDesk.handle(
    { method: 'POST', headers: {}, socket: { remoteAddress: '10.0.0.8' } },
    login.res,
    { url: '/api/members/login', rawUrl: '/api/members/login', json: login.json, readBody: async () => ({ email: 'free@example.com', password: 'free-pass-1' }) }
  );
  assert.strictEqual(login.res.status, 200);
  const cookie = login.res.headers['Set-Cookie'];
  assert.ok(cookie && cookie.includes('aurafx_member'));
  const req = { method: 'GET', headers: { cookie }, socket: {} };
  const board = harness();
  await freeDesk.handle(req, board.res, {
    url: '/api/members/workspace',
    rawUrl: '/api/members/workspace',
    json: board.json,
    readBody: async () => ({}),
    news: () => ({}),
    newsWindow: () => ({ before: 30, after: 30 }),
    calendar: () => []
  });
  assert.strictEqual(board.res.status, 200);
  assert.strictEqual(board.res.body.member.tier, 'free');
  assert.strictEqual(board.res.body.scanner.locked, true);
  assert.strictEqual(board.res.body.access.charts, false);
  const candles = harness();
  await freeDesk.handle(
    { method: 'GET', headers: { cookie }, socket: {} },
    candles.res,
    { url: '/api/members/candles', rawUrl: '/api/members/candles?instrument=EURUSD', json: candles.json, readBody: async () => ({}) }
  );
  assert.strictEqual(candles.res.status, 403);
  const ask = harness();
  await freeDesk.handle(
    { method: 'POST', headers: { cookie }, socket: {} },
    ask.res,
    { url: '/api/members/ask', rawUrl: '/api/members/ask', json: ask.json, readBody: async () => ({ question: 'Explain EURUSD' }) }
  );
  assert.strictEqual(ask.res.status, 403);

  const eliteLogin = harness();
  await desk.handle(
    { method: 'POST', headers: {}, socket: { remoteAddress: '10.0.0.9' } },
    eliteLogin.res,
    { url: '/api/members/login', rawUrl: '/api/members/login', json: eliteLogin.json, readBody: async () => ({ email: 'ada@example.com', password: 'correct-horse' }) }
  );
  const eliteCookie = eliteLogin.res.headers['Set-Cookie'];
  const saved = harness();
  await desk.handle(
    { method: 'POST', headers: { cookie: eliteCookie }, socket: {} },
    saved.res,
    {
      url: '/api/members/alerts',
      rawUrl: '/api/members/alerts',
      json: saved.json,
      readBody: async () => ({ alerts: [{ type: 'price', instrument: 'EURUSD', op: 'above', price: 1.05, channel: 'telegram' }] }),
      news: () => ({})
    }
  );
  assert.strictEqual(saved.res.status, 200);
  assert.strictEqual(saved.res.body.alerts[0].triggered, true);
  assert.strictEqual(saved.res.body.alerts[0].delivery, 'not_configured');
  const pages = ['members.html', 'login.html', 'signup.html', 'index.html', 'pricing.html'];
  pages.forEach((name) => {
    const html = fs.readFileSync(path.join(__dirname, 'public', name), 'utf8');
    assert.ok(!/parslia/i.test(html), name);
  });
  console.log('member tests ok');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
