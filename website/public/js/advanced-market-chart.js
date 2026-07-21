/**
 * AuraFX advanced market canvas.
 * Visual context only: deterministic synthetic OHLC is anchored to the latest
 * available quote until the backend supplies timestamped broker candles.
 */
(function () {
  'use strict';

  const canvas = document.getElementById('auraCandlestickChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const state = { symbol: 'XAUUSD', timeframe: 'H1', candles: [], hover: -1, width: 0, height: 0, aiResult: null, aiLoading: false };
  const configs = {
    XAUUSD: { base: 2400, digits: 2, volatility: 0.0038 },
    EURUSD: { base: 1.085, digits: 5, volatility: 0.0012 },
    GBPUSD: { base: 1.275, digits: 5, volatility: 0.0014 },
    USDJPY: { base: 155.2, digits: 3, volatility: 0.0013 }
  };
  const tfScale = { M15: 0.65, H1: 1, H4: 1.5, D1: 2.2 };

  const $ = (id) => document.getElementById(id);
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  function hash(input) {
    let h = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function random(seed) {
    let x = seed || 1;
    return function () {
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
      return (x >>> 0) / 4294967296;
    };
  }

  function liveQuote(symbol) {
    const q = window.AURAFX_LIVE_QUOTES;
    if (!q) return null;
    const groups = [q.forex, q.metals, q.crypto];
    for (const group of groups) {
      if (group && Number(group[symbol]) > 0) return Number(group[symbol]);
    }
    return null;
  }

  function series(count) {
    const cfg = configs[state.symbol];
    const anchor = liveQuote(state.symbol) || cfg.base;
    const rng = random(hash(state.symbol + state.timeframe + new Date().toISOString().slice(0, 10)));
    const scale = cfg.volatility * (tfScale[state.timeframe] || 1);
    const items = [];
    let close = anchor * (1 - (rng() - 0.2) * scale * 10);

    for (let i = 0; i < count; i += 1) {
      const drift = (rng() - 0.47) * scale;
      const open = close;
      close = Math.max(open * 0.25, open * (1 + drift));
      const wick = open * scale * (0.28 + rng() * 0.95);
      items.push({
        open,
        close,
        high: Math.max(open, close) + wick * rng(),
        low: Math.min(open, close) - wick * rng(),
        volume: 25 + rng() * 75,
        time: i
      });
    }

    const delta = anchor - items[items.length - 1].close;
    items.forEach((c, i) => {
      const correction = delta * (i / (items.length - 1));
      c.open += correction; c.close += correction; c.high += correction; c.low += correction;
    });
    return items;
  }

  function ema(values, period) {
    const out = [];
    const k = 2 / (period + 1);
    values.forEach((v, i) => { out[i] = i ? v * k + out[i - 1] * (1 - k) : v; });
    return out;
  }

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    state.width = Math.max(520, rect.width);
    state.height = Math.max(420, rect.height);
    canvas.width = state.width * ratio;
    canvas.height = state.height * ratio;
    canvas.style.width = state.width + 'px';
    canvas.style.height = state.height + 'px';
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }

  function pathLine(values, xFor, yFor, color, width) {
    ctx.beginPath();
    values.forEach((v, i) => i ? ctx.lineTo(xFor(i), yFor(v)) : ctx.moveTo(xFor(i), yFor(v)));
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }

  function draw() {
    if (!state.candles.length) state.candles = series(state.width < 760 ? 42 : 68);
    const W = state.width; const H = state.height;
    const pad = { top: 26, right: 74, bottom: 42, left: 18 };
    const volumeH = 66;
    const chartBottom = H - pad.bottom - volumeH;
    const values = state.candles.flatMap((c) => [c.high, c.low]);
    const min = Math.min(...values); const max = Math.max(...values); const span = max - min || 1;
    const plotW = W - pad.left - pad.right;
    const step = plotW / state.candles.length;
    const bodyW = Math.max(3, Math.min(10, step * 0.58));
    const xFor = (i) => pad.left + step * i + step / 2;
    const yFor = (v) => pad.top + (max - v) / span * (chartBottom - pad.top);
    const bull = '#33e6a6'; const bear = '#ff5876';

    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0b1220'); bg.addColorStop(1, '#070b13');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    ctx.lineWidth = 1; ctx.font = '11px Inter, system-ui';
    for (let i = 0; i <= 5; i += 1) {
      const y = pad.top + (chartBottom - pad.top) * i / 5;
      ctx.strokeStyle = 'rgba(143,164,191,.105)'; ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
      const price = max - span * i / 5;
      ctx.fillStyle = '#6f7f96'; ctx.textAlign = 'left'; ctx.fillText(price.toFixed(configs[state.symbol].digits), W - pad.right + 10, y + 4);
    }
    for (let i = 0; i <= 6; i += 1) {
      const x = pad.left + plotW * i / 6;
      ctx.strokeStyle = 'rgba(143,164,191,.07)'; ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, H - pad.bottom); ctx.stroke();
    }

    const closes = state.candles.map((c) => c.close);
    pathLine(ema(closes, 26), xFor, yFor, '#b084ff', 1.35);
    pathLine(ema(closes, 9), xFor, yFor, '#f3c969', 1.65);

    state.candles.forEach((c, i) => {
      const x = xFor(i); const up = c.close >= c.open; const color = up ? bull : bear;
      ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, yFor(c.high)); ctx.lineTo(x, yFor(c.low)); ctx.stroke();
      const y = Math.min(yFor(c.open), yFor(c.close)); const h = Math.max(2, Math.abs(yFor(c.open) - yFor(c.close)));
      ctx.fillStyle = color; ctx.shadowColor = up ? 'rgba(51,230,166,.32)' : 'rgba(255,88,118,.28)'; ctx.shadowBlur = i === state.candles.length - 1 ? 12 : 0;
      ctx.fillRect(x - bodyW / 2, y, bodyW, h); ctx.shadowBlur = 0;
      const vh = c.volume / 100 * volumeH;
      ctx.fillStyle = up ? 'rgba(51,230,166,.20)' : 'rgba(255,88,118,.18)';
      ctx.fillRect(x - bodyW / 2, H - pad.bottom - vh, bodyW, vh);
    });

    const last = state.candles[state.candles.length - 1]; const lastY = yFor(last.close);
    ctx.setLineDash([4, 4]); ctx.strokeStyle = last.close >= last.open ? bull : bear; ctx.beginPath(); ctx.moveTo(pad.left, lastY); ctx.lineTo(W - pad.right, lastY); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = last.close >= last.open ? bull : bear; ctx.fillRect(W - pad.right + 4, lastY - 10, 66, 20);
    ctx.fillStyle = '#071017'; ctx.font = '700 10px Inter, system-ui'; ctx.fillText(last.close.toFixed(configs[state.symbol].digits), W - pad.right + 9, lastY + 4);

    if (state.hover >= 0 && state.hover < state.candles.length) {
      const x = xFor(state.hover);
      ctx.strokeStyle = 'rgba(244,228,166,.38)'; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, H - pad.bottom); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  function updateReadout() {
    const cfg = configs[state.symbol]; const last = state.candles[state.candles.length - 1]; const first = state.candles[0];
    const change = ((last.close - first.open) / first.open) * 100;
    $('auraChartSymbol').textContent = state.symbol;
    $('auraChartTimeframe').textContent = state.timeframe;
    $('auraChartLast').textContent = last.close.toFixed(cfg.digits);
    $('auraChartChange').textContent = (change >= 0 ? '+' : '') + change.toFixed(2) + '%';
    $('auraChartChange').className = change >= 0 ? 'positive' : 'negative';
    const q = window.AURAFX_LIVE_QUOTES;
    const live = !!(q && q.live);
    $('auraChartFeedMode').textContent = live ? 'LIVE ANCHOR' : 'REFERENCE';
    $('auraDataQuality').textContent = live ? 'Live anchor' : 'Reference only';
    $('auraMarketState').className = 'market-state ' + (live ? 'is-live' : '');
  }

  function rebuild() {
    state.candles = series(state.width < 760 ? 42 : 68);
    updateReadout(); draw();
  }

  function syncIntelligenceRail() {
    if (state.aiResult) return renderAiResult(state.aiResult);
    const scoreText = ($('kpiScore') && $('kpiScore').textContent) || '—';
    const moodText = ($('kpiMood') && $('kpiMood').textContent) || 'Unclear';
    const numericScore = Math.max(0, Math.min(100, parseInt(scoreText, 10) || 0));
    $('auraSetupScore').textContent = numericScore ? String(numericScore) : '—';
    $('auraSetupOrbit').style.background = 'conic-gradient(#f3c969 0 ' + numericScore + '%, #1c2738 ' + numericScore + '% 100%)';
    $('auraRegime').textContent = moodText;

    $('auraDecision').textContent = numericScore >= 80 ? 'REVIEW SETUP' : 'NO TRADE';
    $('auraDecision').className = numericScore >= 80 ? 'review' : '';
    $('auraDecisionReason').textContent = numericScore >= 80
      ? 'High-quality context detected. Confirm structure, spread and closed candle before any manual decision.'
      : 'Waiting for closed-candle confirmation, aligned trend and reliable market data.';

    const setCheck = (id, pass) => {
      const el = $(id); if (!el) return;
      el.className = pass ? 'pass' : 'pending';
    };
    setCheck('auraTrendCheck', numericScore >= 70);
    setCheck('auraMomentumCheck', numericScore >= 76);
    setCheck('auraRiskCheck', numericScore >= 80 && !!(window.AURAFX_LIVE_QUOTES && window.AURAFX_LIVE_QUOTES.live));
  }

  function renderAiResult(result) {
    const score = Math.max(0, Math.min(100, Number(result.confidence) || 0));
    $('auraSetupScore').textContent = String(score);
    $('auraSetupOrbit').style.background = 'conic-gradient(#f3c969 0 ' + score + '%, #1c2738 ' + score + '% 100%)';
    $('auraDecision').textContent = String(result.decision || 'NO_TRADE').replace('_', ' ');
    $('auraDecision').className = result.decision && result.decision !== 'NO_TRADE' ? 'review' : '';
    $('auraDecisionReason').textContent = result.news_summary || (result.failed_conditions || []).join(' ') || 'AI analysis unavailable. No trade.';
    $('auraRegime').textContent = result.market_regime || 'Unclear';
    $('auraDataQuality').textContent = result.data_quality || 'Unavailable';
    const pass = result.ok === true && result.decision !== 'NO_TRADE';
    $('auraTrendCheck').className = pass ? 'pass' : 'pending';
    $('auraMomentumCheck').className = pass && score >= 75 ? 'pass' : 'pending';
    $('auraRiskCheck').className = 'pending';
    if ($('auraAiUpdated')) $('auraAiUpdated').textContent = result.analyzedAt ? 'Updated ' + new Date(result.analyzedAt).toLocaleTimeString() + ' · paper only' : 'Fail-closed · paper only';
  }

  async function runAiAnalysis() {
    if (state.aiLoading) return;
    state.aiLoading = true;
    const button = $('auraAnalyzeButton');
    if (button) { button.disabled = true; button.textContent = 'Analyzing…'; }
    try {
      const response = await fetch('/api/ai/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol: state.symbol, timeframe: state.timeframe }) });
      state.aiResult = await response.json();
    } catch (_) {
      state.aiResult = { decision: 'NO_TRADE', confidence: 0, market_regime: 'Unavailable', data_quality: 'OFFLINE', failed_conditions: ['AI service is offline.'] };
    } finally {
      state.aiLoading = false;
      if (button) { button.disabled = false; button.textContent = 'Run AI analysis'; }
      renderAiResult(state.aiResult);
    }
  }

  document.querySelectorAll('[data-aura-symbol]').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('[data-aura-symbol]').forEach((b) => b.classList.toggle('active', b === button));
    state.symbol = button.dataset.auraSymbol; state.aiResult = null; rebuild();
  }));
  document.querySelectorAll('[data-aura-timeframe]').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('[data-aura-timeframe]').forEach((b) => b.classList.toggle('active', b === button));
    state.timeframe = button.dataset.auraTimeframe; state.aiResult = null; rebuild();
  }));

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    state.hover = Math.max(0, Math.min(state.candles.length - 1, Math.floor((event.clientX - rect.left - 18) / ((state.width - 92) / state.candles.length))));
    const c = state.candles[state.hover]; const tip = $('auraChartTooltip');
    if (tip && c) {
      tip.hidden = false; tip.style.left = Math.min(event.clientX - rect.left + 16, state.width - 210) + 'px'; tip.style.top = Math.max(22, event.clientY - rect.top - 38) + 'px';
      tip.innerHTML = '<b>' + state.symbol + ' · ' + state.timeframe + '</b><span>O ' + c.open.toFixed(configs[state.symbol].digits) + ' &nbsp; H ' + c.high.toFixed(configs[state.symbol].digits) + '</span><span>L ' + c.low.toFixed(configs[state.symbol].digits) + ' &nbsp; C ' + c.close.toFixed(configs[state.symbol].digits) + '</span>';
    }
    draw();
  });
  canvas.addEventListener('mouseleave', () => { state.hover = -1; const tip = $('auraChartTooltip'); if (tip) tip.hidden = true; draw(); });
  if ($('auraAnalyzeButton')) $('auraAnalyzeButton').addEventListener('click', runAiAnalysis);

  new ResizeObserver(resize).observe(canvas.parentElement);
  setInterval(() => {
    const quote = liveQuote(state.symbol);
    if (quote && state.candles.length) {
      const c = state.candles[state.candles.length - 1]; c.close = quote; c.high = Math.max(c.high, quote); c.low = Math.min(c.low, quote);
      updateReadout(); draw();
    }
    syncIntelligenceRail();
  }, 3000);
  resize(); rebuild(); syncIntelligenceRail();
}());
