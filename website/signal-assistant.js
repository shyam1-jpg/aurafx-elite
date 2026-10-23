'use strict';

const BANNED = /guarant|certain profit|sure win|risk[- ]free|always (profit|win)|(\b80\b|\b90\b|\b96\b|\b100\b)\s*%|%\s*accura/i;

function llmEnabled() {
  const provider = String(process.env.AI_RATIONALE_PROVIDER || '').trim().toLowerCase();
  const keyOn = !!String(process.env.OPENAI_API_KEY || '').trim();
  return provider === 'openai' && keyOn;
}

function clip(value, max) {
  const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

function describeSignal(signal) {
  const name = signal.name || signal.instrument;
  const regime = signal.regime ? ' in a ' + signal.regime + ' regime' : '';
  if (signal.action === 'BUY' || signal.action === 'SELL') {
    const word = signal.action === 'BUY' ? 'Buy' : 'Sell';
    const basis = signal.confidence_calibrated
      ? 'The confidence number is a measured rate from ' + signal.confidence_sample + ' closed signals, not a forecast.'
      : 'The confidence number is setup quality and is not calibrated yet.';
    return name + ' is ' + word + regime + '. ' + basis +
      ' Entry ' + signal.entry + ', stop ' + signal.stop_loss + ', first target ' + signal.take_profit_1 +
      ', risk/reward ' + signal.risk_reward + 'R.' +
      (signal.session ? ' Session: ' + signal.session + '.' : '');
  }
  const why = (signal.blockers && signal.blockers[0]) || 'The rules for this regime are not met.';
  return name + ' is Wait' + regime + '. ' + why;
}

function regimeSummary(signals) {
  const counts = { trending: 0, ranging: 0, volatile: 0 };
  signals.forEach((signal) => {
    if (counts[signal.regime] != null) counts[signal.regime] += 1;
  });
  const published = signals.filter((signal) => signal.action === 'BUY' || signal.action === 'SELL');
  const names = published.map((signal) => (signal.name || signal.instrument) + ' ' + signal.action).slice(0, 6);
  const publishedText = names.length ? names.join(', ') + '.' : 'No Buy or Sell is published right now.';
  return 'Across ' + signals.length + ' instruments, ' + counts.trending + ' are trending, ' +
    counts.ranging + ' are ranging, and ' + counts.volatile + ' are volatile. ' + publishedText;
}

function riskParagraph(board) {
  const measured = (board && board.tracker && board.tracker.measured) || {};
  const resolved = Number(measured.resolved) || 0;
  const wins = Number(measured.wins) || 0;
  const losses = Number(measured.losses) || 0;
  const sample = resolved
    ? ' The tracker has ' + wins + ' take-profit and ' + losses + ' stop results from ' + resolved + ' closed signals.'
    : ' The tracker has no closed signals yet, so there is no measured win rate.';
  const small = resolved && resolved < 8 ? ' That sample is small and is not a forecast.' : '';
  return 'Default risk is 1% per trade, 3% maximum daily loss, 7% maximum weekly loss, and at most 3 open trades. Auto trading is off.' +
    sample + small;
}

function engineAnswer(question, board) {
  const q = String(question || '').toLowerCase();
  const signals = (board && board.signals) || [];
  const named = signals.find((signal) => {
    const id = String(signal.instrument || '').toLowerCase();
    const name = String(signal.name || '').toLowerCase();
    return (id && q.includes(id)) || (name.length > 3 && q.includes(name));
  });
  const parts = [];
  if (named) parts.push(describeSignal(named));
  else if (/regime|trend|rang|volatil|market/.test(q)) parts.push(regimeSummary(signals));
  else parts.push(regimeSummary(signals));
  if (/risk|lot|size|drawdown|loss|account/.test(q) || !named) parts.push(riskParagraph(board));
  else parts.push('Nothing on this board is sent to a broker.');
  parts.push('This is analysis only and it is not a forecast.');
  return parts.join(' ');
}

function contextForModel(question, board) {
  const signals = ((board && board.signals) || []).map((signal) => ({
    instrument: signal.instrument,
    name: signal.name,
    action: signal.action,
    regime: signal.regime,
    regime_note: clip(signal.regime_note, 180),
    confidence: signal.confidence,
    confidence_calibrated: !!signal.confidence_calibrated,
    confidence_basis: clip(signal.confidence_basis, 180),
    entry: signal.entry,
    stop_loss: signal.stop_loss,
    take_profit_1: signal.take_profit_1,
    risk_reward: signal.risk_reward,
    blockers: (signal.blockers || []).slice(0, 2),
    session: signal.session
  }));
  const measured = (board && board.tracker && board.tracker.measured) || {};
  return {
    question: clip(question, 500),
    risk_defaults: {
      per_trade: '1%',
      max_daily_loss: '3%',
      max_weekly_loss: '7%',
      max_open_trades: 3,
      auto_trading: 'off'
    },
    measured: {
      resolved: measured.resolved || 0,
      wins: measured.wins || 0,
      losses: measured.losses || 0,
      average_r: measured.average_r,
      open: measured.open || 0,
      small_sample: (measured.resolved || 0) < 8
    },
    signals
  };
}

function acceptableAnswer(text) {
  if (typeof text !== 'string') return false;
  const t = text.trim();
  if (t.length < 40 || t.length > 900) return false;
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

async function askModel(question, board, fetchImpl) {
  const key = String(process.env.OPENAI_API_KEY || '').trim();
  const model = String(process.env.OPENAI_MODEL || 'gpt-4o-mini').trim();
  const fetchFn = fetchImpl || global.fetch;
  if (typeof fetchFn !== 'function') throw new Error('HTTP client unavailable');
  const instructions = 'You answer a trader using only the JSON context. Plain English, four sentences or fewer. Do not invent prices, signals, or statistics. Do not claim a win rate, an accuracy percentage, guaranteed profit, or certainty. If the context does not contain the answer, say so. No markdown.';
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
      body: JSON.stringify({
        model,
        instructions,
        input: JSON.stringify(contextForModel(question, board)),
        max_output_tokens: 320
      })
    });
    if (!response.ok) throw new Error('OpenAI request failed');
    const payload = await response.json();
    return String(outputText(payload) || '').trim();
  } finally {
    clearTimeout(timer);
  }
}

async function answer(question, board, options) {
  const opts = options || {};
  const q = String(question || '').trim();
  if (!q || q.length > 500) {
    return {
      ok: false,
      error: 'Ask a question of up to 500 characters.',
      source: 'engine',
      answer: ''
    };
  }
  const fallback = engineAnswer(q, board || {});
  const noteOff = 'No language-model key is configured, so this answer comes from the signal engine and the current board.';
  if (!llmEnabled()) {
    return { ok: true, answer: fallback, source: 'engine', note: noteOff };
  }
  try {
    const text = await askModel(q, board || {}, opts.fetchImpl);
    if (!acceptableAnswer(text)) {
      return {
        ok: true,
        answer: fallback,
        source: 'engine',
        note: 'The language-model reply was rejected, so the engine answer is shown.'
      };
    }
    return {
      ok: true,
      answer: text,
      source: 'openai',
      note: 'The language model answered from the current board only. Direction and levels still come from the rule engine.'
    };
  } catch (_) {
    return {
      ok: true,
      answer: fallback,
      source: 'engine',
      note: 'The language model could not be reached, so the engine answer is shown.'
    };
  }
}

module.exports = {
  answer,
  engineAnswer,
  acceptableAnswer,
  llmEnabled,
  BANNED
};
