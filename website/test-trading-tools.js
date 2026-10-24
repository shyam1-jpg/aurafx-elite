'use strict';
const assert = require('node:assert/strict');
const { quote, validAlert, step } = require('./public/js/trading-tools-core');
const now = Date.now();
const payload = { live: true, forex: { EURUSD: 1.1 }, symbolTimes: { EURUSD: new Date(now).toISOString() } };
assert.equal(quote(payload, 'EURUSD', now).price, 1.1);
assert.equal(quote({ ...payload, live: false }, 'EURUSD', now), null);
assert.equal(quote({ ...payload, symbolTimes: {} }, 'EURUSD', now), null);
assert.equal(quote(payload, 'EURUSD', now + 120001), null);
assert.equal(quote(payload, 'EURUSD', now - 31000), null);
assert.equal(quote(payload, 'invalid', now), null);
const up = { id: '1', symbol: 'EURUSD', direction: 'above', target: 1.11 };
assert(validAlert(up));
assert(!validAlert({ ...up, target: -1 }));
assert(!validAlert({ ...up, target: Infinity }));
assert(!validAlert({ ...up, symbol: '__proto__' }));
assert(!step(up, { price: 1.1, at: now }));
assert(step(up, { price: 1.11, at: now + 1000 }));
assert(!step(up, { price: 1.12, at: now + 2000 }));
const down = { ...up, direction: 'below', target: 1.09, triggeredAt: null, previous: undefined, previousAt: undefined };
assert(!step(down, { price: 1.1, at: now }));
assert(!step(down, { price: 1.08, at: now })); // duplicate timestamp
assert(step(down, { price: 1.09, at: now + 1000 }));
const gap = { id: '3', symbol: 'EURUSD', direction: 'above', target: 1.11 };
assert(!step(gap, { price: 1.1, at: now }));
assert(!step(gap, { price: 1.12, at: now + 121000 })); // no replay across gap
assert(!step(gap, null));
assert(!step(gap, { price: 1.12, at: now + 122000 })); // re-arm after outage
console.log('Trading tools tests passed: fresh per-symbol quotes, both crossing directions, one-shot alerts, duplicates and outages.');
