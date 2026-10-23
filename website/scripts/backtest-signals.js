'use strict';

/**
 * Honest walk-forward measurement of the Aura signal rules.
 * Usage (from the website folder):
 *   node scripts/backtest-signals.js
 *   node scripts/backtest-signals.js --symbols EURUSD,XAUUSD,USOIL
 *   node scripts/backtest-signals.js --out data/backtest-last.json
 *
 * Prints measured win rate, average R and sample size. It does not claim future accuracy.
 */

const fs = require('fs');
const path = require('path');
const { INSTRUMENTS, loadAll } = require('../market-candles');
const { backtestAll } = require('../signal-backtest');

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith('--' + name + '='));
  if (hit) return hit.split('=').slice(1).join('=');
  const idx = process.argv.indexOf('--' + name);
  if (idx >= 0 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('--')) return process.argv[idx + 1];
  return '';
}

function pct(rate) {
  if (rate == null) return 'n/a';
  return (Math.round(rate * 1000) / 10) + '%';
}

async function main() {
  const symbols = arg('symbols')
    ? arg('symbols').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
    : null;
  const instruments = symbols ? INSTRUMENTS.filter((i) => symbols.includes(i.id)) : INSTRUMENTS;
  if (!instruments.length) {
    console.error('No matching instruments.');
    process.exitCode = 1;
    return;
  }
  console.log('Loading historical candles for ' + instruments.map((i) => i.id).join(', ') + '…');
  const loaded = await loadAll({ symbols: instruments.map((i) => i.id), force: true });
  const series = {};
  loaded.forEach((row) => {
    series[row.instrument.id] = { h1: row.h1, d1: row.d1 };
    console.log(row.instrument.id + ': H1 ' + row.h1.length + ' · D1 ' + row.d1.length + (row.source ? ' · ' + row.source : ' · no feed'));
  });
  const report = backtestAll(series, instruments);
  console.log('\n' + report.note);
  console.log(report.disclaimer);
  console.log('\nInstrument        Trades  Resolved  Win rate   Avg R');
  instruments.forEach((inst) => {
    const row = report.per_instrument[inst.id];
    if (!row || row.skipped) {
      console.log(inst.id.padEnd(16) + '  skipped');
      return;
    }
    const m = row.measured;
    console.log(
      inst.id.padEnd(16) +
      String(row.trade_count).padStart(6) +
      String(m.resolved).padStart(10) +
      pct(m.win_rate).padStart(10) +
      String(m.average_r == null ? 'n/a' : m.average_r.toFixed(2)).padStart(8)
    );
  });
  const overall = report.overall;
  console.log('\nOverall resolved: ' + overall.resolved +
    '  wins: ' + overall.wins +
    '  losses: ' + overall.losses +
    '  expired: ' + overall.expired +
    '  open at end: ' + overall.open);
  console.log('Measured win rate: ' + pct(overall.win_rate) +
    '   average R: ' + (overall.average_r == null ? 'n/a' : overall.average_r) +
    '   profit factor: ' + (overall.profit_factor == null ? (overall.profit_factor_note || 'n/a') : overall.profit_factor));
  console.log('Win-rate basis: ' + overall.win_rate_basis);

  const out = arg('out');
  if (out) {
    const dest = path.resolve(process.cwd(), out);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, JSON.stringify(report, null, 2));
    console.log('\nWrote ' + dest);
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
