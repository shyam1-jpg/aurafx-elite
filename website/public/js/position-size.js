/**
 * Lot size from a signal's stop distance.
 * Standard contracts: forex 100,000 base units, gold 100 oz, silver 5,000 oz.
 * Works in the browser and in Node tests. This does not place a trade.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AuraPositionSize = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'];

  function contractFor(instrument) {
    const id = String(instrument || '').toUpperCase();
    if (id === 'XAUUSD') return { contract: 100, quote: 'USD', label: '100 oz' };
    if (id === 'XAGUSD') return { contract: 5000, quote: 'USD', label: '5,000 oz' };
    if (id === 'USOIL' || id === 'UKOIL') return { contract: 1000, quote: 'USD', label: '1,000 barrels' };
    if (id === 'NATGAS') return { contract: 10000, quote: 'USD', label: '10,000 MMBtu' };
    if (id === 'COPPER') return { contract: 25000, quote: 'USD', label: '25,000 lb' };
    if (/^[A-Z]{6}$/.test(id)) return { contract: 100000, quote: id.slice(3), label: '100,000 ' + id.slice(0, 3) };
    return null;
  }

  function quoteOf(pair, table) {
    const direct = Number(table[pair]);
    if (direct > 0) return direct;
    return null;
  }

  function usdPerUnit(currency, table) {
    const code = String(currency || '').toUpperCase();
    if (code === 'USD') return 1;
    const straight = quoteOf(code + 'USD', table);
    if (straight) return straight;
    const inverted = quoteOf('USD' + code, table);
    if (inverted) return 1 / inverted;
    return null;
  }

  function convert(amount, from, to, table) {
    const source = String(from || '').toUpperCase();
    const target = String(to || '').toUpperCase();
    if (source === target) return amount;
    const fromUsd = usdPerUnit(source, table);
    const toUsd = usdPerUnit(target, table);
    if (!(fromUsd > 0) || !(toUsd > 0)) return null;
    return amount * fromUsd / toUsd;
  }

  function calculate(input) {
    const data = input || {};
    const balance = Number(data.balance);
    const riskPct = Number(data.risk_pct);
    const entry = Number(data.entry);
    const stop = Number(data.stop != null ? data.stop : data.stop_loss);
    const account = String(data.account_currency || 'USD').toUpperCase();
    const instrument = String(data.instrument || '').toUpperCase();
    if (!(balance > 0)) return { ok: false, error: 'Enter an account size above zero.' };
    if (!(riskPct > 0) || riskPct > 5) return { ok: false, error: 'Risk must be above 0 and at most 5% per trade.' };
    if (!CURRENCIES.includes(account)) return { ok: false, error: 'Choose a supported account currency.' };
    const distance = Math.abs(entry - stop);
    if (!(distance > 0)) return { ok: false, error: 'This signal has no stop distance.' };
    const spec = contractFor(instrument);
    if (!spec) return { ok: false, error: 'No standard contract is set for this instrument.' };
    const rates = Object.assign({}, data.rates || {});
    if (Number(data.price) > 0) rates[instrument] = Number(data.price);
    else if (entry > 0) rates[instrument] = entry;
    const quoteLoss = distance * spec.contract;
    const accountLoss = convert(quoteLoss, spec.quote, account, rates);
    if (!(accountLoss > 0)) {
      return { ok: false, error: 'A ' + spec.quote + ' to ' + account + ' rate is not on the board yet.' };
    }
    const riskMoney = balance * (riskPct / 100);
    const rawLots = riskMoney / accountLoss;
    const lots = Math.round(rawLots * 100) / 100;
    return {
      ok: true,
      instrument,
      lots: lots > 0 ? lots : Math.round(rawLots * 10000) / 10000,
      below_min_lot: lots <= 0,
      risk_money: Math.round(riskMoney * 100) / 100,
      loss_per_lot: Math.round(accountLoss * 100) / 100,
      account_currency: account,
      contract_label: spec.label,
      quote: spec.quote,
      note: 'Standard contract estimate. Your broker contract and spread can differ. This does not place a trade.'
    };
  }

  return { CURRENCIES, contractFor, calculate };
});
