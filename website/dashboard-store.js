'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
const DATA_DIR = path.join(__dirname, 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'dashboard-history.json');
const EVENTS_FILE = path.join(DATA_DIR, 'dashboard-events.json');
const JOURNAL_FILE = path.join(DATA_DIR, 'dashboard-journal.json');

const MAX_HISTORY = 1440;
const MAX_EVENTS = 200;

const DASHBOARD_SECRET = process.env.ADMIN_SESSION_SECRET ||
  process.env.AURAFX_OWNER_KEY ||
  'aurafx-dashboard-local-dev-change-me';

let sql = null;
let initPromise = null;
let neonDisabled = false;

function useNeon() {
  return !!DATABASE_URL && !neonDisabled;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(file, fallback) {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  ensureDataDir();
  fs.writeFileSync(file, JSON.stringify(data), 'utf8');
}

function makeDashboardToken(registrationId, email) {
  return crypto.createHmac('sha256', DASHBOARD_SECRET)
    .update(String(registrationId) + '|' + String(email || '').trim().toLowerCase())
    .digest('hex');
}

function verifyDashboardToken(registrationId, email, token) {
  if (!registrationId || !email || !token) return false;
  const expected = makeDashboardToken(registrationId, email);
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(String(token));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function initNeon() {
  const { neon } = require('@neondatabase/serverless');
  sql = neon(DATABASE_URL);
  await sql`
    CREATE TABLE IF NOT EXISTS dashboard_history (
      id BIGSERIAL PRIMARY KEY,
      ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      mood TEXT,
      score INT,
      bullish_prob INT,
      session_risk TEXT
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS dashboard_events (
      id BIGSERIAL PRIMARY KEY,
      ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      level TEXT NOT NULL DEFAULT 'info',
      message TEXT NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS dashboard_journal (
      registration_id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      entries JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_dashboard_history_ts ON dashboard_history (ts DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_dashboard_events_ts ON dashboard_events (ts DESC)`;
}

function init() {
  if (!useNeon()) return Promise.resolve();
  if (!initPromise) {
    initPromise = initNeon().catch((e) => {
      neonDisabled = true;
      sql = null;
      initPromise = null;
      console.warn('[AuraFX dashboard-store] Neon unavailable — using files:', e.message);
    });
  }
  return initPromise;
}

function storageInfo() {
  return { backend: useNeon() ? 'neon' : 'file' };
}

async function appendHistory(point) {
  const row = {
    ts: point.ts || new Date().toISOString(),
    mood: point.mood || 'NEUTRAL',
    score: Number(point.score) || 0,
    bullishProb: Number(point.bullishProb) || 50,
    sessionRisk: point.sessionRisk || 'MEDIUM'
  };
  if (useNeon()) {
    await init();
    if (sql) {
      await sql`
        INSERT INTO dashboard_history (ts, mood, score, bullish_prob, session_risk)
        VALUES (${row.ts}, ${row.mood}, ${row.score}, ${row.bullishProb}, ${row.sessionRisk})
      `;
      await sql`DELETE FROM dashboard_history WHERE id NOT IN (
        SELECT id FROM dashboard_history ORDER BY ts DESC LIMIT ${MAX_HISTORY}
      )`;
      return row;
    }
  }
  const list = readJson(HISTORY_FILE, []);
  list.push(row);
  while (list.length > MAX_HISTORY) list.shift();
  writeJson(HISTORY_FILE, list);
  return row;
}

async function appendEvent(level, message) {
  const row = {
    ts: new Date().toISOString(),
    level: level || 'info',
    message: String(message || '').slice(0, 500)
  };
  if (useNeon()) {
    await init();
    if (sql) {
      await sql`INSERT INTO dashboard_events (level, message) VALUES (${row.level}, ${row.message})`;
      await sql`DELETE FROM dashboard_events WHERE id NOT IN (
        SELECT id FROM dashboard_events ORDER BY ts DESC LIMIT ${MAX_EVENTS}
      )`;
      return row;
    }
  }
  const list = readJson(EVENTS_FILE, []);
  list.unshift(row);
  while (list.length > MAX_EVENTS) list.pop();
  writeJson(EVENTS_FILE, list);
  return row;
}

function rangeToMs(range) {
  const map = { live: 5 * 60 * 1000, '5m': 5 * 60 * 1000, '1h': 60 * 60 * 1000, '24h': 24 * 60 * 60 * 1000 };
  return map[range] || map['1h'];
}

async function getHistory(range) {
  const since = new Date(Date.now() - rangeToMs(range)).toISOString();
  if (useNeon()) {
    await init();
    if (sql) {
      const rows = await sql`
        SELECT ts, mood, score, bullish_prob AS "bullishProb", session_risk AS "sessionRisk"
        FROM dashboard_history WHERE ts >= ${since} ORDER BY ts ASC
      `;
      return rows;
    }
  }
  return readJson(HISTORY_FILE, []).filter((r) => r.ts >= since);
}

async function getEvents(limit) {
  const n = Math.min(Number(limit) || 50, 100);
  if (useNeon()) {
    await init();
    if (sql) {
      return sql`
        SELECT ts, level, message FROM dashboard_events ORDER BY ts DESC LIMIT ${n}
      `;
    }
  }
  return readJson(EVENTS_FILE, []).slice(0, n);
}

async function getJournal(registrationId) {
  if (useNeon()) {
    await init();
    if (sql) {
      const rows = await sql`
        SELECT entries FROM dashboard_journal WHERE registration_id = ${registrationId} LIMIT 1
      `;
      if (!rows.length) return [];
      const entries = rows[0].entries;
      return Array.isArray(entries) ? entries : [];
    }
  }
  const map = readJson(JOURNAL_FILE, {});
  return Array.isArray(map[registrationId]) ? map[registrationId] : [];
}

async function saveJournal(registrationId, email, entries) {
  const safe = Array.isArray(entries) ? entries.slice(-500) : [];
  if (useNeon()) {
    await init();
    if (sql) {
      await sql`
        INSERT INTO dashboard_journal (registration_id, email, entries, updated_at)
        VALUES (${registrationId}, ${email}, ${JSON.stringify(safe)}::jsonb, NOW())
        ON CONFLICT (registration_id) DO UPDATE SET
          entries = EXCLUDED.entries,
          email = EXCLUDED.email,
          updated_at = NOW()
      `;
      return safe;
    }
  }
  const map = readJson(JOURNAL_FILE, {});
  map[registrationId] = safe;
  writeJson(JOURNAL_FILE, map);
  return safe;
}

module.exports = {
  init,
  storageInfo,
  makeDashboardToken,
  verifyDashboardToken,
  appendHistory,
  appendEvent,
  getHistory,
  getEvents,
  getJournal,
  saveJournal
};
