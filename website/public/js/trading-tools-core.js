(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AuraTradingTools = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const symbols = {
    XAUUSD: { name: 'Gold', group: 'metals', chart: 'OANDA:XAUUSD', digits: 2 },
    XAGUSD: { name: 'Silver', group: 'metals', chart: 'OANDA:XAGUSD', digits: 3 },
    EURUSD: { name: 'EUR/USD', group: 'forex', chart: 'FX:EURUSD', digits: 5 },
    GBPUSD: { name: 'GBP/USD', group: 'forex', chart: 'FX:GBPUSD', digits: 5 },
    USDJPY: { name: 'USD/JPY', group: 'forex', chart: 'FX:USDJPY', digits: 3 },
    AUDUSD: { name: 'AUD/USD', group: 'forex', chart: 'FX:AUDUSD', digits: 5 },
    BTC: { name: 'Bitcoin', group: 'crypto', chart: 'COINBASE:BTCUSD', digits: 2 },
    ETH: { name: 'Ethereum', group: 'crypto', chart: 'COINBASE:ETHUSD', digits: 2 }
  };
  function quote(payload, symbol, now) {
    const config = symbols[symbol];
    if (!config) return null;
    const price = Number(payload?.[config.group]?.[symbol]);
    const at = Date.parse(payload?.symbolTimes?.[symbol]);
    const age = now - at;
    // Require a timestamp for this instrument, never the aggregate fetch time.
    if (!payload?.live || !Number.isFinite(price) || price <= 0 || !Number.isFinite(at) || age < -30000 || age > 120000) return null;
    return { price, at };
  }
  function validAlert(a) {
    return a && typeof a.id === 'string' && a.id.length <= 100 && Object.hasOwn(symbols, a.symbol) &&
      ['above', 'below'].includes(a.direction) && typeof a.target === 'number' && Number.isFinite(a.target) && a.target > 0;
  }
  function step(alert, sample) {
    if (alert.triggeredAt) return false;
    if (!sample) { delete alert.previous; delete alert.previousAt; return false; }
    if (sample.at <= (alert.previousAt || 0)) return false;
    const prev = alert.previous;
    const gap = sample.at - (alert.previousAt || 0);
    alert.previous = sample.price;
    alert.previousAt = sample.at;
    if (!Number.isFinite(prev) || gap > 120000) return false;
    const hit = alert.direction === 'above'
      ? prev < alert.target && sample.price >= alert.target
      : prev > alert.target && sample.price <= alert.target;
    if (hit) alert.triggeredAt = new Date(sample.at).toISOString();
    return hit;
  }
  return { symbols, quote, validAlert, step };
});
