'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const IS_PRODUCTION = process.env.RENDER === 'true' ||
  String(process.env.NODE_ENV || '').toLowerCase() === 'production';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_TOTP_SECRET = String(process.env.ADMIN_TOTP_SECRET || '').replace(/\s/g, '');
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET ||
  process.env.AURAFX_OWNER_KEY ||
  crypto.randomBytes(32).toString('hex');
const COOKIE_NAME = 'aurafx_admin';
const SESSION_MS = 8 * 60 * 60 * 1000;
const AUDIT_DIR = path.join(__dirname, 'data');
const AUDIT_FILE = path.join(AUDIT_DIR, 'admin-audit.log');

const ADMIN_HTML = [
  '/owner-leads.html',
  '/system-status.html',
  '/owner-email.html',
  '/owner-preview.html'
];

const loginAttempts = new Map();

function ensureAuditDir() {
  try { fs.mkdirSync(AUDIT_DIR, { recursive: true }); } catch (_) { /* ignore */ }
}

function getIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

function auditLog(event, req, detail) {
  ensureAuditDir();
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    event,
    ip: getIp(req),
    detail: detail || null
  }) + '\n';
  try { fs.appendFileSync(AUDIT_FILE, line); } catch (_) { /* ignore */ }
}

function parseCookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function signSession(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return data + '.' + sig;
}

function verifySession(token) {
  if (!token || token.indexOf('.') < 0) return null;
  const dot = token.indexOf('.');
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function isAuthenticated(req) {
  const cookies = parseCookies(req);
  return !!verifySession(cookies[COOKIE_NAME]);
}

function sessionCookie(token, maxAgeSec) {
  const secure = IS_PRODUCTION ? '; Secure' : '';
  return COOKIE_NAME + '=' + encodeURIComponent(token) +
    '; Path=/; HttpOnly; SameSite=Strict' + secure + '; Max-Age=' + maxAgeSec;
}

function setSessionCookie(res) {
  const exp = Date.now() + SESSION_MS;
  const token = signSession({ role: 'admin', exp });
  res.setHeader('Set-Cookie', sessionCookie(token, Math.floor(SESSION_MS / 1000)));
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', sessionCookie('', 0));
}

function rateLimitOk(ip) {
  const now = Date.now();
  let rec = loginAttempts.get(ip);
  if (!rec || now - rec.firstAt > 15 * 60 * 1000) {
    rec = { count: 0, firstAt: now };
    loginAttempts.set(ip, rec);
  }
  return rec.count < 5;
}

function recordFailedLogin(ip) {
  const rec = loginAttempts.get(ip) || { count: 0, firstAt: Date.now() };
  rec.count += 1;
  loginAttempts.set(ip, rec);
}

function resetAttempts(ip) {
  loginAttempts.delete(ip);
}

function verifyPassword(password) {
  if (!ADMIN_PASSWORD) {
    return { ok: false, error: 'Admin login is not configured. Set ADMIN_PASSWORD on the server.' };
  }
  const a = crypto.createHash('sha256').update(String(password)).digest('hex');
  const b = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest('hex');
  if (a.length !== b.length) return { ok: false, error: 'Invalid credentials' };
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (!crypto.timingSafeEqual(ba, bb)) return { ok: false, error: 'Invalid credentials' };
  return { ok: true };
}

function base32Decode(input) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  const str = String(input || '').replace(/=+$/, '').toUpperCase();
  for (let i = 0; i < str.length; i++) {
    const val = alphabet.indexOf(str[i]);
    if (val < 0) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateTotp(secret, counter) {
  const key = base32Decode(secret);
  const step = counter != null ? counter : Math.floor(Date.now() / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(step));
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  return ((hmac.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, '0');
}

function verifyTotp(secret, token) {
  if (!secret) return true;
  const t = String(token || '').replace(/\D/g, '');
  if (t.length !== 6) return false;
  const step = Math.floor(Date.now() / 1000 / 30);
  for (let w = -1; w <= 1; w++) {
    if (generateTotp(secret, step + w) === t) return true;
  }
  return false;
}

function login(req, body) {
  const ip = getIp(req);
  if (!rateLimitOk(ip)) {
    auditLog('login_rate_limited', req);
    return { ok: false, status: 429, error: 'Too many attempts. Try again in 15 minutes.' };
  }
  const pw = verifyPassword(body.password);
  if (!pw.ok) {
    recordFailedLogin(ip);
    auditLog('login_failed', req, 'password');
    return { ok: false, status: 403, error: pw.error };
  }
  if (ADMIN_TOTP_SECRET && !verifyTotp(ADMIN_TOTP_SECRET, body.totp)) {
    recordFailedLogin(ip);
    auditLog('login_failed', req, 'totp');
    return { ok: false, status: 403, error: 'Invalid authenticator code' };
  }
  resetAttempts(ip);
  auditLog('login_success', req);
  return { ok: true, totpRequired: !!ADMIN_TOTP_SECRET };
}

function logout(req) {
  auditLog('logout', req);
  return { ok: true };
}

function isAdminPage(urlPath) {
  return ADMIN_HTML.indexOf(urlPath) >= 0;
}

module.exports = {
  ADMIN_HTML,
  isAdminPage,
  isAuthenticated,
  isConfigured: () => !!ADMIN_PASSWORD,
  totpEnabled: () => !!ADMIN_TOTP_SECRET,
  login,
  logout,
  setSessionCookie,
  clearSessionCookie,
  auditLog,
  getIp,
  parseCookies
};
