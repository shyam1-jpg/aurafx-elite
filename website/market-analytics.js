'use strict';

const { activeSessionLabel, sessionRiskLevel } = require('./market-sessions');

const FX_PAIRS = [
  { id: 'EURUSD', base: 'EUR', quote: 'USD' },
  { id: 'GBPUSD', base: 'GBP', quote: 'USD' },
  { id: 'USDJPY', base: 'USD', quote: 'JPY' },
  { id: 'USDCHF', base: 'USD', quote: 'CHF' },
  { id: 'AUDUSD', base: 'AUD', quote: 'USD' },
  { id: 'NZDUSD', base: 'NZD', quote: 'USD' },
  { id: 'USDCAD', base: 'USD', quote: 'CAD' },
  { id: 'EURJPY', base: 'EUR', quote: 'JPY' },
  { id: 'GBPJPY', base: 'GBP', quote: 'JPY' }
];

function closes(candles) {
  return (candles || []).filter((bar) => bar && Number.isFinite(Number(bar.c)) && bar.t);
}

function percentChange(candles, bars) {
  const rows = closes(candles);
  const lookback = bars || 24;
  if (rows.length < lookback + 1) return null;
  const last = Number(rows[rows.length - 1].c);
  const prev = Number(rows[rows.length - 1 - lookback].c);
  if (!(prev > 0) || !Number.isFinite(last)) return null;
  return ((last - prev) / prev) * 100;
}

function currencyStrength(candleMap, bars) {
  const lookback = bars || 24;
  const buckets = {};
  const used = [];
  FX_PAIRS.forEach((pair) => {
    const change = percentChange(candleMap && candleMap[pair.id], lookback);
    if (change == null) return;
    used.push(pair.id);
    if (!buckets[pair.base]) buckets[pair.base] = [];
    if (!buckets[pair.quote]) buckets[pair.quote] = [];
    buckets[pair.base].push(change);
    buckets[pair.quote].push(-change);
  });
  const currencies = Object.keys(buckets).sort().map((code) => {
    const list = buckets[code];
    if (!list.length) return null;
    const avg = list.reduce((sum, value) => sum + value, 0) / list.length;
    return {
      currency: code,
      change_pct: Math.round(avg * 100) / 100,
      pairs: list.length
    };
  }).filter(Boolean).sort((a, b) => b.change_pct - a.change_pct);
  return {
    lookback_bars: lookback,
    pairs_used: used,
    basis: 'Signed average of hourly percent changes over the lookback. A currency is left out when none of its pairs have enough bars. The figure is a percent change, not a score out of 100.',
    currencies
  };
}

function hourlyReturns(candles, maxBars) {
  const rows = closes(candles);
  const cap = maxBars || 160;
  const start = Math.max(1, rows.length - cap);
  const out = [];
  for (let i = start; i < rows.length; i++) {
    const prev = Number(rows[i - 1].c);
    const next = Number(rows[i].c);
    if (!(prev > 0) || !Number.isFinite(next)) continue;
    out.push({ t: rows[i].t, r: (next - prev) / prev });
  }
  return out;
}

function pearson(xs, ys) {
  const n = xs.length;
  if (n < 2 || ys.length !== n) return null;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i];
    sy += ys[i];
  }
  const mx = sx / n;
  const my = sy / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx <= 0 || dy <= 0) return null;
  return Math.round((num / Math.sqrt(dx * dy)) * 100) / 100;
}

function correlationMatrix(candleMap, ids, minOverlap) {
  const names = (ids || []).slice();
  const need = minOverlap || 20;
  const series = {};
  names.forEach((id) => {
    series[id] = hourlyReturns(candleMap && candleMap[id], 180);
  });
  const matrix = {};
  names.forEach((left) => {
    matrix[left] = {};
    names.forEach((right) => {
      if (left === right) {
        matrix[left][right] = series[left].length >= need ? 1 : null;
        return;
      }
      const index = new Map(series[right].map((point) => [point.t, point.r]));
      const xs = [];
      const ys = [];
      series[left].forEach((point) => {
        if (!index.has(point.t)) return;
        xs.push(point.r);
        ys.push(index.get(point.t));
      });
      matrix[left][right] = xs.length >= need ? pearson(xs, ys) : null;
    });
  });
  return {
    min_overlap: need,
    basis: 'Pearson correlation of overlapping hourly returns. A blank cell means fewer than ' + need + ' shared bars.',
    instruments: names,
    matrix
  };
}

function sessionsAt(date) {
  const now = date instanceof Date ? date : new Date(date || Date.now());
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  const inRange = (startH, startM, endH, endM) => {
    const start = startH * 60 + startM;
    const end = endH * 60 + endM;
    if (start <= end) return mins >= start && mins < end;
    return mins >= start || mins < end;
  };
  const sessions = {
    sydney: inRange(21, 0, 6, 0),
    tokyo: inRange(0, 0, 9, 0),
    london: inRange(8, 0, 17, 0),
    newYork: inRange(13, 0, 22, 0),
    utcHour: now.getUTCHours(),
    utcLabel: now.toISOString().slice(11, 16) + ' UTC'
  };
  return {
    utc: sessions.utcLabel,
    label: activeSessionLabel(sessions),
    activity: sessionRiskLevel(sessions),
    windows: [
      { name: 'Sydney', open_utc: '21:00', close_utc: '06:00', active: sessions.sydney },
      { name: 'Tokyo', open_utc: '00:00', close_utc: '09:00', active: sessions.tokyo },
      { name: 'London', open_utc: '08:00', close_utc: '17:00', active: sessions.london },
      { name: 'New York', open_utc: '13:00', close_utc: '22:00', active: sessions.newYork }
    ],
    note: 'Clocks use UTC. Activity names which desks are open. It is not a forecast of the next move.'
  };
}

function volatilityStateLabel(ratio) {
  if (ratio == null || !Number.isFinite(Number(ratio))) return 'unmeasured';
  const value = Number(ratio);
  if (value >= 2.2) return 'wide';
  if (value >= 1.3) return 'elevated';
  if (value < 0.6) return 'quiet';
  return 'normal';
}

function volatilityRows(signals) {
  return (signals || []).map((signal) => ({
    instrument: signal.instrument,
    name: signal.name,
    atr: signal.atr == null ? null : signal.atr,
    atr_ratio: signal.atr_ratio == null ? null : signal.atr_ratio,
    state: volatilityStateLabel(signal.atr_ratio),
    note: 'Hourly ATR divided by its recent average. This is a measurement, not a directional forecast.'
  }));
}

function instrumentChange(candleMap, id, bars) {
  return percentChange(candleMap && candleMap[id], bars || 24);
}

function scannerRows(signals, candleMap) {
  return (signals || []).map((signal) => ({
    instrument: signal.instrument,
    name: signal.name,
    action: signal.action,
    trend: signal.trend || null,
    regime: signal.regime || null,
    rsi: signal.rsi == null ? null : signal.rsi,
    atr: signal.atr == null ? null : signal.atr,
    atr_ratio: signal.atr_ratio == null ? null : signal.atr_ratio,
    change_pct: (() => {
      const change = instrumentChange(candleMap, signal.instrument, 24);
      return change == null ? null : Math.round(change * 100) / 100;
    })(),
    session: signal.session || null,
    support: signal.support == null ? null : signal.support,
    resistance: signal.resistance == null ? null : signal.resistance
  }));
}

function confidenceText(signal) {
  if (signal.confidence_calibrated && Number(signal.confidence_sample) >= 8) {
    return 'Measured close rate on this history is ' + signal.confidence + ' from ' + signal.confidence_sample + ' closed signals. That rate is not a forecast.';
  }
  if ((signal.action === 'BUY' || signal.action === 'SELL') && signal.confidence != null) {
    return 'Setup quality is ' + signal.confidence + '. This is not a probability.';
  }
  return 'No probability is attached. Wait means the publication rules are not met on this scan.';
}

function briefFor(signal) {
  const bias = signal.action === 'BUY' ? 'Buy' : signal.action === 'SELL' ? 'Sell' : 'Wait';
  const published = signal.action === 'BUY' || signal.action === 'SELL';
  return {
    instrument: signal.instrument,
    name: signal.name || signal.instrument,
    bias,
    regime: signal.regime || null,
    session: signal.session || null,
    timeframe_note: 'The engine scores H1 and checks H4 and daily agreement. There is no separate 30-minute model.',
    confidence_text: signal.confidence_basis || confidenceText(signal),
    levels: published ? {
      entry: signal.entry,
      stop_loss: signal.stop_loss,
      take_profit_1: signal.take_profit_1,
      take_profit_2: signal.take_profit_2,
      risk_reward: signal.risk_reward
    } : null,
    key_levels: {
      support: signal.support == null ? null : signal.support,
      resistance: signal.resistance == null ? null : signal.resistance
    },
    rsi: signal.rsi == null ? null : signal.rsi,
    atr: signal.atr == null ? null : signal.atr,
    atr_ratio: signal.atr_ratio == null ? null : signal.atr_ratio,
    trend: signal.trend || null,
    mtf: signal.mtf || null,
    blockers: (signal.blockers || []).slice(0, 3)
  };
}

function annotateCalendar(items, now, beforeMin, afterMin) {
  const clock = (now instanceof Date ? now : new Date(now || Date.now())).getTime();
  const before = Number.isFinite(Number(beforeMin)) ? Number(beforeMin) : 30;
  const after = Number.isFinite(Number(afterMin)) ? Number(afterMin) : 30;
  return (items || []).map((event) => {
    const when = new Date(event && event.time).getTime();
    const minutes = Number.isFinite(when) ? Math.round(((when - clock) / 60000) * 10) / 10 : null;
    const impact = String(event && (event.risk || event.impact) || '').toUpperCase();
    const high = impact === 'HIGH' || impact.indexOf('HIGH') === 0;
    const pauses = high && minutes != null && minutes <= before && minutes >= -after;
    return Object.assign({}, event, {
      impact: high ? 'HIGH' : (impact || 'UNKNOWN'),
      minutes_until: minutes,
      pauses_new_signals: pauses,
      pause_note: high
        ? 'High impact. New signals pause from ' + before + ' minutes before this release until ' + after + ' minutes after it, on instruments the engine ties to ' + (event.currency || 'the release currency') + '.'
        : 'This impact does not open the news pause by itself. The pause is reserved for high-impact releases.'
    });
  });
}

function chartBars(candles, limit) {
  const rows = closes(candles).slice(-(limit || 180));
  return rows.map((bar) => {
    const time = Math.floor(new Date(bar.t).getTime() / 1000);
    return {
      time,
      open: Number(bar.o != null ? bar.o : bar.c),
      high: Number(bar.h),
      low: Number(bar.l),
      close: Number(bar.c)
    };
  }).filter((bar) => Number.isFinite(bar.time) && Number.isFinite(bar.close));
}

function chartOverlays(signal) {
  if (!signal) return [];
  const lines = [];
  const published = signal.action === 'BUY' || signal.action === 'SELL';
  if (published && signal.entry != null) lines.push({ price: signal.entry, title: 'Entry', color: '#d4af37' });
  if (published && signal.stop_loss != null) lines.push({ price: signal.stop_loss, title: 'Stop', color: '#e74c3c' });
  if (published && signal.take_profit_1 != null) lines.push({ price: signal.take_profit_1, title: 'TP1', color: '#2ecc71' });
  if (published && signal.take_profit_2 != null) lines.push({ price: signal.take_profit_2, title: 'TP2', color: '#1f8f4e' });
  if (signal.support != null) lines.push({ price: signal.support, title: 'Support', color: '#8b90a5' });
  if (signal.resistance != null) lines.push({ price: signal.resistance, title: 'Resistance', color: '#c5cadb' });
  return lines;
}

module.exports = {
  FX_PAIRS,
  percentChange,
  currencyStrength,
  pearson,
  correlationMatrix,
  sessionsAt,
  volatilityRows,
  scannerRows,
  briefFor,
  annotateCalendar,
  chartBars,
  chartOverlays
};
