'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const analytics = require('./market-analytics');
const chartMath = require('./chart-math');
const { createDashboardLink, PASSWORD_REQUIRED, SMTP_OFF } = require('./dashboard-link');
const { createMembersStore, tierAllows, passwordMatches } = require('./members-store');
const { createMemberDesk } = require('./member-desk');
const assistant = require('./signal-assistant');
const marketCandles = require('./market-candles');

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

const m15 = chartMath.candleView({ h1: rising, d1: rising }, 'M15');
assert.strictEqual(m15.available, false);
assert.strictEqual(m15.bars.length, 0);
assert.ok(/not in the price feed/i.test(m15.note));
assert.ok(/No 15-minute bars are invented/i.test(m15.note));

function hourlyBars(count, volume) {
  const rows = [];
  for (let i = 0; i < count; i++) {
    const bar = {
      t: new Date(Date.UTC(2026, 0, 1, i)).toISOString(),
      o: 10 + i,
      h: 12 + i,
      l: 9 + i,
      c: 11 + i
    };
    if (volume != null) bar.v = volume;
    rows.push(bar);
  }
  return rows;
}
const h4 = chartMath.candleView({ h1: hourlyBars(8, 2) }, 'H4');
assert.strictEqual(h4.available, true);
assert.strictEqual(h4.bars.length, 2);
assert.strictEqual(h4.bars[0].open, 10);
assert.strictEqual(h4.bars[1].close, 18);
assert.strictEqual(h4.volume_available, true);
assert.strictEqual(h4.bars[0].volume, 8);
assert.ok(h4.indicators.vwap.length > 0);
assert.ok(h4.indicators.ema20);
const bare = chartMath.candleView({ h1: hourlyBars(40, null) }, 'H1');
assert.strictEqual(bare.volume_available, false);
assert.ok(/volume/i.test(bare.note));
assert.ok(!Object.prototype.hasOwnProperty.call(bare.bars[0], 'volume'));
assert.strictEqual(bare.indicators.vwap.length, 0);
assert.ok(bare.indicators.ema20.length > 0);
const mixed = hourlyBars(8, 2);
delete mixed[5].v;
const partial = chartMath.candleView({ h1: mixed }, 'H4');
assert.strictEqual(partial.volume_available, false);

const yahooVol = marketCandles.parseYahooChart({
  chart: { result: [{ timestamp: [1700000000], indicators: { quote: [{ open: [1.1], high: [1.2], low: [1.0], close: [1.15], volume: [42] }] } }] }
});
assert.strictEqual(yahooVol[0].v, 42);
const yahooBare = marketCandles.parseYahooChart({
  chart: { result: [{ timestamp: [1700000000], indicators: { quote: [{ open: [1.1], high: [1.2], low: [1.0], close: [1.15] }] } }] }
});
assert.strictEqual(yahooBare[0].v, undefined);

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
  const layoutDenied = harness();
  await freeDesk.handle(
    { method: 'POST', headers: { cookie }, socket: {} },
    layoutDenied.res,
    { url: '/api/members/chart-layout', rawUrl: '/api/members/chart-layout', json: layoutDenied.json, readBody: async () => ({ desk: { layout: 4 } }) }
  );
  assert.strictEqual(layoutDenied.res.status, 403);

  const layoutSaved = harness();
  await desk.handle(
    { method: 'POST', headers: { cookie: eliteCookie }, socket: {} },
    layoutSaved.res,
    {
      url: '/api/members/chart-layout',
      rawUrl: '/api/members/chart-layout',
      json: layoutSaved.json,
      readBody: async () => ({
        desk: {
          layout: 4,
          sync: true,
          theme: 'light',
          panes: [
            {
              id: 'p1', instrument: 'EURUSD', timeframe: 'H1', style: 'heikin',
              indicators: { ema20: true, rsi: true },
              drawings: [
                { id: 't1', type: 'trendline', a: { time: 100, price: 1.1 }, b: { time: 200, price: 1.2 } },
                { id: 'bad', type: 'arrow', a: { time: 1, price: 1 } },
                { id: 'h1', type: 'hline', a: { time: 100, price: 1.15 } }
              ]
            },
            { id: 'p2', instrument: 'NOTREAL', timeframe: 'M15', style: 'hollow' },
            { id: 'p3', instrument: 'XAUUSD', timeframe: 'D1', style: 'area' }
          ]
        }
      })
    }
  );
  assert.strictEqual(layoutSaved.res.status, 200);
  assert.strictEqual(layoutSaved.res.body.desk.layout, 4);
  assert.strictEqual(layoutSaved.res.body.desk.panes.length, 4);
  assert.strictEqual(layoutSaved.res.body.desk.theme, 'light');
  assert.strictEqual(layoutSaved.res.body.desk.sync, true);
  assert.strictEqual(layoutSaved.res.body.desk.panes[0].style, 'heikin');
  assert.strictEqual(layoutSaved.res.body.desk.panes[0].indicators.ema20, true);
  assert.deepStrictEqual(layoutSaved.res.body.desk.panes[0].drawings.map((item) => item.type), ['trendline', 'hline']);
  assert.strictEqual(layoutSaved.res.body.desk.panes[1].instrument, 'XAUUSD');
  assert.strictEqual(layoutSaved.res.body.desk.panes[1].timeframe, 'M15');
  assert.ok(!layoutSaved.res.body.desk.hash);
  const layoutRead = harness();
  await desk.handle(
    { method: 'GET', headers: { cookie: eliteCookie }, socket: {} },
    layoutRead.res,
    { url: '/api/members/chart-layout', rawUrl: '/api/members/chart-layout', json: layoutRead.json, readBody: async () => ({}) }
  );
  assert.strictEqual(layoutRead.res.status, 200);
  assert.strictEqual(layoutRead.res.body.desk.panes[0].drawings.length, 2);
  assert.strictEqual(layoutRead.res.body.desk.panes[3].instrument, 'XAUUSD');

  const linkStore = createMembersStore({ file: path.join(os.tmpdir(), 'aura-link-' + process.pid + '.json') });
  linkStore.register({ name: 'Link User', email: 'link@example.com', password: 'member-pass', acceptRisk: true });
  const regs = { 'link@example.com': { id: 'reg-1', email: 'link@example.com', fullName: 'Link User', emailVerified: true } };
  const sent = [];
  let smtpOn = false;
  const linker = createDashboardLink({
    members: linkStore,
    findRegistration: async (email) => regs[email] || null,
    makeToken: (id, email) => 'token-' + id + '-' + email,
    smtpConfigured: () => smtpOn,
    sendMail: async (message) => { sent.push(message); },
    siteUrl: 'https://aurafxelite.com'
  });
  const emailOnly = await linker.request({ email: 'link@example.com' }, {});
  assert.strictEqual(emailOnly.status, 401);
  assert.strictEqual(emailOnly.body.error, PASSWORD_REQUIRED);
  assert.ok(!Object.prototype.hasOwnProperty.call(emailOnly.body, 'dashboardToken'));
  const badPassword = await linker.request({ email: 'link@example.com', password: 'wrong-pass' }, { ip: 'link-ip' });
  assert.strictEqual(badPassword.status, 401);
  assert.ok(!badPassword.body.dashboardToken);
  const goodPassword = await linker.request({ email: 'link@example.com', password: 'member-pass' }, { ip: 'link-ip-2' });
  assert.strictEqual(goodPassword.status, 200);
  assert.strictEqual(goodPassword.body.dashboardToken, 'token-reg-1-link@example.com');
  const magicOff = await linker.request({ email: 'link@example.com', magic: true }, {});
  assert.strictEqual(magicOff.status, 503);
  assert.strictEqual(magicOff.body.error, SMTP_OFF);
  assert.strictEqual(magicOff.body.smtp, false);
  assert.ok(!magicOff.body.dashboardToken);
  assert.strictEqual(sent.length, 0);
  smtpOn = true;
  const magicUnknown = await linker.request({ email: 'missing@example.com', magic: true }, {});
  const magicKnown = await linker.request({ email: 'link@example.com', magic: true }, {});
  assert.strictEqual(magicUnknown.status, 200);
  assert.strictEqual(magicKnown.status, 200);
  assert.strictEqual(magicUnknown.body.message, magicKnown.body.message);
  assert.ok(!magicUnknown.body.dashboardToken && !magicKnown.body.dashboardToken);
  assert.strictEqual(sent.length, 1);
  assert.ok(sent[0].text.includes('https://aurafxelite.com/dashboard.html?dash_link='));
  const token = sent[0].text.split('dash_link=')[1].split('\n')[0].trim();
  const redeemed = await linker.redeem(token, false);
  assert.strictEqual(redeemed.status, 200);
  assert.strictEqual(redeemed.body.dashboardToken, 'token-reg-1-link@example.com');
  const again = await linker.redeem(token, false);
  assert.strictEqual(again.status, 401);
  assert.ok(!again.body.dashboardToken);
  const cookieMember = linkStore.login('link@example.com', 'member-pass', 'link-ip-3');
  const fromSession = await linker.request({}, { member: cookieMember });
  assert.strictEqual(fromSession.status, 200);
  assert.ok(fromSession.body.dashboardToken);

  const serverSrc = fs.readFileSync(path.join(__dirname, 'simple-server.js'), 'utf8');
  assert.ok(!/dashboardToken:\s*dashStore/.test(serverSrc), 'registration and email lookup must not mint a dashboard token');
  assert.ok(serverSrc.includes('dashboardLink.request'));
  assert.ok(serverSrc.includes('/api/dashboard/session/redeem'));
  ['member-charts.js', 'members-app.js', 'pro-dashboard.js'].forEach((name) => {
    const text = fs.readFileSync(path.join(__dirname, 'public', 'js', name), 'utf8');
    assert.ok(!/parslia/i.test(text), name);
    assert.ok(!/90%|guaranteed profit/i.test(text), name);
  });
  const chartCss = fs.readFileSync(path.join(__dirname, 'public', 'css', 'members.css'), 'utf8');
  assert.ok(chartCss.includes('.chart-grid.n4'));
  assert.ok(/grid-template-columns:\s*1fr;/.test(chartCss));

  const { createAdminMembers, STORAGE_NOTE } = require('./admin-members');
  const adminAuth = require('./admin-auth');
  assert.ok(adminAuth.ADMIN_HTML.includes('/owner-members.html'));
  const adminStore = createMembersStore({ file: path.join(os.tmpdir(), 'aura-admin-' + process.pid + '.json') });
  adminStore.register({ name: 'Free Tester', email: 'free.tester@example.com', password: 'free-pass-1', acceptRisk: true });
  const listed = adminStore.listPublic();
  assert.strictEqual(listed[0].tier, 'free');
  assert.ok(!listed[0].hash && !listed[0].salt && !listed[0].journal);
  const adminApi = createAdminMembers({ store: adminStore });
  const denied = harness();
  const deniedDone = await adminApi.handle(
    { method: 'GET', headers: {}, url: '/api/admin/members' },
    denied.res,
    { url: '/api/admin/members', json: denied.json, readBody: async () => ({}), isAdmin: () => false }
  );
  assert.strictEqual(deniedDone, true);
  assert.strictEqual(denied.res.status, 403);
  const opened = harness();
  await adminApi.handle(
    { method: 'GET', headers: {} },
    opened.res,
    { url: '/api/admin/members', json: opened.json, readBody: async () => ({}), isAdmin: () => true }
  );
  assert.strictEqual(opened.res.status, 200);
  assert.strictEqual(opened.res.body.members[0].email, 'free.tester@example.com');
  assert.strictEqual(opened.res.body.storage, 'file');
  assert.ok(/not in git/i.test(opened.res.body.note));
  assert.strictEqual(opened.res.body.note, STORAGE_NOTE);
  assert.ok(!JSON.stringify(opened.res.body).includes('free-pass-1'));
  const changed = harness();
  await adminApi.handle(
    { method: 'POST', headers: {} },
    changed.res,
    {
      url: '/api/admin/members/tier',
      json: changed.json,
      readBody: async () => ({ email: 'free.tester@example.com', tier: 'pro' }),
      isAdmin: () => true,
      audit: () => {}
    }
  );
  assert.strictEqual(changed.res.status, 200);
  assert.strictEqual(changed.res.body.member.tier, 'pro');
  assert.ok(!changed.res.body.member.hash);
  assert.strictEqual(adminStore.listPublic()[0].tier, 'pro');
  const badTier = harness();
  await adminApi.handle(
    { method: 'POST', headers: {} },
    badTier.res,
    { url: '/api/admin/members/tier', json: badTier.json, readBody: async () => ({ email: 'free.tester@example.com', tier: 'vip' }), isAdmin: () => true }
  );
  assert.strictEqual(badTier.res.status, 400);
  const ownerPage = fs.readFileSync(path.join(__dirname, 'public', 'owner-members.html'), 'utf8');
  assert.ok(!/parslia/i.test(ownerPage));
  assert.ok(ownerPage.includes('/api/admin/members'));
  assert.ok(ownerPage.includes('signup.html'));
  assert.ok(!/ADMIN_PASSWORD|password\s*[:=]\s*['\"]/.test(ownerPage));

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
