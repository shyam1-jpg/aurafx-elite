'use strict';

const BANNED = /guarant|certain profit|sure win|risk[- ]free|always (profit|win)|(\b80\b|\b90\b|\b96\b|\b100\b)\s*%|%\s*accura/i;

function confidenceSentence(setup) {
  if (setup.confidence_calibrated) {
    return 'The confidence figure is a measured rate from ' + (setup.confidence_sample || 'the closed') +
      ' closed signals, not a forecast.';
  }
  return 'The confidence figure is setup quality, not a predicted win rate.';
}

function engineRationale(setup) {
  const name = setup.name || setup.instrument;
  const regime = setup.regime_note ? setup.regime_note + ' ' : '';
  if (setup.action === 'BUY' || setup.action === 'SELL') {
    const word = setup.action === 'BUY' ? 'Buy' : 'Sell';
    const aligned = setup.action === 'BUY' ? 'bullish' : 'bearish';
    const notes = (setup.factors || [])
      .filter((f) => f.state === aligned || f.key === 'volatility')
      .map((f) => f.note)
      .slice(0, 3);
    const joined = notes.join(' ');
    const rr = setup.risk_reward != null ? setup.risk_reward : '2';
    return word + ' bias on ' + name + '. ' + regime + joined +
      ' Entry is the latest price, the stop sits beyond recent structure using ATR, and the first target is ' +
      rr + 'R. ' + confidenceSentence(setup);
  }
  const why = (setup.blockers && setup.blockers[0]) ||
    ('Confluence is incomplete (' + (setup.factors || []).map((f) => f.label + ' ' + (f.state === 'clear' ? 'normal' : f.state)).join(', ') + ').');
  return 'Wait on ' + name + '. ' + regime + why + ' No entry, stop or target is published until the rules for this regime pass.';
}

function acceptableRationale(text) {
  if (typeof text !== 'string') return false;
  const t = text.trim();
  if (t.length < 40 || t.length > 520) return false;
  if (BANNED.test(t)) return false;
  return true;
}

function outputText(payload) {
  if (payload && typeof payload.output_text === 'string') return payload.output_text;
  const parts = [];
  for (const item of (payload && payload.output) || []) {
    for (const content of item.content || []) {
      if (typeof content.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('\n');
}

async function rewriteWithOpenAI(setup, fallback, fetchImpl) {
  const key = String(process.env.OPENAI_API_KEY || '').trim();
  const model = String(process.env.OPENAI_MODEL || 'gpt-4o-mini').trim();
  const fetchFn = fetchImpl || global.fetch;
  if (typeof fetchFn !== 'function') throw new Error('HTTP client unavailable');
  const instructions = 'You rewrite a trading-desk note in plain English. Keep the same Buy, Sell or Wait decision. Do not invent prices. Do not claim a win rate, accuracy percentage, guaranteed profit, or certainty. Two or three sentences. No markdown.';
  const input = JSON.stringify({
    action: setup.action,
    instrument: setup.name,
    confidence_is: setup.confidence_calibrated
      ? 'measured rate from closed signals, not a forecast'
      : 'setup quality score, not a win probability',
    regime: setup.regime,
    regime_note: setup.regime_note,
    entry: setup.entry,
    stop_loss: setup.stop_loss,
    take_profit_1: setup.take_profit_1,
    take_profit_2: setup.take_profit_2,
    risk_reward: setup.risk_reward,
    factors: setup.factors,
    blockers: setup.blockers,
    draft: fallback
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetchFn('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ model, instructions, input, max_output_tokens: 280 })
    });
    if (!response.ok) throw new Error('OpenAI request failed');
    const payload = await response.json();
    return String(outputText(payload) || '').trim();
  } finally {
    clearTimeout(timer);
  }
}

async function applyRationales(setups, options) {
  const opts = options || {};
  const provider = String(process.env.AI_RATIONALE_PROVIDER || '').trim().toLowerCase();
  const keyOn = !!String(process.env.OPENAI_API_KEY || '').trim();
  const llmOn = provider === 'openai' && keyOn;
  const cache = opts.cache || new Map();
  for (const setup of setups) {
    const draft = engineRationale(setup);
    setup.rationale = draft;
    setup.rationale_source = 'engine';
    if (!llmOn || setup.action === 'WAIT') continue;
    const cacheKey = [setup.instrument, setup.action, setup.entry, setup.stop_loss, setup.take_profit_1].join('|');
    if (cache.has(cacheKey)) {
      setup.rationale = cache.get(cacheKey);
      setup.rationale_source = 'openai';
      continue;
    }
    try {
      const text = await rewriteWithOpenAI(setup, draft, opts.fetchImpl);
      if (acceptableRationale(text)) {
        setup.rationale = text;
        setup.rationale_source = 'openai';
        cache.set(cacheKey, text);
      }
    } catch (_) {
      setup.rationale_source = 'engine';
    }
  }
  return {
    provider: llmOn ? 'openai' : 'off',
    model: llmOn ? String(process.env.OPENAI_MODEL || 'gpt-4o-mini').trim() : null
  };
}

module.exports = {
  engineRationale,
  acceptableRationale,
  applyRationales
};
