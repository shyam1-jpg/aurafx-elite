'use strict';

const { assessSetup, barOutcome, DISCLAIMER } = require('./signal-math');
const { summariseRecords } = require('./signal-tracker');

const MAX_HOLD_BARS = 48;

function backtestInstrument(instrument, h1, d1, options) {
  const opts = options || {};
  const maxHold = opts.maxHoldBars || MAX_HOLD_BARS;
  const trades = [];
  let open = null;
  const start = Math.max(80, opts.warmup || 80);
  for (let i = start; i < h1.length; i++) {
    const bar = h1[i];
    const now = new Date(bar.t);
    let closedThisBar = false;
    if (open && i > open.bar_index) {
      const hit = barOutcome(open, bar);
      if (hit) {
        trades.push({ ...open, ...hit, closed_at: bar.t });
        open = null;
        closedThisBar = true;
      } else if (i - open.bar_index >= maxHold) {
        const risk = Math.abs(open.entry - open.stop_loss);
        const diff = open.action === 'BUY' ? bar.c - open.entry : open.entry - bar.c;
        trades.push({
          ...open,
          status: 'expired',
          result_r: risk ? Math.round((diff / risk) * 100) / 100 : 0,
          close_price: bar.c,
          closed_at: bar.t
        });
        open = null;
        closedThisBar = true;
      }
    }
    if (open || closedThisBar) continue;
    const d1slice = (d1 || []).filter((c) => new Date(c.t).getTime() <= now.getTime());
    const setup = assessSetup(instrument, { h1: h1.slice(0, i + 1), d1: d1slice }, {
      now,
      newsImminent: false
    });
    if (!setup.published) continue;
    open = {
      instrument: instrument.id,
      name: instrument.name,
      action: setup.action,
      confidence: setup.confidence,
      entry: setup.entry,
      stop_loss: setup.stop_loss,
      take_profit_1: setup.take_profit_1,
      take_profit_2: setup.take_profit_2,
      risk_reward: setup.risk_reward,
      opened_at: bar.t,
      bar_index: i,
      status: 'open'
    };
  }
  if (open) trades.push(open);
  return {
    instrument: instrument.id,
    name: instrument.name,
    bars: h1.length,
    trade_count: trades.length,
    measured: summariseRecords(trades),
    recent: trades.slice(-12),
    trades
  };
}

function backtestAll(seriesById, instruments, options) {
  const perInstrument = {};
  const allTrades = [];
  for (const instrument of instruments) {
    const series = seriesById[instrument.id];
    if (!series || !series.h1 || series.h1.length < 100) {
      perInstrument[instrument.id] = {
        instrument: instrument.id,
        name: instrument.name,
        skipped: true,
        reason: 'Not enough candles'
      };
      continue;
    }
    const result = backtestInstrument(instrument, series.h1, series.d1 || [], options);
    allTrades.push(...result.trades);
    perInstrument[instrument.id] = {
      instrument: result.instrument,
      name: result.name,
      bars: result.bars,
      trade_count: result.trade_count,
      measured: result.measured,
      recent: result.recent
    };
  }
  return {
    disclaimer: DISCLAIMER,
    note: 'Historical measurement of this rule set on completed candles. If a bar touches both the stop and a target, it counts as a stop. Expired trades are excluded from win rate. This is not a forecast.',
    per_instrument: perInstrument,
    overall: summariseRecords(allTrades)
  };
}

module.exports = { backtestInstrument, backtestAll, MAX_HOLD_BARS };
