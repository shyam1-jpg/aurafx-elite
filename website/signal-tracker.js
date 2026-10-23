'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { barOutcome } = require('./signal-math');

const DEFAULT_FILE = path.join(__dirname, 'data', 'signal-log.json');
const MAX_ROWS = 400;
const COOLDOWN_MS = 6 * 3600 * 1000;
const EXPIRY_BARS = 48;
const EXPIRY_WALL_MS = 96 * 3600 * 1000;

function coreStats(list) {
  const resolved = list.filter((r) => r.status === 'tp' || r.status === 'sl');
  const wins = resolved.filter((r) => r.status === 'tp');
  const losses = resolved.filter((r) => r.status === 'sl');
  const expired = list.filter((r) => r.status === 'expired');
  const open = list.filter((r) => r.status === 'open');
  const avg = resolved.length
    ? Math.round((resolved.reduce((s, r) => s + Number(r.result_r || 0), 0) / resolved.length) * 100) / 100
    : null;
  const grossWin = wins.reduce((s, r) => s + Math.max(0, Number(r.result_r || 0)), 0);
  const grossLoss = Math.abs(losses.reduce((s, r) => s + Number(r.result_r || 0), 0));
  let profitFactor = null;
  let profitFactorNote = null;
  if (grossLoss > 0) profitFactor = Math.round((grossWin / grossLoss) * 100) / 100;
  else if (grossWin > 0) profitFactorNote = 'No losing closes in this sample.';
  return {
    resolved: resolved.length,
    wins: wins.length,
    losses: losses.length,
    open: open.length,
    expired: expired.length,
    win_rate: resolved.length ? Math.round((wins.length / resolved.length) * 1000) / 1000 : null,
    average_r: avg,
    profit_factor: profitFactor,
    profit_factor_note: profitFactorNote
  };
}

function equityCurve(records) {
  const closed = (Array.isArray(records) ? records : [])
    .filter((row) => row.status === 'tp' || row.status === 'sl')
    .slice()
    .sort((a, b) => new Date(a.closed_at || a.opened_at || 0) - new Date(b.closed_at || b.opened_at || 0));
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  const points = [{ t: null, equity_r: 0, drawdown_r: 0 }];
  closed.forEach((row) => {
    equity = Math.round((equity + Number(row.result_r || 0)) * 100) / 100;
    if (equity > peak) peak = equity;
    const drawdown = Math.round((peak - equity) * 100) / 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    points.push({
      t: row.closed_at || null,
      instrument: row.instrument,
      result_r: Number(row.result_r || 0),
      equity_r: equity,
      drawdown_r: drawdown
    });
  });
  return { points, max_drawdown_r: maxDrawdown, ending_r: equity };
}

function publicSignal(row) {
  return {
    id: row.id,
    instrument: row.instrument,
    name: row.name || row.instrument,
    action: row.action,
    entry: row.entry,
    stop_loss: row.stop_loss,
    take_profit_1: row.take_profit_1,
    take_profit_2: row.take_profit_2,
    opened_at: row.opened_at,
    closed_at: row.closed_at,
    status: row.status,
    result_r: row.result_r,
    close_price: row.close_price,
    risk_reward: row.risk_reward
  };
}

function filterRecords(records, query) {
  const opts = query || {};
  const instrument = String(opts.instrument || '').toUpperCase();
  const month = String(opts.month || '');
  return (Array.isArray(records) ? records : []).filter((row) => {
    if (instrument && instrument !== 'ALL' && row.instrument !== instrument) return false;
    if (month && !String(row.opened_at || '').startsWith(month)) return false;
    return true;
  });
}

function buildTrackRecord(records, query) {
  const filtered = filterRecords(records, query);
  const measured = summariseRecords(filtered);
  const curve = equityCurve(filtered);
  const instruments = [...new Set((records || []).map((row) => row.instrument).filter(Boolean))].sort();
  const months = [...new Set((records || []).map((row) => String(row.opened_at || '').slice(0, 7)).filter((value) => /^\d{4}-\d{2}$/.test(value)))].sort();
  return {
    ok: true,
    instrument: query && query.instrument ? String(query.instrument).toUpperCase() : 'ALL',
    month: query && query.month ? String(query.month) : '',
    instruments,
    months,
    signals: filtered.map(publicSignal).sort((a, b) => new Date(b.opened_at || 0) - new Date(a.opened_at || 0)),
    measured: Object.assign({}, measured, {
      max_drawdown_r: curve.max_drawdown_r,
      sample_note: measured.resolved < 8 ? 'This sample is small and is not a forecast.' : null
    }),
    equity: curve.points,
    basis: 'Win rate, average R, profit factor and max drawdown use closed take-profit and stop results only. Expired and open signals stay in the table and out of those figures. This is a measured sample, not a forecast.'
  };
}

function summariseRecords(records) {
  const list = Array.isArray(records) ? records : [];
  const by = {};
  for (const row of list) {
    const key = row.instrument || 'UNKNOWN';
    if (!by[key]) by[key] = [];
    by[key].push(row);
  }
  const byInstrument = {};
  Object.keys(by).sort().forEach((key) => {
    byInstrument[key] = coreStats(by[key]);
  });
  return {
    ...coreStats(list),
    win_rate_basis: 'Closed signals that hit take-profit or stop-loss. Expired and open signals are excluded. This is a measured sample, not a forecast.',
    by_instrument: byInstrument
  };
}

function createTracker(options) {
  const opts = options || {};
  const file = opts.file || DEFAULT_FILE;
  const persist = opts.persist !== false;
  let signals = [];
  let loaded = false;
  let neonDisabled = !process.env.DATABASE_URL || opts.disableNeon === true;

  function readFile() {
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      return Array.isArray(raw.signals) ? raw.signals : [];
    } catch {
      return [];
    }
  }

  function writeFile(rows) {
    if (!persist) return;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ signals: rows, updated_at: new Date().toISOString() }));
    fs.renameSync(tmp, file);
  }

  async function neonSql() {
    if (neonDisabled) return null;
    const { neon } = require('@neondatabase/serverless');
    return neon(process.env.DATABASE_URL);
  }

  async function ready() {
    if (loaded) return;
    loaded = true;
    let rows = readFile();
    if (!neonDisabled && persist) {
      try {
        const sql = await neonSql();
        await sql`
          CREATE TABLE IF NOT EXISTS aura_signal_log (
            id TEXT PRIMARY KEY,
            payload JSONB NOT NULL,
            opened_at TIMESTAMPTZ NOT NULL
          )
        `;
        const found = await sql`SELECT payload FROM aura_signal_log ORDER BY opened_at ASC LIMIT ${MAX_ROWS}`;
        const neonRows = (found || []).map((r) => (typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload)).filter(Boolean);
        if (neonRows.length) rows = neonRows;
      } catch (error) {
        neonDisabled = true;
        console.warn('[AuraFX] signal tracker file fallback:', error.message);
      }
    }
    signals = rows.slice(-MAX_ROWS);
  }

  async function save() {
    signals = signals.slice(-MAX_ROWS);
    writeFile(signals);
    if (neonDisabled || !persist) return;
    try {
      const sql = await neonSql();
      for (const row of signals) {
        await sql`
          INSERT INTO aura_signal_log (id, payload, opened_at)
          VALUES (${row.id}, ${JSON.stringify(row)}::jsonb, ${row.opened_at})
          ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, opened_at = EXCLUDED.opened_at
        `;
      }
      const ids = signals.map((row) => row.id);
      if (ids.length) await sql`DELETE FROM aura_signal_log WHERE NOT (id = ANY(${ids}))`;
    } catch (error) {
      neonDisabled = true;
      console.warn('[AuraFX] signal tracker neon save skipped:', error.message);
    }
  }

  function markToMarket(position, price) {
    const risk = Math.abs(Number(position.entry) - Number(position.stop_loss));
    if (!risk || !Number.isFinite(price)) return 0;
    const diff = position.action === 'BUY' ? price - position.entry : position.entry - price;
    return Math.round((diff / risk) * 100) / 100;
  }

  function resolveOpen(position, candles, now) {
    const opened = new Date(position.opened_at).getTime();
    const after = (candles || []).filter((c) => new Date(c.t).getTime() > opened);
    for (const bar of after) {
      const hit = barOutcome(position, bar);
      if (hit) {
        return {
          status: hit.status,
          result_r: hit.result_r,
          close_price: hit.close_price,
          closed_at: bar.t
        };
      }
    }
    const expiredByBars = after.length >= EXPIRY_BARS;
    const expiredByTime = now.getTime() - opened >= EXPIRY_WALL_MS;
    if (expiredByBars || expiredByTime) {
      const last = after.length ? after[after.length - 1] : (candles || [])[candles.length - 1];
      const px = last ? last.c : position.entry;
      return {
        status: 'expired',
        result_r: markToMarket(position, px),
        close_price: px,
        closed_at: now.toISOString()
      };
    }
    return { status: 'open', result_r: null, close_price: null, closed_at: null };
  }

  async function sync(setups, candleMap, now) {
    await ready();
    const clock = now instanceof Date ? now : new Date(now || Date.now());
    const publishedNow = [];
    const closedNow = [];
    for (const setup of setups) {
      const candles = (candleMap && candleMap[setup.instrument]) || [];
      const open = signals.find((s) => s.instrument === setup.instrument && s.status === 'open');
      if (open) {
        const next = resolveOpen(open, candles, clock);
        if (next.status !== 'open') {
          Object.assign(open, next);
          if (next.status === 'tp' || next.status === 'sl') closedNow.push(Object.assign({}, open));
        }
      }
      if (!setup.published) continue;
      const stillOpen = signals.find((s) => s.instrument === setup.instrument && s.status === 'open');
      if (stillOpen) continue;
      const prior = signals.filter((s) => s.instrument === setup.instrument);
      const last = prior[prior.length - 1];
      if (last && last.closed_at && clock.getTime() - new Date(last.closed_at).getTime() < COOLDOWN_MS) continue;
      const row = {
        id: crypto.randomBytes(8).toString('hex'),
        instrument: setup.instrument,
        name: setup.name,
        action: setup.action,
        confidence: setup.confidence,
        entry: setup.entry,
        stop_loss: setup.stop_loss,
        take_profit_1: setup.take_profit_1,
        take_profit_2: setup.take_profit_2,
        risk_reward: setup.risk_reward,
        opened_at: clock.toISOString(),
        status: 'open',
        result_r: null,
        closed_at: null,
        close_price: null,
        timeframe: 'H1'
      };
      signals.push(row);
      publishedNow.push(Object.assign({}, row));
    }
    await save();
    return Object.assign(snapshot(), { events: { published: publishedNow, closed: closedNow } });
  }

  function trackRecord(query) {
    return buildTrackRecord(signals, query || {});
  }

  function snapshot() {
    const history = signals.slice().reverse();
    return {
      measured: summariseRecords(signals),
      history: history.slice(0, 40),
      logged: signals.length
    };
  }

  return { ready, sync, snapshot, summariseRecords, trackRecord };
}

module.exports = {
  createTracker,
  summariseRecords,
  equityCurve,
  buildTrackRecord,
  DEFAULT_FILE,
  COOLDOWN_MS,
  EXPIRY_BARS
};
