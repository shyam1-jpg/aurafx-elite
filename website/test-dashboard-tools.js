'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const elements = {};
for (const [id, value] of Object.entries({ rcBal: '10000', rcRisk: '1', rcStop: '20', rcPip: '10', rcOut: '', 'aurafx-inst-dash': '' })) {
  elements[id] = { value, innerHTML: '', textContent: '', listeners: {}, addEventListener(type, handler) { this.listeners[type] = handler; } };
}
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'public/js/institutional.js'), 'utf8'), {
  document: { readyState: 'complete', getElementById: id => elements[id] || null }
});
const html = elements['aurafx-inst-dash'].innerHTML;
assert(!/undefined|2328|2372|\+4\.2%|Account protection|Compound growth/.test(html));
assert(html.includes('not connected to your broker'));
assert(elements.rcOut.textContent.includes('Risk $100.00'));
assert(elements.rcOut.textContent.includes('0.50'));
elements.rcRisk.value = '0';
elements.rcRisk.listeners.input();
assert(elements.rcOut.textContent.includes('Risk $0.00'));
assert(elements.rcOut.textContent.includes('0.00'));
for (const [field, value] of [['rcStop', '0'], ['rcPip', '-1'], ['rcBal', 'NaN'], ['rcRisk', '101']]) {
  const previous = elements[field].value;
  elements[field].value = value;
  elements[field].listeners.input();
  assert(elements.rcOut.textContent.startsWith('Enter a positive'));
  elements[field].value = previous;
}
console.log('Dashboard tools tests passed: honest empty state, zero risk and invalid inputs.');
