/**
 * Client registrations — Neon Postgres when DATABASE_URL is set, else local JSON file.
 */
const fs = require('fs');
const path = require('path');

const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
const DATA_DIR = path.join(__dirname, 'data');
const REG_FILE = path.join(DATA_DIR, 'registrations.json');

let sql = null;
let initPromise = null;

function useNeon() {
  return !!DATABASE_URL;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJsonFile() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(REG_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeJsonFile(list) {
  ensureDataDir();
  fs.writeFileSync(REG_FILE, JSON.stringify(list, null, 2), 'utf8');
}

function rowFromDb(r) {
  const data = r.data;
  if (!data) return null;
  return typeof data === 'string' ? JSON.parse(data) : data;
}

async function initNeon() {
  const { neon } = require('@neondatabase/serverless');
  sql = neon(DATABASE_URL);
  await sql`
    CREATE TABLE IF NOT EXISTS registrations (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      verify_token TEXT,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_registrations_verify_token
    ON registrations (verify_token)
    WHERE verify_token IS NOT NULL
  `;

  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM registrations`;
  if (count === 0) {
    const local = readJsonFile();
    if (local.length) {
      for (const row of local) {
        await upsertNeon(row);
      }
      console.log('[AuraFX] Imported', local.length, 'registration(s) from JSON into Neon');
    }
  }
}

async function upsertNeon(row) {
  await sql`
    INSERT INTO registrations (id, email, verify_token, data, updated_at)
    VALUES (
      ${row.id},
      ${row.email},
      ${row.verifyToken || null},
      ${JSON.stringify(row)}::jsonb,
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      verify_token = EXCLUDED.verify_token,
      data = EXCLUDED.data,
      updated_at = NOW()
  `;
}

function init() {
  if (!useNeon()) return Promise.resolve();
  if (!initPromise) {
    initPromise = initNeon().catch((e) => {
      initPromise = null;
      throw e;
    });
  }
  return initPromise;
}

async function getRegistrations() {
  if (!useNeon()) return readJsonFile();
  await init();
  const rows = await sql`SELECT data FROM registrations ORDER BY updated_at DESC`;
  return rows.map(rowFromDb).filter(Boolean);
}

async function findByEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  if (!useNeon()) {
    return readJsonFile().find((r) => r.email === normalized) || null;
  }
  await init();
  const rows = await sql`SELECT data FROM registrations WHERE email = ${normalized} LIMIT 1`;
  return rows.length ? rowFromDb(rows[0]) : null;
}

async function findByVerifyToken(token) {
  if (!token) return null;
  if (!useNeon()) {
    return readJsonFile().find((r) => r.verifyToken === token) || null;
  }
  await init();
  const rows = await sql`SELECT data FROM registrations WHERE verify_token = ${token} LIMIT 1`;
  return rows.length ? rowFromDb(rows[0]) : null;
}

async function saveRegistration(row) {
  if (!useNeon()) {
    const list = readJsonFile();
    const i = list.findIndex((r) => r.email === row.email);
    if (i >= 0) list[i] = row;
    else list.push(row);
    writeJsonFile(list);
    return row;
  }
  await init();
  await upsertNeon(row);
  return row;
}

function storageInfo() {
  return {
    backend: useNeon() ? 'neon' : 'file',
    path: useNeon() ? null : REG_FILE
  };
}

module.exports = {
  init,
  useNeon,
  getRegistrations,
  findByEmail,
  findByVerifyToken,
  saveRegistration,
  storageInfo
};
