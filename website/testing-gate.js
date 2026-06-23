'use strict';

const crypto = require('crypto');

const SITE_MODE = String(process.env.SITE_MODE || 'testing').toLowerCase();
const PREVIEW_COOKIE = 'aurafx_preview';
const PREVIEW_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Pages that require owner preview while SITE_MODE=testing */
const GATED_PAGES = new Set([
  '/register.html',
  '/scanner.html',
  '/risk-calculator.html',
  '/mt5-install.html',
  '/mt5-upload.html',
  '/installation-guide.html',
  '/dashboard.html',
  '/hard-sell.html',
  '/aura-lite.html',
  '/get-started.html'
]);

const BLOCKED_DOWNLOAD_EXT = new Set(['.mq5', '.mq4', '.ex5', '.ex4', '.zip', '.set']);

function isTestingMode() {
  return SITE_MODE !== 'public';
}

function isPublicLaunch() {
  return SITE_MODE === 'public';
}

function testingConfig() {
  return {
    siteMode: SITE_MODE,
    testingMode: isTestingMode(),
    publicLaunch: isPublicLaunch(),
    mt5DownloadsPublic: isPublicLaunch(),
    registrationOpen: isPublicLaunch(),
    message: isTestingMode()
      ? 'Aura Elite FX is in private owner testing. MT5 tools are not available for public download yet.'
      : 'Aura Elite FX is live.'
  };
}

function blockedPayload() {
  return {
    error: 'Private testing — not open to the public yet.',
    code: 'testing_mode',
    testingMode: true,
    message: testingConfig().message
  };
}

function parseCookies(req) {
  const out = {};
  const raw = String(req.headers.cookie || '');
  raw.split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) {
      out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    }
  });
  return out;
}

function signPreviewToken(secret) {
  const exp = Date.now() + PREVIEW_TTL_MS;
  const sig = crypto.createHmac('sha256', secret).update('preview|' + exp).digest('hex');
  return String(exp) + '.' + sig;
}

function verifyPreviewToken(secret, token) {
  if (!secret || !token) return false;
  const parts = String(token).split('.');
  if (parts.length !== 2) return false;
  const exp = Number(parts[0]);
  if (!exp || Date.now() > exp) return false;
  const expected = crypto.createHmac('sha256', secret).update('preview|' + exp).digest('hex');
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(parts[1]);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function hasPreviewAccess(req, ownerKey, isAdmin) {
  if (!isTestingMode()) return true;
  if (isAdmin) return true;
  if (ownerKey && req.headers['x-owner-key'] === ownerKey) return true;
  const cookies = parseCookies(req);
  return verifyPreviewToken(ownerKey, cookies[PREVIEW_COOKIE]);
}

function isGatedPage(urlPath) {
  const p = String(urlPath || '').split('?')[0].toLowerCase();
  if (p === '/') return false;
  return GATED_PAGES.has(p);
}

function isBlockedDownload(urlPath) {
  const ext = String(urlPath || '').toLowerCase().replace(/.*(\.[^./]+)$/, '$1');
  return BLOCKED_DOWNLOAD_EXT.has(ext);
}

function previewCookieHeader(token, secure) {
  const flags = [
    PREVIEW_COOKIE + '=' + encodeURIComponent(token),
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=' + Math.floor(PREVIEW_TTL_MS / 1000)
  ];
  if (secure) flags.push('Secure');
  return flags.join('; ');
}

module.exports = {
  SITE_MODE,
  PREVIEW_COOKIE,
  isTestingMode,
  isPublicLaunch,
  testingConfig,
  blockedPayload,
  hasPreviewAccess,
  isGatedPage,
  isBlockedDownload,
  signPreviewToken,
  previewCookieHeader
};
