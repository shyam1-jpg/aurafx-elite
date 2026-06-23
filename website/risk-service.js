'use strict';

/**
 * Aura Elite FX — risk management calculator & default limits.
 */

const DEFAULTS = {
  risk_per_trade_pct: 1.0,
  max_daily_loss_pct: 3.0,
  max_weekly_loss_pct: 7.0,
  max_open_trades: 3,
  auto_trading_enabled: false,
  trading_mode: 'analysis_only' // analysis_only | manual_confirm | auto_expert
};

const TRADING_MODES = {
  analysis_only: {
    id: 'analysis_only',
    label: 'Analysis Only',
    description: 'Market analysis and signals only. No trades placed.',
    can_execute: false
  },
  manual_confirm: {
    id: 'manual_confirm',
    label: 'Manual Confirmation',
    description: 'Signals shown; you confirm each trade action.',
    can_execute: true
  },
  auto_expert: {
    id: 'auto_expert',
    label: 'Auto Trading / Expert Mode',
    description: 'Automated execution after risk limits and consent. Disabled by default.',
    can_execute: true,
    requires_consent: true
  }
};

function pipSize(pair) {
  const p = String(pair || 'EURUSD').toUpperCase();
  if (p.includes('JPY') && !p.startsWith('XAU') && !p.startsWith('XAG')) return 0.01;
  if (p.startsWith('XAU') || p.startsWith('XAG')) return 0.1;
  return 0.0001;
}

function pipValuePerLot(pair, accountCurrency) {
  const p = String(pair || 'EURUSD').toUpperCase();
  const cur = String(accountCurrency || 'USD').toUpperCase();
  if (p.startsWith('XAU')) return cur === 'GBP' ? 8.5 : 10;
  if (p.startsWith('XAG')) return cur === 'GBP' ? 40 : 50;
  if (p.endsWith('USD')) return 10;
  if (p.startsWith('USD') && p.endsWith('JPY')) return 9.2;
  return 8;
}

function calculateLotSize(input) {
  const balance = Number(input.balance) || 10000;
  const riskPct = Number(input.risk_pct) || DEFAULTS.risk_per_trade_pct;
  const slPips = Number(input.stop_loss_pips) || 25;
  const pair = String(input.pair || 'EURUSD').toUpperCase();
  const accountCurrency = input.account_currency || 'USD';

  const riskMoney = balance * (riskPct / 100);
  const pipVal = pipValuePerLot(pair, accountCurrency);
  const lots = slPips > 0 ? riskMoney / (slPips * pipVal) : 0;
  const lotsRounded = Math.max(0.01, Math.round(lots * 100) / 100);

  return {
    balance,
    risk_pct: riskPct,
    risk_money: Math.round(riskMoney * 100) / 100,
    pair,
    stop_loss_pips: slPips,
    pip_value_per_lot: pipVal,
    suggested_lots: lotsRounded,
    max_daily_loss: Math.round(balance * DEFAULTS.max_daily_loss_pct / 100 * 100) / 100,
    max_weekly_loss: Math.round(balance * DEFAULTS.max_weekly_loss_pct / 100 * 100) / 100,
    defaults: DEFAULTS,
    disclaimer: 'Calculator is educational. Verify lot size with your broker before trading.'
  };
}

function getPlatformRiskConfig() {
  return {
    defaults: DEFAULTS,
    trading_modes: TRADING_MODES,
    emergency_stop_available: true,
    disclaimer: 'Aura Elite FX is an AI-assisted trading analysis tool. It does not guarantee profit.'
  };
}

module.exports = {
  DEFAULTS,
  TRADING_MODES,
  calculateLotSize,
  getPlatformRiskConfig,
  pipSize,
  pipValuePerLot
};
