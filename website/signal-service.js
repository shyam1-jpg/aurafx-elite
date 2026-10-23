'use strict';

const { assessSetup, DISCLAIMER } = require('./signal-math');
const { INSTRUMENTS, loadAll } = require('./market-candles');
const { applyRationales } = require('./signal-rationale');
const { createTracker } = require('./signal-tracker');

const tracker = createTracker();
const rationaleCache = new Map();
let boardCache = null;
let inflight = null;

function unavailable(instrument, errors) {
  const setup = assessSetup(instrument, { h1: [], d1: [] }, { now: new Date() });
  setup.blockers = ['Price history is unavailable for this instrument.'];
  setup.data_quality = 'unavailable';
  setup.feed_errors = errors || [];
  return setup;
}

async function computeBoard(options) {
  const opts = options || {};
  const started = Date.now();
  const loaded = await loadAll({ force: !!opts.force, symbols: opts.symbols, fetchImpl: opts.fetchImpl });
  const news = opts.news || {};
  const now = opts.now instanceof Date ? opts.now : new Date();
  const candleMap = {};
  const setups = loaded.map((row) => {
    candleMap[row.instrument.id] = row.h1 || [];
    if (!row.h1 || row.h1.length < 80) return unavailable(row.instrument, row.errors);
    const setup = assessSetup(row.instrument, { h1: row.h1, d1: row.d1 }, {
      now,
      newsImminent: !!news.newsImminent,
      newsCurrency: news.newsCurrency,
      newsTitle: news.newsTitle
    });
    setup.source = row.source;
    setup.feed = row.feed;
    setup.feed_note = row.feed_note;
    return setup;
  });
  const llm = await applyRationales(setups, { fetchImpl: opts.fetchImpl, cache: rationaleCache });
  const tracked = await tracker.sync(setups, candleMap, now);
  const sources = [...new Set(setups.map((s) => s.source).filter(Boolean))];
  const board = {
    ok: true,
    updated_at: new Date().toISOString(),
    scan_ms: Date.now() - started,
    source: sources.length ? sources.join(' + ') : 'unavailable',
    llm: {
      rationale: llm.provider === 'openai' ? 'openai' : 'engine',
      model: llm.model,
      note: llm.provider === 'openai'
        ? 'The language model rewrites wording only. Direction and levels stay with the rule engine.'
        : 'Rationales are written by the rule engine. Set AI_RATIONALE_PROVIDER=openai and OPENAI_API_KEY to let a language model rewrite them.'
    },
    publication_rule: 'Buy or Sell is published only when trend, momentum, structure and higher timeframes agree, volatility is normal, news is clear, and risk/reward is at least 1.8.',
    price_note: 'Forex candles come from the spot-style feed. Gold, silver, oil, gas and copper use exchange futures (GC, SI, CL, BZ, NG, HG) unless Twelve Data spot symbols are configured. These are not your broker\'s executable quotes, and spread is not included.',
    signals: setups,
    summary: {
      buy: setups.filter((s) => s.action === 'BUY').length,
      sell: setups.filter((s) => s.action === 'SELL').length,
      wait: setups.filter((s) => s.action === 'WAIT').length,
      scanned: setups.length
    },
    tracker: tracked,
    disclaimer: DISCLAIMER
  };
  boardCache = { at: Date.now(), payload: board };
  return board;
}

function getBoard(options) {
  const opts = options || {};
  const ttl = Number(process.env.SIGNAL_CACHE_MS) || 60000;
  if (!opts.force && boardCache && Date.now() - boardCache.at < ttl) {
    return Promise.resolve(boardCache.payload);
  }
  if (inflight && !opts.force) return inflight;
  inflight = computeBoard(opts).finally(() => { inflight = null; });
  return inflight;
}

module.exports = {
  getBoard,
  INSTRUMENTS,
  DISCLAIMER
};
