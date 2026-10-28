'use strict';

/**
 * Rule-based confluence math for Aura Elite FX.
 * The engine calculates Buy / Sell / Wait. A language model may only rewrite wording.
 */

const DISCLAIMER = 'Aura Elite FX provides AI-assisted market analysis, confidence scoring, backtesting and risk tools. Trading involves risk and no result is guaranteed.';
const MIN_CONFIDENCE = 74;
const MIN_RR = 1.8;
const MIN_BARS = 80;

function decimalsFor(id) {
  const p = String(id || '').toUpperCase();
  if (p === 'USDJPY' || p === 'EURJPY' || p === 'GBPJPY') return 3;
  if (p === 'XAUUSD' || p === 'USOIL' || p === 'UKOIL') return 2;
  if (p === 'XAGUSD' || p === 'NATGAS') return 3;
  if (p === 'COPPER') return 4;
  return 5;
}

function roundPrice(value, id) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Number(n.toFixed(decimalsFor(id)));
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function sanitizeCandles(list) {
  const rows = (Array.isArray(list) ? list : [])
    .map((c) => ({
      t: c && c.t,
      o: Number(c && c.o),
      h: Number(c && c.h),
      l: Number(c && c.l),
      c: Number(c && c.c)
    }))
    .filter((c) => c.t && [c.o, c.h, c.l, c.c].every((n) => Number.isFinite(n) && n > 0) && c.h >= c.l && c.h >= c.o && c.h >= c.c && c.l <= c.o && c.l <= c.c);
  rows.sort((a, b) => new Date(a.t) - new Date(b.t));
  const out = [];
  for (const row of rows) {
    if (out.length && out[out.length - 1].t === row.t) out[out.length - 1] = row;
    else out.push(row);
  }
  return out;
}

function ema(values, period) {
  const out = new Array(values.length).fill(null);
  if (!period || values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let prev = sum / period;
  out[period - 1] = prev;
  const k = 2 / (period + 1);
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

function rsi(closes, period) {
  const out = new Array(closes.length).fill(null);
  const p = period || 14;
  if (closes.length <= p) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= p; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgG = gain / p;
  let avgL = loss / p;
  const at = (g, l) => (l === 0 ? 100 : 100 - 100 / (1 + g / l));
  out[p] = at(avgG, avgL);
  for (let i = p + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgG = (avgG * (p - 1) + (d > 0 ? d : 0)) / p;
    avgL = (avgL * (p - 1) + (d < 0 ? -d : 0)) / p;
    out[i] = at(avgG, avgL);
  }
  return out;
}

function trueRange(candles, i) {
  const h = candles[i].h;
  const l = candles[i].l;
  if (i === 0) return h - l;
  const prev = candles[i - 1].c;
  return Math.max(h - l, Math.abs(h - prev), Math.abs(l - prev));
}

function atr(candles, period) {
  const out = new Array(candles.length).fill(null);
  const p = period || 14;
  if (candles.length <= p) return out;
  let sum = 0;
  for (let i = 1; i <= p; i++) sum += trueRange(candles, i);
  let prev = sum / p;
  out[p] = prev;
  for (let i = p + 1; i < candles.length; i++) {
    prev = (prev * (p - 1) + trueRange(candles, i)) / p;
    out[i] = prev;
  }
  return out;
}

function macd(closes, fast, slow, signal) {
  const f = fast || 12;
  const s = slow || 26;
  const sigP = signal || 9;
  const emaFast = ema(closes, f);
  const emaSlow = ema(closes, s);
  const line = closes.map((_, i) => (emaFast[i] == null || emaSlow[i] == null ? null : emaFast[i] - emaSlow[i]));
  const outSig = new Array(closes.length).fill(null);
  const outHist = new Array(closes.length).fill(null);
  const start = line.findIndex((v) => v != null);
  if (start === -1) return { line, signal: outSig, hist: outHist };
  const series = line.slice(start);
  const sig = ema(series, sigP);
  for (let i = 0; i < series.length; i++) {
    outSig[start + i] = sig[i];
    if (sig[i] != null) outHist[start + i] = series[i] - sig[i];
  }
  return { line, signal: outSig, hist: outHist };
}

function resample(candles, hours) {
  const buckets = new Map();
  for (const c of candles) {
    const d = new Date(c.t);
    if (Number.isNaN(d.getTime())) continue;
    const h = d.getUTCHours();
    const floored = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h - (h % hours), 0, 0, 0));
    const key = floored.toISOString();
    const b = buckets.get(key);
    if (!b) buckets.set(key, { t: key, o: c.o, h: c.h, l: c.l, c: c.c, n: 1 });
    else {
      b.h = Math.max(b.h, c.h);
      b.l = Math.min(b.l, c.l);
      b.c = c.c;
      b.n += 1;
    }
  }
  return [...buckets.values()].map(({ n, ...row }) => row);
}

function pivotSwings(candles, wing) {
  const highs = [];
  const lows = [];
  const w = wing || 3;
  for (let i = w; i < candles.length - w; i++) {
    let isH = true;
    let isL = true;
    for (let j = 1; j <= w; j++) {
      if (candles[i].h < candles[i - j].h || candles[i].h < candles[i + j].h) isH = false;
      if (candles[i].l > candles[i - j].l || candles[i].l > candles[i + j].l) isL = false;
    }
    if (isH) highs.push({ i, price: candles[i].h });
    if (isL) lows.push({ i, price: candles[i].l });
  }
  return { highs, lows };
}

function trendState(candles) {
  const closes = candles.map((c) => c.c);
  const e20 = ema(closes, 20);
  const e50 = ema(closes, 50);
  const i = closes.length - 1;
  if (i < 5 || e50[i] == null || e20[i] == null || e50[i - 5] == null) {
    return { dir: 'neutral', note: 'Not enough bars for a stable trend read.' };
  }
  const slope = e50[i] - e50[i - 5];
  const price = closes[i];
  if (e20[i] > e50[i] && slope > 0 && price > e20[i]) {
    return { dir: 'bullish', note: 'Hourly EMA20 is above a rising EMA50 and price is above EMA20.' };
  }
  if (e20[i] < e50[i] && slope < 0 && price < e20[i]) {
    return { dir: 'bearish', note: 'Hourly EMA20 is below a falling EMA50 and price is below EMA20.' };
  }
  return { dir: 'neutral', note: 'Hourly trend is mixed.' };
}

function momentumState(candles) {
  const closes = candles.map((c) => c.c);
  const r = rsi(closes, 14);
  const m = macd(closes);
  const i = closes.length - 1;
  const rsiNow = r[i];
  const hist = m.hist[i];
  const prev = m.hist[i - 1];
  if (rsiNow == null || hist == null || prev == null) {
    return { dir: 'neutral', exhausted: false, rsi: null, note: 'Momentum is not ready yet.' };
  }
  if (rsiNow >= 80 || rsiNow <= 20) {
    return {
      dir: 'neutral',
      exhausted: true,
      rsi: rsiNow,
      note: 'RSI is stretched at ' + Math.round(rsiNow) + ', so a fresh signal is withheld.'
    };
  }
  if (rsiNow >= 48 && rsiNow <= 74 && hist > 0 && hist > prev) {
    return {
      dir: 'bullish',
      exhausted: false,
      rsi: rsiNow,
      note: 'RSI is ' + Math.round(rsiNow) + ' and the MACD histogram is positive and rising.'
    };
  }
  if (rsiNow <= 52 && rsiNow >= 26 && hist < 0 && hist < prev) {
    return {
      dir: 'bearish',
      exhausted: false,
      rsi: rsiNow,
      note: 'RSI is ' + Math.round(rsiNow) + ' and the MACD histogram is negative and falling.'
    };
  }
  return {
    dir: 'neutral',
    exhausted: false,
    rsi: rsiNow,
    note: 'Momentum does not confirm a direction.'
  };
}

function structureState(candles, atrNow) {
  const swings = pivotSwings(candles, 5);
  const close = candles[candles.length - 1].c;
  const minRoom = atrNow ? atrNow * 0.6 : 0;
  const supportPt = [...swings.lows].reverse().find((s) => close - s.price >= minRoom) || null;
  const above = swings.highs
    .filter((s) => s.price - close >= minRoom)
    .sort((a, b) => a.price - b.price);
  const resistancePt = above[0] || null;
  const lastLows = swings.lows.slice(-2);
  const lastHighs = swings.highs.slice(-2);
  const higherLows = lastLows.length === 2 && lastLows[1].price > lastLows[0].price;
  const lowerHighs = lastHighs.length === 2 && lastHighs[1].price < lastHighs[0].price;
  const roomUp = resistancePt && atrNow ? (resistancePt.price - close) / atrNow : null;
  const roomDown = supportPt && atrNow ? (close - supportPt.price) / atrNow : null;
  const upOk = higherLows && !lowerHighs && (roomUp == null || roomUp >= 1.2);
  const downOk = lowerHighs && !higherLows && (roomDown == null || roomDown >= 1.2);
  let dir = 'neutral';
  let note = 'Support and resistance do not give a clean path.';
  if (higherLows && !lowerHighs && roomUp != null && roomUp < 1.2) {
    note = 'Higher lows are in place, but resistance is closer than 1.2 ATR.';
  } else if (lowerHighs && !higherLows && roomDown != null && roomDown < 1.2) {
    note = 'Lower highs are in place, but support is closer than 1.2 ATR.';
  }
  if (upOk) {
    dir = 'bullish';
    note = roomUp == null
      ? 'Higher lows are in place and no meaningful swing high sits overhead.'
      : 'Higher lows are in place and there is room toward resistance.';
  } else if (downOk) {
    dir = 'bearish';
    note = roomDown == null
      ? 'Lower highs are in place and no meaningful swing low sits underneath.'
      : 'Lower highs are in place and there is room toward support.';
  }
  return {
    dir,
    note,
    support: supportPt ? supportPt.price : null,
    resistance: resistancePt ? resistancePt.price : null,
    roomUp,
    roomDown
  };
}

function adx(candles, period) {
  const p = period || 14;
  const n = candles.length;
  const out = new Array(n).fill(null);
  if (n <= p * 2) return out;
  const tr = new Array(n).fill(0);
  const plusDM = new Array(n).fill(0);
  const minusDM = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    tr[i] = trueRange(candles, i);
    const upMove = candles[i].h - candles[i - 1].h;
    const downMove = candles[i - 1].l - candles[i].l;
    plusDM[i] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDM[i] = downMove > upMove && downMove > 0 ? downMove : 0;
  }
  let trS = 0;
  let plusS = 0;
  let minusS = 0;
  for (let i = 1; i <= p; i++) {
    trS += tr[i];
    plusS += plusDM[i];
    minusS += minusDM[i];
  }
  const dx = new Array(n).fill(null);
  const dxAt = (plus, minus, trSum) => {
    if (!(trSum > 0)) return null;
    const plusDI = 100 * plus / trSum;
    const minusDI = 100 * minus / trSum;
    const sum = plusDI + minusDI;
    if (!(sum > 0)) return null;
    return 100 * Math.abs(plusDI - minusDI) / sum;
  };
  dx[p] = dxAt(plusS, minusS, trS);
  for (let i = p + 1; i < n; i++) {
    trS = trS - trS / p + tr[i];
    plusS = plusS - plusS / p + plusDM[i];
    minusS = minusS - minusS / p + minusDM[i];
    dx[i] = dxAt(plusS, minusS, trS);
  }
  let seed = 0;
  for (let i = p; i < p + p; i++) {
    if (dx[i] == null) return out;
    seed += dx[i];
  }
  let prev = seed / p;
  out[p + p - 1] = prev;
  for (let i = p + p; i < n; i++) {
    if (dx[i] == null) continue;
    prev = (prev * (p - 1) + dx[i]) / p;
    out[i] = prev;
  }
  return out;
}

function detectRegime(candles) {
  const rows = sanitizeCandles(candles);
  const vol = volatilityState(rows);
  const series = adx(rows, 14);
  const adxNow = series.length ? series[series.length - 1] : null;
  const atrNow = vol.atr;
  const adxRounded = adxNow == null ? null : Math.round(adxNow * 10) / 10;
  const currentSpan = rows.length ? rows[rows.length - 1].h - rows[rows.length - 1].l : 0;
  const wideNow = atrNow > 0 && currentSpan > atrNow * 2.2;
  if (vol.regime === 'extreme' || wideNow) {
    return {
      name: 'volatile',
      adx: adxRounded,
      note: 'Regime is volatile: this hourly bar or ATR is above 2.2 times its recent norm, so no new signal is published.'
    };
  }
  if (adxNow != null && adxNow >= 25) {
    return {
      name: 'trending',
      adx: adxRounded,
      note: 'Regime is trending: ADX is ' + Math.round(adxNow) + ', so the trend-following rules apply.'
    };
  }
  const adxText = adxNow == null ? 'not ready' : String(Math.round(adxNow));
  return {
    name: 'ranging',
    adx: adxRounded,
    note: 'Regime is ranging: ADX is ' + adxText + '.'
  };
}

function rangeInstrumentIds(ctx) {
  if (ctx && Array.isArray(ctx.rangeInstruments)) {
    return ctx.rangeInstruments.map((id) => String(id || '').toUpperCase()).filter(Boolean);
  }
  const raw = process.env.SIGNAL_RANGE_INSTRUMENTS;
  if (raw == null || String(raw).trim() === '') return ['XAUUSD'];
  const text = String(raw).trim();
  if (/^(none|off|-)$/i.test(text)) return [];
  return text.split(',').map((id) => id.trim().toUpperCase()).filter(Boolean);
}

function allowsRangeMeanReversion(instrument, ctx) {
  const id = String(instrument && instrument.id || '').toUpperCase();
  return rangeInstrumentIds(ctx).includes(id);
}

function rangeEdge(close, struct, atrNow, mom, daily) {
  if (!(atrNow > 0) || !Number.isFinite(close)) {
    return { side: null, note: 'Range edge cannot be measured yet.' };
  }
  const rsiNow = mom && mom.rsi;
  const dailyDir = daily && daily.dir;
  const supportDist = struct && struct.support != null ? (close - struct.support) / atrNow : null;
  const resistDist = struct && struct.resistance != null ? (struct.resistance - close) / atrNow : null;
  const buyOk = supportDist != null && supportDist >= 0 && supportDist <= 1 &&
    rsiNow != null && rsiNow <= 42 && dailyDir !== 'bearish';
  const sellOk = resistDist != null && resistDist >= 0 && resistDist <= 1 &&
    rsiNow != null && rsiNow >= 58 && dailyDir !== 'bullish';
  if (buyOk && (!sellOk || supportDist <= resistDist)) {
    return {
      side: 'BUY',
      note: 'Range regime: price is within one ATR of support, RSI is ' + Math.round(rsiNow) + ', and the daily trend is not down.'
    };
  }
  if (sellOk) {
    return {
      side: 'SELL',
      note: 'Range regime: price is within one ATR of resistance, RSI is ' + Math.round(rsiNow) + ', and the daily trend is not up.'
    };
  }
  return { side: null, note: 'Range regime: price is not at the edge of the range.' };
}

const CALIBRATION_MIN = 8;

function calibrateConfidence(setup, records) {
  if (!setup) return setup;
  const raw = setup.confidence;
  setup.confidence_raw = raw;
  setup.confidence_calibrated = false;
  setup.confidence_sample = 0;
  if (setup.action !== 'BUY' && setup.action !== 'SELL') {
    setup.confidence_basis = null;
    return setup;
  }
  const closed = (Array.isArray(records) ? records : []).filter((row) => row && (row.status === 'tp' || row.status === 'sl'));
  const bucket = closed.filter((row) => row.regime === setup.regime && row.action === setup.action);
  const useBucket = bucket.length >= CALIBRATION_MIN;
  const pool = useBucket ? bucket : closed;
  setup.confidence_sample = pool.length;
  if (pool.length < CALIBRATION_MIN) {
    setup.confidence_basis = 'Setup quality. Fewer than 8 closed signals, so this is not calibrated.';
    return setup;
  }
  const wins = pool.filter((row) => row.status === 'tp').length;
  const shrunk = (wins + 2) / (pool.length + 4);
  setup.confidence = clamp(Math.round(shrunk * 100), 1, 92);
  setup.confidence_calibrated = true;
  const scope = useBucket ? (setup.regime + ' ' + setup.action) : 'all closed signals';
  setup.confidence_basis = 'Calibrated from ' + pool.length + ' closed signals (' + scope + '). This is a measured rate, not a forecast.';
  return setup;
}

function volatilityState(candles) {
  const series = atr(candles, 14);
  const i = candles.length - 1;
  const now = series[i];
  if (now == null || now <= 0) {
    return { ok: false, regime: 'unknown', atr: null, note: 'Volatility cannot be measured yet.' };
  }
  const window = series.slice(Math.max(0, i - 50), i).filter((v) => v != null && v > 0);
  if (window.length < 10) {
    return { ok: false, regime: 'unknown', atr: now, note: 'Volatility baseline is still forming.' };
  }
  const avg = window.reduce((s, v) => s + v, 0) / window.length;
  const ratio = now / avg;
  if (ratio > 2.2) {
    return { ok: false, regime: 'extreme', atr: now, ratio, note: 'ATR is extreme versus its recent average.' };
  }
  if (ratio < 0.45) {
    return { ok: false, regime: 'dead', atr: now, ratio, note: 'ATR is unusually quiet, so stops would be guesswork.' };
  }
  if (ratio > 1.8) {
    return { ok: true, regime: 'elevated', atr: now, ratio, note: 'ATR is elevated versus its recent average.' };
  }
  return { ok: true, regime: 'normal', atr: now, ratio, note: 'ATR is in a normal band versus its recent average.' };
}

function marketOpen(now) {
  const d = now.getUTCDay();
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (d === 6) return false;
  if (d === 0 && mins < 22 * 60) return false;
  if (d === 5 && mins >= 22 * 60) return false;
  return true;
}

function sessionInfo(now) {
  const h = now.getUTCHours();
  if (h >= 12 && h < 16) return { name: 'London/New York overlap', preferred: true, overlap: true };
  if (h >= 7 && h < 12) return { name: 'London', preferred: true, overlap: false };
  if (h >= 16 && h < 21) return { name: 'New York', preferred: true, overlap: false };
  if (h >= 0 && h < 7 || h >= 22) return { name: 'Asia', preferred: false, overlap: false };
  return { name: 'Off-hours', preferred: false, overlap: false };
}

function newsAffects(instrument, event) {
  const cur = String(event && event.currency || '').toUpperCase();
  if (!cur) return true;
  if (!instrument || instrument.asset !== 'forex') return cur === 'USD';
  return String(instrument.id || '').toUpperCase().includes(cur);
}

function selectNewsEvents(events, now, beforeMin, afterMin) {
  const clock = now instanceof Date ? now.getTime() : new Date(now || Date.now()).getTime();
  const before = Number.isFinite(Number(beforeMin)) ? Number(beforeMin) : 30;
  const after = Number.isFinite(Number(afterMin)) ? Number(afterMin) : 30;
  return (events || []).map((event) => {
    if (!event || String(event.risk || '').toUpperCase() !== 'HIGH') return null;
    const when = new Date(event.time).getTime();
    if (!Number.isFinite(when)) return null;
    const minutesUntil = (when - clock) / 60000;
    if (minutesUntil > before || minutesUntil < -after) return null;
    return {
      title: String(event.title || ''),
      currency: String(event.currency || '').toUpperCase(),
      risk: 'HIGH',
      minutesUntil: Math.round(minutesUntil * 10) / 10
    };
  }).filter(Boolean);
}

function newsEventsFromContext(ctx) {
  const context = ctx || {};
  if (Array.isArray(context.newsEvents)) return context.newsEvents;
  if (!context.newsImminent) return [];
  return [{
    currency: context.newsCurrency,
    title: context.newsTitle,
    minutesUntil: context.minutesUntil
  }];
}

function newsBlockerText(event) {
  const title = event && event.title ? ' (' + event.title + ')' : '';
  const mins = Number(event && event.minutesUntil);
  let when = '';
  if (Number.isFinite(mins)) {
    when = mins >= 0
      ? ', ' + Math.round(mins) + ' min before'
      : ', ' + Math.round(Math.abs(mins)) + ' min after';
  }
  return 'High-impact news is inside the pause window for this market' + title + when + '.';
}

function newsBlockersFor(instrument, ctx) {
  return newsEventsFromContext(ctx).filter((event) => newsAffects(instrument, event)).map(newsBlockerText);
}

function scoreSetup(side, vol, session, mom, struct) {
  let score = 76;
  if (vol.regime === 'normal') score += 4;
  else score -= 6;
  if (session.overlap) score += 4;
  else if (session.preferred) score += 2;
  else score -= 10;
  const rsiNow = mom.rsi;
  if (side === 'BUY' && rsiNow >= 52 && rsiNow <= 66) score += 3;
  if (side === 'SELL' && rsiNow >= 34 && rsiNow <= 48) score += 3;
  const room = side === 'BUY' ? struct.roomUp : struct.roomDown;
  if (room != null && room >= 2.5) score += 2;
  return clamp(Math.round(score), 0, 92);
}

function buildLevels(side, close, atrNow, struct, instrument) {
  if (!atrNow || atrNow <= 0 || !close) return null;
  const id = instrument.id;
  let risk = 1.5 * atrNow;
  if (side === 'BUY' && struct.support != null && struct.support < close) {
    const swingRisk = close - (struct.support - 0.1 * atrNow);
    if (swingRisk >= 0.8 * atrNow && swingRisk <= 2.8 * atrNow) risk = swingRisk;
  }
  if (side === 'SELL' && struct.resistance != null && struct.resistance > close) {
    const swingRisk = (struct.resistance + 0.1 * atrNow) - close;
    if (swingRisk >= 0.8 * atrNow && swingRisk <= 2.8 * atrNow) risk = swingRisk;
  }
  if (risk < 0.8 * atrNow || risk > 2.8 * atrNow) return null;

  const entry = roundPrice(close, id);
  let reward = 2 * risk;
  if (side === 'BUY' && struct.resistance != null && struct.resistance > close) {
    const room = struct.resistance - close;
    if (room < MIN_RR * risk) return null;
    if (room < reward) reward = Math.max(MIN_RR * risk, room - 0.05 * atrNow);
  }
  if (side === 'SELL' && struct.support != null && struct.support < close) {
    const room = close - struct.support;
    if (room < MIN_RR * risk) return null;
    if (room < reward) reward = Math.max(MIN_RR * risk, room - 0.05 * atrNow);
  }
  if (reward / risk < MIN_RR) return null;

  const sl = side === 'BUY' ? close - risk : close + risk;
  const tp1 = side === 'BUY' ? close + reward : close - reward;
  let tp2raw = side === 'BUY' ? close + 3 * risk : close - 3 * risk;
  let tp2ok = true;
  if (side === 'BUY' && struct.resistance != null && tp2raw >= struct.resistance) tp2ok = false;
  if (side === 'SELL' && struct.support != null && tp2raw <= struct.support) tp2ok = false;
  if (Math.abs(tp2raw - tp1) < atrNow * 0.15) tp2ok = false;

  const stop = roundPrice(sl, id);
  const take1 = roundPrice(tp1, id);
  const take2 = tp2ok ? roundPrice(tp2raw, id) : null;
  const riskPx = Math.abs(entry - stop);
  const rewardPx = Math.abs(take1 - entry);
  if (!riskPx || rewardPx / riskPx < MIN_RR - 0.02) return null;
  const zone = side === 'BUY'
    ? [roundPrice(close - 0.25 * atrNow, id), entry]
    : [entry, roundPrice(close + 0.25 * atrNow, id)];
  return {
    entry,
    entry_zone: zone,
    stop_loss: stop,
    take_profit_1: take1,
    take_profit_2: take2,
    risk_reward: Math.round((rewardPx / riskPx) * 100) / 100
  };
}

function factor(key, label, state, note) {
  return { key, label, state, note };
}

function emptySetup(instrument, extra) {
  return {
    instrument: instrument.id,
    name: instrument.name,
    asset: instrument.asset,
    action: 'WAIT',
    published: false,
    confidence: null,
    entry: null,
    entry_zone: null,
    stop_loss: null,
    take_profit_1: null,
    take_profit_2: null,
    risk_reward: null,
    price: null,
    timeframe: 'H1',
    factors: [],
    blockers: [],
    regime: null,
    regime_note: null,
    confidence_raw: null,
    confidence_calibrated: false,
    confidence_sample: null,
    confidence_basis: null,
    session: null,
    data_quality: 'insufficient',
    history: { h1: 0, h4: 0, d1: 0 },
    rsi: null,
    atr: null,
    atr_ratio: null,
    support: null,
    resistance: null,
    trend: null,
    mtf: null,
    disclaimer: DISCLAIMER,
    ...extra
  };
}

function assessSetup(instrument, frames, ctx) {
  const now = ctx && ctx.now instanceof Date ? ctx.now : new Date((ctx && ctx.now) || Date.now());
  const h1 = sanitizeCandles(frames && frames.h1);
  const base = emptySetup(instrument, { history: { h1: h1.length, h4: 0, d1: 0 } });
  if (h1.length < MIN_BARS) {
    base.blockers = ['Not enough hourly history to score confluence.'];
    base.data_quality = 'insufficient';
    return base;
  }

  const last = h1[h1.length - 1];
  const providedH4 = sanitizeCandles(frames && frames.h4);
  const h4 = providedH4.length >= 60 ? providedH4 : resample(h1, 4);
  const providedD1 = sanitizeCandles(frames && frames.d1);
  const d1source = providedD1.length ? providedD1 : resample(h1, 24);
  const d1 = d1source.filter((c) => new Date(c.t).getTime() <= now.getTime() - 20 * 3600 * 1000);

  const vol = volatilityState(h1);
  const trend = trendState(h1);
  const mom = momentumState(h1);
  const struct = structureState(h1, vol.atr);
  const trendH4 = trendState(h4);
  const trendD1 = trendState(d1);
  let mtfDir = 'neutral';
  let mtfNote = '4-hour and daily trends do not agree.';
  if (trendH4.dir !== 'neutral' && trendH4.dir === trendD1.dir) {
    mtfDir = trendH4.dir;
    mtfNote = trendH4.dir === 'bullish'
      ? '4-hour and daily trends both point up.'
      : '4-hour and daily trends both point down.';
  } else if (trendD1.dir === 'neutral' && d1.length < 60) {
    mtfNote = 'Daily history is too short for higher-timeframe agreement.';
  }

  const session = sessionInfo(now);
  const regime = detectRegime(h1);
  const blockers = [];
  const open = marketOpen(now);
  const ageMs = now.getTime() - new Date(last.t).getTime();
  if (!open) blockers.push('Market is closed.');
  else if (ageMs > 8 * 3600 * 1000) blockers.push('Hourly price feed is stale.');
  if (!vol.ok) blockers.push(vol.note);
  if (mom.exhausted) blockers.push(mom.note);
  const newsBlockers = newsBlockersFor(instrument, ctx || {});
  newsBlockers.forEach((line) => blockers.push(line));

  const dirs = {
    trend: trend.dir,
    momentum: mom.exhausted ? 'neutral' : mom.dir,
    structure: struct.dir,
    mtf: mtfDir
  };
  const bullVotes = Object.values(dirs).filter((d) => d === 'bullish').length;
  const bearVotes = Object.values(dirs).filter((d) => d === 'bearish').length;
  let side = null;
  let ruleNote = null;
  if (regime.name === 'volatile') {
    blockers.push('Volatility is too wide for a new signal.');
  } else if (regime.name === 'trending' || !allowsRangeMeanReversion(instrument, ctx)) {
    if (bullVotes === 4 && bearVotes === 0) side = 'BUY';
    else if (bearVotes === 4 && bullVotes === 0) side = 'SELL';
    ruleNote = side
      ? (regime.name === 'trending'
        ? 'Trend regime: trend, momentum, structure and higher timeframes agree.'
        : 'Ranging regime on this market still uses the trend rules: trend, momentum, structure and higher timeframes agree.')
      : null;
  } else {
    const edge = rangeEdge(last.c, struct, vol.atr, mom, trendD1);
    if (edge.side) {
      side = edge.side;
      ruleNote = edge.note;
    } else {
      blockers.push('Range regime: price is not at the edge of the range.');
    }
  }

  let levels = null;
  let confidence = clamp(32 + Math.max(bullVotes, bearVotes) * 8, 0, 68);
  if (side && blockers.length === 0) {
    confidence = scoreSetup(side, vol, session, mom, struct);
    if (confidence < MIN_CONFIDENCE) {
      blockers.push('Confluence is present but the setup-quality score is below the publication threshold.');
    } else {
      levels = buildLevels(side, last.c, vol.atr, struct, instrument);
      if (!levels) blockers.push('Stop or target does not meet the minimum risk/reward.');
    }
  }

  const published = !!(side && levels && blockers.length === 0 && confidence >= MIN_CONFIDENCE);
  const action = published ? side : 'WAIT';
  if (!published) confidence = clamp(32 + Math.max(bullVotes, bearVotes) * 8, 0, 68);

  const volState = vol.ok && vol.regime === 'normal' ? 'clear' : (vol.ok ? 'neutral' : 'blocked');
  return {
    instrument: instrument.id,
    name: instrument.name,
    asset: instrument.asset,
    action,
    published,
    confidence,
    entry: published ? levels.entry : null,
    entry_zone: published ? levels.entry_zone : null,
    stop_loss: published ? levels.stop_loss : null,
    take_profit_1: published ? levels.take_profit_1 : null,
    take_profit_2: published ? levels.take_profit_2 : null,
    risk_reward: published ? levels.risk_reward : null,
    price: roundPrice(last.c, instrument.id),
    timeframe: 'H1',
    factors: [
      factor('regime', 'Regime', regime.name, regime.note),
      factor('trend', 'Trend', dirs.trend, trend.note),
      factor('momentum', 'Momentum', dirs.momentum, mom.note),
      factor('structure', 'Structure', dirs.structure, struct.note),
      factor('volatility', 'Volatility', volState, vol.note),
      factor('mtf', 'Higher timeframes', mtfDir, mtfNote)
    ].concat(newsBlockers.length ? [factor('news', 'News', 'blocked', newsBlockers[0])] : []),
    blockers: published ? [] : blockers,
    regime: regime.name,
    regime_note: [regime.note, ruleNote].filter((line, index, list) => line && list.indexOf(line) === index).join(' '),
    regime_adx: regime.adx,
    confidence_raw: confidence,
    confidence_calibrated: false,
    confidence_sample: null,
    confidence_basis: null,
    session: session.name,
    data_quality: !open ? 'closed' : (ageMs > 8 * 3600 * 1000 ? 'stale' : 'ok'),
    history: { h1: h1.length, h4: h4.length, d1: d1.length },
    votes: { bullish: bullVotes, bearish: bearVotes },
    rsi: mom.rsi == null ? null : Math.round(mom.rsi * 10) / 10,
    atr: vol.atr == null ? null : roundPrice(vol.atr, instrument.id),
    atr_ratio: vol.ratio == null ? null : Math.round(vol.ratio * 100) / 100,
    support: struct.support == null ? null : roundPrice(struct.support, instrument.id),
    resistance: struct.resistance == null ? null : roundPrice(struct.resistance, instrument.id),
    trend: trend.dir,
    mtf: mtfDir,
    disclaimer: DISCLAIMER
  };
}

/**
 * Pessimistic bar check. If stop and target are both inside one bar, the stop wins.
 * Entry is the prior close, so the signal bar itself must not be passed in.
 */
function barOutcome(position, bar) {
  if (!position || !bar) return null;
  const buy = position.action === 'BUY';
  const sl = Number(position.stop_loss);
  const tp1 = Number(position.take_profit_1);
  const tp2 = position.take_profit_2 == null ? null : Number(position.take_profit_2);
  const slHit = buy ? bar.l <= sl : bar.h >= sl;
  const tp2Hit = tp2 != null && (buy ? bar.h >= tp2 : bar.l <= tp2);
  const tp1Hit = Number.isFinite(tp1) && (buy ? bar.h >= tp1 : bar.l <= tp1);
  const risk = Math.abs(Number(position.entry) - sl);
  if (slHit && (tp1Hit || tp2Hit)) return { status: 'sl', result_r: -1, close_price: sl };
  if (tp2Hit && risk) {
    return { status: 'tp', result_r: Math.round((Math.abs(tp2 - position.entry) / risk) * 100) / 100, close_price: tp2 };
  }
  if (tp1Hit && risk) {
    return { status: 'tp', result_r: Math.round((Math.abs(tp1 - position.entry) / risk) * 100) / 100, close_price: tp1 };
  }
  if (slHit) return { status: 'sl', result_r: -1, close_price: sl };
  return null;
}

module.exports = {
  DISCLAIMER,
  MIN_CONFIDENCE,
  MIN_RR,
  MIN_BARS,
  decimalsFor,
  roundPrice,
  sanitizeCandles,
  ema,
  rsi,
  atr,
  macd,
  resample,
  marketOpen,
  sessionInfo,
  selectNewsEvents,
  newsAffects,
  newsBlockersFor,
  assessSetup,
  barOutcome,
  adx,
  detectRegime,
  rangeEdge,
  rangeInstrumentIds,
  allowsRangeMeanReversion,
  calibrateConfidence,
  CALIBRATION_MIN
};
