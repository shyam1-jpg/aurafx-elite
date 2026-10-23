'use strict';

const { DISCLAIMER } = require('./signal-math');

const RISK = {
  per_trade_pct: 1,
  max_daily_loss_pct: 3,
  max_weekly_loss_pct: 7,
  max_open_trades: 3,
  auto_trading: 'off',
  note: 'These are the platform defaults. Auto trading is off. A plan restates the current signal and is not an order.'
};

function scenarioFor(signal) {
  const action = signal.action || 'WAIT';
  if (signal.published && (action === 'BUY' || action === 'SELL')) {
    return {
      label: action === 'BUY' ? 'Published buy' : 'Published sell',
      detail: signal.regime_note || ('The ' + (signal.regime || 'current') + ' rules published this ' + action.toLowerCase() + '.')
    };
  }
  const blocker = (signal.blockers && signal.blockers[0]) || signal.regime_note || 'Conditions are not clear enough to publish.';
  return { label: 'Wait', detail: blocker };
}

function buildPlans(board) {
  const signals = (board && Array.isArray(board.signals)) ? board.signals : [];
  const plans = signals.map((signal) => {
    const published = !!(signal && signal.published && (signal.action === 'BUY' || signal.action === 'SELL'));
    return {
      instrument: signal.instrument || null,
      name: signal.name || signal.instrument || 'Market',
      bias: signal.action || 'WAIT',
      regime: signal.regime || null,
      regime_note: signal.regime_note || null,
      price: signal.price == null ? null : signal.price,
      key_levels: published ? {
        entry: signal.entry,
        stop_loss: signal.stop_loss,
        take_profit_1: signal.take_profit_1,
        take_profit_2: signal.take_profit_2 == null ? null : signal.take_profit_2,
        risk_reward: signal.risk_reward
      } : null,
      scenario: scenarioFor(signal),
      blockers: published ? [] : (signal.blockers || []).slice(0, 3),
      confidence: signal.confidence == null ? null : signal.confidence,
      confidence_basis: signal.confidence_basis || null,
      session: signal.session || null,
      note: 'This plan restates the current signal. It is not an order and not a personal recommendation.'
    };
  });
  const stamp = new Date();
  return {
    ok: true,
    updated_at: (board && board.updated_at) || null,
    plan_date: stamp.toISOString().slice(0, 10),
    plans,
    risk: RISK,
    disclaimer: DISCLAIMER
  };
}

module.exports = { buildPlans, RISK };
