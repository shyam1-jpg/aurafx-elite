'use strict';

const { ema, rsi, atr, macd, resample } = require('./signal-math');
const { chartBars } = require('./market-analytics');

const M15_NOTE = 'M15 is not in the price feed. The server loads hourly and daily candles. H4 is grouped from those hourly candles. No 15-minute bars are invented.';

function round(value) {
  return Math.round(Number(value) * 1e8) / 1e8;
}

function align(bars, values) {
  const out = [];
  for (let i = 0; i < bars.length; i++) {
    if (values[i] == null || !Number.isFinite(values[i])) continue;
    out.push({ time: bars[i].time, value: round(values[i]) });
  }
  return out;
}

function bollinger(values, period, mult) {
  const p = period || 20;
  const m = mult == null ? 2 : mult;
  const upper = new Array(values.length).fill(null);
  const middle = new Array(values.length).fill(null);
  const lower = new Array(values.length).fill(null);
  for (let i = p - 1; i < values.length; i++) {
    let sum = 0;
    for (let j = 0; j < p; j++) sum += values[i - j];
    const mean = sum / p;
    let acc = 0;
    for (let j = 0; j < p; j++) {
      const delta = values[i - j] - mean;
      acc += delta * delta;
    }
    const sd = Math.sqrt(acc / p);
    middle[i] = mean;
    upper[i] = mean + m * sd;
    lower[i] = mean - m * sd;
  }
  return { upper, middle, lower };
}

function bucketKey(iso, hours) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const hour = date.getUTCHours();
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour - (hour % hours), 0, 0, 0)).toISOString();
}

function h4FromHourly(hourly) {
  const grouped = resample(hourly || [], 4);
  const parts = new Map();
  (hourly || []).forEach((candle) => {
    const key = bucketKey(candle.t, 4);
    if (!key) return;
    if (!parts.has(key)) parts.set(key, []);
    parts.get(key).push(candle);
  });
  return grouped.map((row) => {
    const next = { t: row.t, o: row.o, h: row.h, l: row.l, c: row.c };
    const group = parts.get(row.t) || [];
    const complete = group.length > 0 && group.every((candle) => Number.isFinite(Number(candle.v)) && Number(candle.v) >= 0);
    if (complete) next.v = group.reduce((sum, candle) => sum + Number(candle.v), 0);
    return next;
  });
}

function volumeState(bars) {
  if (!bars.length) return { available: false, note: '' };
  const tagged = bars.every((bar) => Object.prototype.hasOwnProperty.call(bar, 'volume'));
  if (!tagged) {
    return {
      available: false,
      note: ' Volume is missing on this feed, so volume and VWAP are not drawn.'
    };
  }
  if (!bars.some((bar) => bar.volume > 0)) {
    return {
      available: false,
      note: ' Volume on this feed is zero, so volume and VWAP are not drawn.'
    };
  }
  return {
    available: true,
    note: ' Volume is the amount reported by the feed. VWAP resets each UTC day.'
  };
}

function stripVolume(bars) {
  return bars.map((bar) => {
    const next = {
      time: bar.time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close
    };
    return next;
  });
}

function sessionVwap(bars) {
  let day = '';
  let pv = 0;
  let vol = 0;
  const out = [];
  bars.forEach((bar) => {
    const key = new Date(bar.time * 1000).toISOString().slice(0, 10);
    if (key !== day) {
      day = key;
      pv = 0;
      vol = 0;
    }
    const size = Number(bar.volume);
    if (!(size > 0)) return;
    const typical = (bar.high + bar.low + bar.close) / 3;
    pv += typical * size;
    vol += size;
    out.push({ time: bar.time, value: round(pv / vol) });
  });
  return out;
}

function indicatorsFor(bars, volumeAvailable) {
  const closes = bars.map((bar) => bar.close);
  const candles = bars.map((bar) => ({
    t: new Date(bar.time * 1000).toISOString(),
    o: bar.open,
    h: bar.high,
    l: bar.low,
    c: bar.close
  }));
  const bands = bollinger(closes, 20, 2);
  const macdLine = macd(closes, 12, 26, 9);
  return {
    ema20: align(bars, ema(closes, 20)),
    ema50: align(bars, ema(closes, 50)),
    ema200: align(bars, ema(closes, 200)),
    bollinger: {
      upper: align(bars, bands.upper),
      middle: align(bars, bands.middle),
      lower: align(bars, bands.lower)
    },
    vwap: volumeAvailable ? sessionVwap(bars) : [],
    rsi: align(bars, rsi(closes, 14)),
    macd: {
      line: align(bars, macdLine.line),
      signal: align(bars, macdLine.signal),
      hist: align(bars, macdLine.hist)
    },
    atr: align(bars, atr(candles, 14)),
    volume: volumeAvailable ? bars.map((bar) => ({ time: bar.time, value: bar.volume })) : []
  };
}

function candleView(pack, timeframe) {
  const tf = String(timeframe || 'H1').toUpperCase();
  if (tf === 'M15') {
    return {
      ok: false,
      available: false,
      timeframe: 'M15',
      bars: [],
      volume_available: false,
      indicators: null,
      note: M15_NOTE
    };
  }
  if (tf !== 'H1' && tf !== 'H4' && tf !== 'D1') {
    return {
      ok: false,
      available: false,
      timeframe: tf,
      bars: [],
      volume_available: false,
      indicators: null,
      note: 'Choose M15, H1, H4 or D1. Only H1, H4 and D1 have candles on this server.'
    };
  }
  const source = pack || {};
  let rows = [];
  let note = '';
  if (tf === 'H1') {
    rows = source.h1 || [];
    note = 'Hourly candles from the price feed.';
  } else if (tf === 'D1') {
    rows = source.d1 || [];
    note = 'Daily candles from the price feed.';
  } else {
    rows = h4FromHourly(source.h1 || []);
    note = 'H4 candles are grouped from the hourly feed. They are not a separate broker download.';
  }
  let bars = chartBars(rows, 180);
  if (!bars.length) {
    return {
      ok: false,
      available: false,
      timeframe: tf,
      bars: [],
      volume_available: false,
      indicators: null,
      note: 'No ' + tf + ' candles are available for this instrument. ' + (tf === 'H4' ? 'H4 needs hourly candles to group.' : '')
    };
  }
  const volume = volumeState(bars);
  if (!volume.available) bars = stripVolume(bars);
  return {
    ok: true,
    available: true,
    timeframe: tf,
    bars,
    volume_available: volume.available,
    indicators: indicatorsFor(bars, volume.available),
    note: note + volume.note + ' Entry, stop and targets are drawn only when a Buy or Sell is published. Support and resistance are the engine swing levels when the scan measured them. Those levels come from the hourly engine.'
  };
}

module.exports = {
  M15_NOTE,
  bollinger,
  h4FromHourly,
  candleView,
  indicatorsFor
};
