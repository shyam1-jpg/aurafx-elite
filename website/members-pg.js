'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Pool } = require('pg');
const { createMembersStore } = require('./members-store');

const DEFAULT_FILE = path.join(__dirname, 'data', 'members.json');

function createPgMembersStore(options) {
  const opts = options || {};
  const pool = opts.pool || new Pool({ connectionString: opts.connectionString });
  const importFile = opts.file || process.env.MEMBERS_FILE || DEFAULT_FILE;
  const snapshot = path.join(os.tmpdir(), 'aura-members-pg-' + process.pid + '-' + Math.random().toString(16).slice(2) + '.json');
  const inner = createMembersStore({ file: snapshot });
  let ready;
  let clock = 0;

  function writeSnapshot(members) {
    fs.mkdirSync(path.dirname(snapshot), { recursive: true });
    clock = Math.max(Date.now(), clock + 1);
    fs.writeFileSync(snapshot, JSON.stringify({ members: members || [] }));
    const stamp = new Date(clock);
    fs.utimesSync(snapshot, stamp, stamp);
  }

  function readSnapshot() {
    try {
      const raw = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
      return Array.isArray(raw.members) ? raw.members : [];
    } catch (error) {
      return [];
    }
  }

  async function pull() {
    const result = await pool.query('SELECT id, email, name, salt, hash, tier, watchlist, alerts, journal, chart_desk, google_sub, stripe_customer_id, created_at FROM members ORDER BY created_at ASC');
    const members = result.rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      salt: row.salt,
      hash: row.hash,
      tier: row.tier,
      watchlist: parseJson(row.watchlist, []),
      alerts: parseJson(row.alerts, []),
      journal: parseJson(row.journal, []),
      chart_desk: parseJson(row.chart_desk, null),
      google_sub: row.google_sub || '',
      stripe_customer_id: row.stripe_customer_id || '',
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at
    }));
    writeSnapshot(members);
  }

  async function push() {
    const members = readSnapshot();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM members');
      for (const row of members) {
        await client.query(
          `INSERT INTO members
            (id, email, name, salt, hash, tier, watchlist, alerts, journal, chart_desk, google_sub, stripe_customer_id, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [
            row.id,
            row.email,
            row.name,
            row.salt,
            row.hash,
            row.tier || 'free',
            JSON.stringify(row.watchlist || []),
            JSON.stringify(row.alerts || []),
            JSON.stringify(row.journal || []),
            row.chart_desk ? JSON.stringify(row.chart_desk) : null,
            row.google_sub || '',
            row.stripe_customer_id || '',
            row.created_at || new Date().toISOString()
          ]
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (rollbackError) { /* already closed */ }
      throw error;
    } finally {
      client.release();
    }
  }

  async function readCall(fn) {
    await ready;
    await pull();
    return fn();
  }

  async function writeCall(fn) {
    await ready;
    await pull();
    const value = fn();
    await push();
    return value;
  }

  async function init() {
    await pool.query(`CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      salt TEXT NOT NULL,
      hash TEXT NOT NULL,
      tier TEXT NOT NULL DEFAULT 'free',
      watchlist TEXT NOT NULL DEFAULT '[]',
      alerts TEXT NOT NULL DEFAULT '[]',
      journal TEXT NOT NULL DEFAULT '[]',
      chart_desk TEXT,
      google_sub TEXT NOT NULL DEFAULT '',
      stripe_customer_id TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS member_billing_events (
      id TEXT PRIMARY KEY,
      received_at TEXT NOT NULL
    )`);
    const count = await pool.query('SELECT COUNT(*) AS n FROM members');
    const existing = Number(count.rows[0].n);
    if (existing === 0 && fs.existsSync(importFile)) {
      let imported = [];
      try {
        const raw = JSON.parse(fs.readFileSync(importFile, 'utf8'));
        imported = Array.isArray(raw.members) ? raw.members : [];
      } catch (error) {
        imported = [];
      }
      if (imported.length) {
        writeSnapshot(imported);
        await push();
        console.log('[AuraFX members] Imported ' + imported.length + ' member account' + (imported.length === 1 ? '' : 's') + ' from members.json into Postgres.');
      }
    }
    await pull();
  }

  ready = init();

  return {
    storage: 'postgres',
    file: importFile,
    init: () => ready,
    register: (...args) => writeCall(() => inner.register(...args)),
    login: (...args) => readCall(() => inner.login(...args)),
    loginGoogle: (...args) => writeCall(() => inner.loginGoogle(...args)),
    setTier: (...args) => writeCall(() => inner.setTier(...args)),
    updateWatchlist: (...args) => writeCall(() => inner.updateWatchlist(...args)),
    updateAlerts: (...args) => writeCall(() => inner.updateAlerts(...args)),
    updateJournal: (...args) => writeCall(() => inner.updateJournal(...args)),
    getChartDesk: (...args) => readCall(() => inner.getChartDesk(...args)),
    updateChartDesk: (...args) => writeCall(() => inner.updateChartDesk(...args)),
    memberFromRequest: (...args) => readCall(() => inner.memberFromRequest(...args)),
    listPublic: (...args) => readCall(() => inner.listPublic(...args)),
    findByEmail: (...args) => readCall(() => inner.findByEmail(...args)),
    setStripeCustomer: (...args) => writeCall(() => inner.setStripeCustomer(...args)),
    findByStripeCustomer: (...args) => readCall(() => inner.findByStripeCustomer(...args)),
    sessionCookie: (...args) => inner.sessionCookie(...args),
    clearCookie: (...args) => inner.clearCookie(...args),
    publicMember: (...args) => inner.publicMember(...args),
    async claimBillingEvent(id) {
      await ready;
      const key = String(id || '');
      if (!key) return false;
      const existing = await pool.query('SELECT id FROM member_billing_events WHERE id = $1', [key]);
      if (existing.rows.length) return false;
      try {
        await pool.query('INSERT INTO member_billing_events (id, received_at) VALUES ($1, $2)', [key, new Date().toISOString()]);
      } catch (error) {
        return false;
      }
      return true;
    }
  };
}

function parseJson(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch (error) { return fallback; }
}

module.exports = { createPgMembersStore };
