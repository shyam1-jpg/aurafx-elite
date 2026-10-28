'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const COOKIE_NAME = 'aurafx_member';
const SESSION_MS = 14 * 24 * 60 * 60 * 1000;
const DEFAULT_FILE = path.join(__dirname, 'data', 'members.json');
const TIERS = ['free', 'pro', 'elite'];
const TIER_RANK = { free: 0, pro: 1, elite: 2 };

function sessionSecret() {
  return process.env.MEMBER_SESSION_SECRET ||
    process.env.ADMIN_SESSION_SECRET ||
    process.env.AURAFX_OWNER_KEY ||
    'aurafx-member-local';
}

function parseCookies(req) {
  const out = {};
  String((req && req.headers && req.headers.cookie) || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function signSession(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', sessionSecret()).update(data).digest('base64url');
  return data + '.' + sig;
}

function verifySession(token) {
  if (!token || token.indexOf('.') < 0) return null;
  const dot = token.indexOf('.');
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', sessionSecret()).update(data).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (!payload || !payload.id || !payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch (error) {
    return null;
  }
}

function cookieHeader(token, maxAgeSec, secure) {
  const flag = secure ? '; Secure' : '';
  return COOKIE_NAME + '=' + encodeURIComponent(token) +
    '; Path=/; HttpOnly; SameSite=Lax' + flag + '; Max-Age=' + maxAgeSec;
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function hashPassword(password, salt) {
  const used = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), used, 32).toString('hex');
  return { salt: used, hash };
}

function passwordMatches(password, row) {
  if (!row || !row.salt || !row.hash) return false;
  const hash = crypto.scryptSync(String(password), row.salt, 32);
  const expected = Buffer.from(row.hash, 'hex');
  if (hash.length !== expected.length) return false;
  return crypto.timingSafeEqual(hash, expected);
}

function createMembersStore(options) {
  const opts = options || {};
  const file = opts.file || process.env.MEMBERS_FILE || DEFAULT_FILE;
  const attempts = new Map();
  let rows = [];
  let loadedMtime;

  function load() {
    let mtime = null;
    try { mtime = fs.statSync(file).mtimeMs; } catch (error) { mtime = null; }
    if (loadedMtime !== undefined && mtime === loadedMtime) return;
    loadedMtime = mtime;
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      rows = Array.isArray(raw.members) ? raw.members : [];
    } catch (error) {
      rows = [];
    }
  }

  function save() {
    if (opts.persist === false) return;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ members: rows, updated_at: new Date().toISOString() }, null, 2));
    fs.renameSync(tmp, file);
    try { loadedMtime = fs.statSync(file).mtimeMs; } catch (error) { loadedMtime = null; }
  }

  function publicMember(row) {
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      tier: TIERS.includes(row.tier) ? row.tier : 'free',
      watchlist: Array.isArray(row.watchlist) ? row.watchlist.slice() : [],
      alerts: Array.isArray(row.alerts) ? row.alerts.map(publicAlert) : [],
      journal: Array.isArray(row.journal) ? row.journal.slice() : [],
      google: !!row.google_sub,
      created_at: row.created_at
    };
  }

  function publicAlert(alert) {
    return {
      id: alert.id,
      type: alert.type,
      instrument: alert.instrument,
      op: alert.op || null,
      price: alert.price == null ? null : alert.price,
      regime: alert.regime || null,
      channel: alert.channel || 'email'
    };
  }

  function findByEmail(email) {
    load();
    const key = String(email || '').trim().toLowerCase();
    return rows.find((row) => row.email === key) || null;
  }

  function findById(id) {
    load();
    return rows.find((row) => row.id === id) || null;
  }

  function rateLimit(ip) {
    const now = Date.now();
    let rec = attempts.get(ip);
    if (!rec || now - rec.firstAt > 15 * 60 * 1000) {
      rec = { count: 0, firstAt: now };
      attempts.set(ip, rec);
    }
    return rec.count < 8;
  }

  function fail(ip) {
    const rec = attempts.get(ip) || { count: 0, firstAt: Date.now() };
    rec.count += 1;
    attempts.set(ip, rec);
  }

  function register(input) {
    load();
    const body = input || {};
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (name.length < 2 || name.length > 80) {
      const error = new Error('Enter your name.');
      error.status = 400;
      throw error;
    }
    if (!validEmail(email)) {
      const error = new Error('Enter a valid email address.');
      error.status = 400;
      throw error;
    }
    if (password.length < 8 || password.length > 200) {
      const error = new Error('Use a password of at least 8 characters.');
      error.status = 400;
      throw error;
    }
    if (body.acceptRisk !== true) {
      const error = new Error('Accept the risk warning before creating an account.');
      error.status = 400;
      throw error;
    }
    if (findByEmail(email)) {
      const error = new Error('An account with that email already exists. Log in instead.');
      error.status = 409;
      throw error;
    }
    const secret = hashPassword(password);
    const row = {
      id: crypto.randomBytes(8).toString('hex'),
      email,
      name,
      salt: secret.salt,
      hash: secret.hash,
      tier: 'free',
      watchlist: [],
      alerts: [],
      journal: [],
      google_sub: '',
      created_at: new Date().toISOString()
    };
    rows.push(row);
    save();
    return publicMember(row);
  }

  function login(email, password, ip) {
    load();
    const key = String(ip || 'unknown');
    if (!rateLimit(key)) {
      const error = new Error('Too many attempts. Try again in 15 minutes.');
      error.status = 429;
      throw error;
    }
    const row = findByEmail(email);
    if (!row || !passwordMatches(password, row)) {
      fail(key);
      const error = new Error('Email or password is not recognised.');
      error.status = 401;
      throw error;
    }
    attempts.delete(key);
    return publicMember(row);
  }

  function loginGoogle(profile) {
    load();
    const email = String(profile && profile.email || '').trim().toLowerCase();
    const sub = String(profile && profile.sub || '').trim();
    if (!validEmail(email) || !sub) {
      const error = new Error('Google did not return an email for this account.');
      error.status = 400;
      throw error;
    }
    const row = findByEmail(email);
    if (!row) {
      const error = new Error('Create an AuraFX account and accept the risk warning before using Google on this email.');
      error.status = 404;
      throw error;
    }
    row.google_sub = sub;
    save();
    return publicMember(row);
  }

  function setTier(email, tier) {
    load();
    const row = findByEmail(email);
    if (!row) {
      const error = new Error('Member not found.');
      error.status = 404;
      throw error;
    }
    const next = String(tier || '').toLowerCase();
    if (!TIERS.includes(next)) {
      const error = new Error('Tier must be free, pro, or elite.');
      error.status = 400;
      throw error;
    }
    row.tier = next;
    save();
    return publicMember(row);
  }

  function updateWatchlist(id, instruments, known) {
    load();
    const row = findById(id);
    if (!row) {
      const error = new Error('Sign in to save a watchlist.');
      error.status = 401;
      throw error;
    }
    const allow = new Set((known || []).map((item) => String(item).toUpperCase()));
    const list = [];
    (Array.isArray(instruments) ? instruments : []).forEach((item) => {
      const code = String(item || '').toUpperCase();
      if (allow.has(code) && list.indexOf(code) < 0) list.push(code);
    });
    row.watchlist = list.slice(0, 15);
    save();
    return publicMember(row);
  }

  function updateAlerts(id, alerts) {
    load();
    const row = findById(id);
    if (!row) {
      const error = new Error('Sign in to save alerts.');
      error.status = 401;
      throw error;
    }
    const next = [];
    (Array.isArray(alerts) ? alerts : []).slice(0, 20).forEach((alert) => {
      const type = String(alert && alert.type || '');
      if (type !== 'price' && type !== 'signal' && type !== 'regime') return;
      const instrument = String(alert.instrument || '').toUpperCase();
      if (!instrument) return;
      const channel = ['email', 'telegram', 'both'].includes(alert.channel) ? alert.channel : 'email';
      const item = {
        id: String(alert.id || crypto.randomBytes(4).toString('hex')),
        type,
        instrument,
        channel
      };
      if (type === 'price') {
        const price = Number(alert.price);
        const op = alert.op === 'below' ? 'below' : 'above';
        if (!(price > 0)) return;
        item.op = op;
        item.price = price;
      }
      if (type === 'regime') {
        const regime = String(alert.regime || '').toLowerCase();
        if (regime !== 'trending' && regime !== 'ranging' && regime !== 'volatile') return;
        item.regime = regime;
      }
      next.push(item);
    });
    row.alerts = next;
    save();
    return publicMember(row);
  }

  function updateJournal(id, entries) {
    load();
    const row = findById(id);
    if (!row) {
      const error = new Error('Sign in to save a journal.');
      error.status = 401;
      throw error;
    }
    const next = [];
    (Array.isArray(entries) ? entries : []).slice(-80).forEach((entry) => {
      const instrument = String(entry && entry.instrument || '').toUpperCase();
      const side = String(entry && entry.side || '').toUpperCase();
      if (!instrument || (side !== 'BUY' && side !== 'SELL')) return;
      next.push({
        id: String(entry.id || crypto.randomBytes(4).toString('hex')),
        instrument,
        side,
        entry: Number(entry.entry) || null,
        stop: Number(entry.stop) || null,
        target: Number(entry.target) || null,
        size: String(entry.size || '').slice(0, 40),
        note: String(entry.note || '').slice(0, 500),
        opened_at: entry.opened_at || new Date().toISOString()
      });
    });
    row.journal = next;
    save();
    return publicMember(row);
  }

  function cleanPoint(point) {
    const time = Number(point && point.time);
    const price = Number(point && point.price);
    if (!Number.isFinite(time) || !Number.isFinite(price) || !(price > 0)) return null;
    return { time: Math.round(time), price };
  }

  function cleanDrawings(drawings) {
    const types = { trendline: 2, hline: 1, fib: 2, rect: 2 };
    const out = [];
    (Array.isArray(drawings) ? drawings : []).slice(0, 30).forEach((drawing) => {
      const type = String(drawing && drawing.type || '');
      const need = types[type];
      if (!need) return;
      const a = cleanPoint(drawing.a);
      const b = need === 2 ? cleanPoint(drawing.b) : null;
      if (!a || (need === 2 && !b)) return;
      const item = {
        id: String(drawing.id || crypto.randomBytes(4).toString('hex')).slice(0, 24),
        type,
        a
      };
      if (b) item.b = b;
      out.push(item);
    });
    return out;
  }

  function defaultIndicators() {
    return {
      ema20: false,
      ema50: false,
      ema200: false,
      bollinger: false,
      vwap: false,
      rsi: false,
      macd: false,
      atr: false,
      volume: false
    };
  }

  function cleanPane(pane, known, index) {
    const allow = new Set((known || []).map((item) => String(item).toUpperCase()));
    const instrument = String(pane && pane.instrument || 'XAUUSD').toUpperCase();
    const styles = ['candles', 'hollow', 'heikin', 'bars', 'line', 'area'];
    const frames = ['M15', 'H1', 'H4', 'D1'];
    const style = String(pane && pane.style || 'candles');
    const timeframe = String(pane && pane.timeframe || 'H1').toUpperCase();
    const indicators = defaultIndicators();
    const incoming = pane && pane.indicators || {};
    Object.keys(indicators).forEach((key) => {
      indicators[key] = !!incoming[key];
    });
    return {
      id: String(pane && pane.id || ('p' + (index + 1))).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16) || ('p' + (index + 1)),
      instrument: allow.size && !allow.has(instrument) ? 'XAUUSD' : instrument,
      timeframe: frames.includes(timeframe) ? timeframe : 'H1',
      style: styles.includes(style) ? style : 'candles',
      indicators,
      drawings: cleanDrawings(pane && pane.drawings)
    };
  }

  function emptyChartDesk() {
    return {
      layout: 1,
      sync: false,
      theme: 'dark',
      panes: [cleanPane({ id: 'p1', instrument: 'XAUUSD' }, ['XAUUSD'], 0)]
    };
  }

  function getChartDesk(id) {
    load();
    const row = findById(id);
    if (!row || !row.chart_desk) return emptyChartDesk();
    return updateChartDesk(id, row.chart_desk, null, true);
  }

  function updateChartDesk(id, desk, known, readOnly) {
    load();
    const row = findById(id);
    if (!row) {
      const error = new Error('Sign in to save a chart layout.');
      error.status = 401;
      throw error;
    }
    const layout = Number(desk && desk.layout);
    const count = layout === 2 || layout === 4 ? layout : 1;
    const theme = desk && desk.theme === 'light' ? 'light' : 'dark';
    const panes = [];
    const incoming = Array.isArray(desk && desk.panes) ? desk.panes : [];
    for (let i = 0; i < count; i++) panes.push(cleanPane(incoming[i] || { instrument: 'XAUUSD' }, known, i));
    const next = {
      layout: count,
      sync: !!(desk && desk.sync),
      theme,
      panes
    };
    if (!readOnly) {
      row.chart_desk = next;
      save();
    }
    return JSON.parse(JSON.stringify(next));
  }

  function memberFromRequest(req) {
    load();
    const token = parseCookies(req)[COOKIE_NAME];
    const session = verifySession(token);
    if (!session) return null;
    return publicMember(findById(session.id));
  }

  function sessionCookie(member, secure) {
    const token = signSession({ id: member.id, exp: Date.now() + SESSION_MS });
    return cookieHeader(token, Math.floor(SESSION_MS / 1000), !!secure);
  }

  function clearCookie(secure) {
    return cookieHeader('', 0, !!secure);
  }

  return {
    file,
    register,
    login,
    loginGoogle,
    setTier,
    updateWatchlist,
    updateAlerts,
    updateJournal,
    getChartDesk,
    updateChartDesk,
    memberFromRequest,
    sessionCookie,
    clearCookie,
    publicMember,
    findByEmail
  };
}

const FEATURES = {
  delayed: 'free',
  calendar: 'free',
  sessions: 'free',
  watchlist: 'free',
  live: 'pro',
  charts: 'pro',
  scanner: 'pro',
  strength: 'pro',
  correlation: 'pro',
  analyst: 'pro',
  brief: 'pro',
  history: 'pro',
  plans: 'pro',
  journal: 'elite',
  position: 'elite',
  alerts: 'elite'
};

function tierRank(tier) {
  return Object.prototype.hasOwnProperty.call(TIER_RANK, tier) ? TIER_RANK[tier] : -1;
}

function tierAllows(tier, feature) {
  const need = FEATURES[feature] || 'elite';
  const needRank = Object.prototype.hasOwnProperty.call(TIER_RANK, need) ? TIER_RANK[need] : 99;
  return tierRank(tier) >= needRank;
}

module.exports = {
  COOKIE_NAME,
  TIERS,
  FEATURES,
  createMembersStore,
  tierAllows,
  hashPassword,
  passwordMatches,
  validEmail,
  verifySession,
  signSession
};
