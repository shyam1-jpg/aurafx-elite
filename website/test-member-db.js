'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { newDb } = require('pg-mem');
const { openMembersStore, FILE_WARNING, tierAllows, passwordMatches } = require('./members-store');
const {
  stripeSettings,
  signStripePayload,
  handleWebhook,
  createCheckoutSession,
  createPortalSession
} = require('./billing');

const warnings = [];
const originalWarn = console.warn;
console.warn = (...args) => {
  warnings.push(args.join(' '));
  originalWarn(...args);
};

const fallback = openMembersStore({ databaseUrl: '', silent: false, file: path.join(os.tmpdir(), 'aura-fallback-' + process.pid + '.json') });
assert.strictEqual(fallback.storage, 'file');
assert.ok(warnings.some((line) => line === FILE_WARNING));
console.warn = originalWarn;

const mem = newDb();
const Pg = mem.adapters.createPg();
const pool = new Pg.Pool();
const importFile = path.join(os.tmpdir(), 'aura-import-' + process.pid + '.json');
fs.writeFileSync(importFile, JSON.stringify({
  members: [{
    id: 'import1',
    email: 'imported@example.com',
    name: 'Imported Member',
    salt: 'abc',
    hash: 'def',
    tier: 'elite',
    watchlist: ['XAUUSD'],
    alerts: [],
    journal: [],
    chart_desk: null,
    google_sub: '',
    stripe_customer_id: '',
    created_at: '2026-01-02T00:00:00.000Z'
  }]
}));

(async () => {
  const store = openMembersStore({ databaseUrl: 'postgres://members', pool, file: importFile, silent: true });
  await store.init();
  const imported = await store.listPublic();
  assert.strictEqual(imported.length, 1);
  assert.strictEqual(imported[0].email, 'imported@example.com');
  assert.strictEqual(imported[0].tier, 'elite');
  assert.ok(!imported[0].hash && !imported[0].salt);

  const created = await store.register({
    name: 'Ada Db',
    email: 'ada.db@example.com',
    password: 'correct-horse',
    acceptRisk: true
  });
  assert.strictEqual(created.tier, 'free');
  const raw = await store.findByEmail('ada.db@example.com');
  assert.ok(passwordMatches('correct-horse', raw));
  assert.strictEqual(raw.hash.length, 64);
  let rejected = false;
  try { await store.login('ada.db@example.com', 'wrong-password', 'db-ip'); } catch (error) { rejected = error.status === 401; }
  assert.ok(rejected);
  const session = await store.login('ada.db@example.com', 'correct-horse', 'db-ip-2');
  assert.strictEqual(session.email, 'ada.db@example.com');
  const cookie = store.sessionCookie(session, false);
  assert.ok(cookie.startsWith('aurafx_member='));
  assert.ok(cookie.includes('HttpOnly'));

  await store.setTier('ada.db@example.com', 'pro');
  assert.strictEqual(tierAllows('pro', 'charts'), true);
  assert.strictEqual(tierAllows('free', 'charts'), false);
  assert.strictEqual((await store.findByEmail('ada.db@example.com')).tier, 'pro');
  const searched = await store.listPublic('ada.db');
  assert.strictEqual(searched.length, 1);
  assert.strictEqual((await store.listPublic('nobody')).length, 0);

  const desk = await store.updateChartDesk(created.id, {
    layout: 2,
    sync: true,
    theme: 'dark',
    panes: [{ id: 'p1', instrument: 'XAUUSD', timeframe: 'H1', style: 'candles', drawings: [{ id: 't1', type: 'hline', a: { time: 10, price: 1.2 } }] }]
  }, ['XAUUSD']);
  assert.strictEqual(desk.panes[0].drawings[0].type, 'hline');
  const again = await store.getChartDesk(created.id);
  assert.strictEqual(again.layout, 2);

  const off = stripeSettings({});
  assert.strictEqual(off.enabled, false);
  let coming = false;
  try { await createCheckoutSession(off, { id: 'x', email: 'a@b.co' }, 'pro', 'https://aurafxelite.com'); } catch (error) { coming = error.status === 503; }
  assert.ok(coming);

  const on = stripeSettings({
    STRIPE_SECRET_KEY: 'sk_test_example',
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
    STRIPE_PRICE_PRO: 'price_pro',
    STRIPE_PRICE_ELITE: 'price_elite'
  });
  assert.strictEqual(on.enabled, true);
  const checkout = await createCheckoutSession(on, raw, 'pro', 'https://aurafxelite.com', {
    checkout: { sessions: { create: async (body) => ({ url: 'https://checkout.stripe.com/c/pay_test', id: 'cs_test', body }) } }
  });
  assert.strictEqual(checkout.url, 'https://checkout.stripe.com/c/pay_test');
  const portal = await createPortalSession(on, 'cus_123', 'https://aurafxelite.com', {
    billingPortal: { sessions: { create: async () => ({ url: 'https://billing.stripe.com/p/session_test' }) } }
  });
  assert.ok(portal.url.includes('billing.stripe.com'));

  const secret = 'whsec_test';
  const event = {
    id: 'evt_1',
    type: 'checkout.session.completed',
    data: { object: { customer: 'cus_ada', customer_email: 'ada.db@example.com', metadata: { tier: 'elite' } } }
  };
  const payload = JSON.stringify(event);
  const stamp = Math.floor(Date.now() / 1000);
  const header = 't=' + stamp + ',v1=' + signStripePayload(secret, stamp, payload);
  const applied = await handleWebhook(on, payload, header, store, Date.now());
  assert.strictEqual(applied.tier, 'elite');
  assert.strictEqual((await store.findByEmail('ada.db@example.com')).tier, 'elite');
  assert.strictEqual((await store.findByStripeCustomer('cus_ada')).email, 'ada.db@example.com');
  const replay = await handleWebhook(on, payload, header, store, Date.now());
  assert.strictEqual(replay.duplicate, true);

  let badSig = false;
  try {
    await handleWebhook(on, payload, 't=' + stamp + ',v1=' + 'ab'.repeat(32), store, Date.now());
  } catch (error) {
    badSig = error.status === 400;
  }
  assert.ok(badSig);

  const deleted = { id: 'evt_2', type: 'customer.subscription.deleted', data: { object: { customer: 'cus_ada' } } };
  const deletedPayload = JSON.stringify(deleted);
  const deletedHeader = 't=' + stamp + ',v1=' + signStripePayload(secret, stamp, deletedPayload);
  await handleWebhook(on, deletedPayload, deletedHeader, store, Date.now());
  assert.strictEqual((await store.findByEmail('ada.db@example.com')).tier, 'free');
  assert.strictEqual(tierAllows('free', 'journal'), false);

  const pages = ['pricing.html', 'owner-members.html', 'index.html'];
  pages.forEach((name) => {
    const html = fs.readFileSync(path.join(__dirname, 'public', name), 'utf8');
    assert.ok(!/parslia/i.test(html), name);
    assert.ok(/support@aurafxelite.com/.test(html), name);
  });
  const pricingJs = fs.readFileSync(path.join(__dirname, 'public', 'js', 'platform-home.js'), 'utf8');
  assert.ok(pricingJs.includes('Coming soon'));
  assert.ok(pricingJs.includes('data-checkout'));
  console.log('member db and billing tests ok');
  await pool.end();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
