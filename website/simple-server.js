/**
 * AuraFX — NO npm install needed. Only Node.js required.
 * Run: node simple-server.js
 */
try { require('dotenv').config(); } catch (_) { /* optional — run without npm install */ }
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const regStore = require('./registrations-store');
const business = require('./business-identity');

let dashStore = null;
try {
  dashStore = require('./dashboard-store');
} catch (e) {
  console.warn('[AuraFX] dashboard-store not loaded:', e.message);
}

let adminAuth = null;
try {
  adminAuth = require('./admin-auth');
} catch (e) {
  console.warn('[AuraFX] admin-auth not loaded:', e.message);
}

const IS_PRODUCTION = process.env.RENDER === 'true' ||
  String(process.env.NODE_ENV || '').toLowerCase() === 'production';

let paypalVerify = null;
try {
  paypalVerify = require('./paypal-verify');
} catch (e) {
  console.warn('[AuraFX] paypal-verify not loaded:', e.message);
}

let secureFields = null;
try {
  secureFields = require('./secure-fields');
} catch (e) {
  console.warn('[AuraFX] secure-fields not loaded:', e.message);
}

const PORT = process.env.PORT || 3847;
const HOST = process.env.HOST || (process.env.RENDER === 'true' ? '0.0.0.0' : '127.0.0.1');
const SITE_URL = process.env.SITE_URL || 'https://aurafxelite.com';
const PUBLIC = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json'
};

const STARTED_AT = Date.now();

let cache = {
  mood: 'CAUTION',
  nextEvent: { title: 'US CPI m/m', minutesUntil: 45, risk: 'HIGH', currency: 'USD' },
  calendar: [
    { title: 'US CPI m/m', time: new Date(Date.now() + 3600000).toISOString(), risk: 'HIGH', currency: 'USD' },
    { title: 'FOMC Statement', time: new Date(Date.now() + 7200000).toISOString(), risk: 'HIGH', currency: 'USD' }
  ],
  news: [{ title: 'AuraFX live server running', risk: 'LOW', time: new Date().toISOString(), source: 'AuraFX' }],
  updatedAt: new Date().toISOString(),
  lastHistoryMood: null,
  lastQuoteChanges: null
};

const OWNER_KEY = process.env.AURAFX_OWNER_KEY || (IS_PRODUCTION ? '' : 'aurafx-local-dev');
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const PAYPAL_MODE = process.env.PAYPAL_MODE || 'sandbox';
const PAYPAL_BUSINESS_EMAIL = process.env.PAYPAL_BUSINESS_EMAIL || '';
const ALLOW_MANUAL_PAYMENT_CONFIRM = process.env.ALLOW_MANUAL_PAYMENT_CONFIRM === '1';

const PLANS = {
  free: { id: 'free', name: 'Website dashboard', price: 0 },
  mt5_bundle: { id: 'mt5_bundle', name: 'MT5 full bundle', price: 99 },
  mt5_rent: { id: 'mt5_rent', name: 'MT5 monthly rent', price: 15 },
  mt4_waitlist: { id: 'mt4_waitlist', name: 'MT4 early access', price: 49 }
};

/** demo = public demo only | preview = live feeds for owner key only | public = live for everyone (later) */
const INSTITUTIONAL_MODE = String(process.env.INSTITUTIONAL_MODE || 'demo').toLowerCase();
/** Next.js AI signal demo (aura-fx-elite-ai) — set after Render/Vercel deploy */
const AI_DEMO_URL = String(process.env.AI_DEMO_URL || '').trim() ||
  (IS_PRODUCTION ? '' : 'http://localhost:3000');
let instLiveMod = null;
try {
  instLiveMod = require('./institutional-live');
} catch (e) {
  console.warn('[AuraFX] institutional-live module not loaded:', e.message);
}

let emailMod = null;
try {
  emailMod = require('./email-service');
} catch (e) {
  console.warn('[AuraFX] email-service not loaded:', e.message);
}

let quotesService = null;
try {
  quotesService = require('./live-quotes-service');
} catch (e) {
  console.warn('[AuraFX] live-quotes-service not loaded:', e.message);
}

let marketSessions = null;
try {
  marketSessions = require('./market-sessions');
} catch (e) {
  console.warn('[AuraFX] market-sessions not loaded:', e.message);
}

let economicCalendar = null;
try {
  economicCalendar = require('./economic-calendar-service');
} catch (e) {
  console.warn('[AuraFX] economic-calendar-service not loaded:', e.message);
}

let liveMarkets = null;
try {
  liveMarkets = require('./live-markets-service');
} catch (e) {
  console.warn('[AuraFX] live-markets-service not loaded:', e.message);
}

let aiIntelligence = null;
try {
  aiIntelligence = require('./ai-intelligence-service');
} catch (e) {
  console.warn('[AuraFX] ai-intelligence-service not loaded:', e.message);
}

let signalService = null;
try {
  signalService = require('./signal-service');
} catch (e) {
  console.warn('[AuraFX] signal-service not loaded:', e.message);
}

let memberDesk = null;
try {
  memberDesk = require('./member-desk').createMemberDesk({ signals: signalService });
} catch (e) {
  console.warn('[AuraFX] member-desk not loaded:', e.message);
}

const { createDashboardLink } = require('./dashboard-link');
const { smtpSettings, deliverSmtp } = require('./signal-alerts');
const dashboardLink = createDashboardLink({
  members: {
    findByEmail(email) {
      return memberDesk ? memberDesk.store.findByEmail(email) : null;
    },
    login(email, password, ip) {
      if (!memberDesk) {
        const error = new Error('Member sign-in is unavailable.');
        error.status = 503;
        throw error;
      }
      return memberDesk.store.login(email, password, ip);
    }
  },
  findRegistration: async (email) => revealRow(await regStore.findByEmail(email)),
  makeToken: (id, email) => (dashStore ? dashStore.makeDashboardToken(id, email) : ''),
  smtpConfigured: () => smtpSettings().configured,
  sendMail: async (message) => {
    const smtp = smtpSettings();
    await deliverSmtp({
      from: smtp.from,
      to: message.to,
      subject: message.subject,
      text: message.text
    }, smtp);
  },
  siteUrl: () => String(process.env.SITE_URL || 'https://aurafxelite.com')
});

function applyCalendarToCache(calPayload) {
  if (!calPayload) return;
  cache.calendar = calPayload.calendar || calPayload.items || [];
  cache.nextEvent = calPayload.nextEvent || cache.nextEvent;
  if (calPayload.mood) cache.calendarMood = calPayload.mood;
  if (calPayload.sessionRisk) cache.sessionRisk = calPayload.sessionRisk;
  if (calPayload.news && calPayload.news.length) {
    cache.news = calPayload.news;
  }
  cache.calendarSource = calPayload.source;
  cache.finnhubEnabled = calPayload.finnhubEnabled;
  cache.highImpactToday = calPayload.highImpactToday;
}

function ownerKeyOk(req) {
  if (!OWNER_KEY) return false;
  return req.headers['x-owner-key'] === OWNER_KEY;
}

function adminAuthOk(req) {
  if (adminAuth && adminAuth.isAuthenticated(req)) return true;
  if (!IS_PRODUCTION && OWNER_KEY && ownerKeyOk(req)) return true;
  return false;
}

function requireAdminApi(req, res) {
  if (adminAuthOk(req)) return true;
  if (adminAuth) adminAuth.auditLog('admin_api_denied', req, req.url);
  json(res, 403, { error: 'Forbidden — admin sign-in required' });
  return false;
}

function redirectAdminLogin(res, nextPath) {
  res.writeHead(302, securityHeaders({
    Location: '/admin-login.html?next=' + encodeURIComponent(nextPath || '/owner-leads.html'),
    'Cache-Control': 'no-store'
  }));
  res.end();
}

function securityHeaders(extra) {
  const h = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    ...extra
  };
  if (SITE_URL.startsWith('https://')) {
    h['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  }
  return h;
}

function sealRow(row) {
  return secureFields ? secureFields.sealRegistration(row) : row;
}

function revealRow(row) {
  return secureFields ? secureFields.revealRegistration(row) : row;
}

function json(res, code, obj) {
  res.writeHead(code, securityHeaders({ 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }));
  res.end(JSON.stringify(obj));
}

function corsPreflight(res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Owner-Key, X-Dashboard-Id, X-Dashboard-Token, X-Dashboard-Email'
  });
  res.end();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', (chunk) => {
      buf += chunk;
      if (buf.length > 1e6) {
        reject(new Error('Body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(buf ? JSON.parse(buf) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function legalAcceptedOk(body) {
  const l = body.legalAccepted || {};
  return !!(l.age18 && l.terms && l.privacy && l.risk && l.responsible &&
    l.jurisdiction && l.regulatory && l.refunds);
}

function makeVerifyToken() {
  return crypto.randomBytes(24).toString('hex');
}

function handleVerifyEmail(req, res, fullUrl) {
  const q = fullUrl.indexOf('?') >= 0 ? fullUrl.slice(fullUrl.indexOf('?')) : '';
  const token = new URLSearchParams(q).get('token');
  if (!token) return json(res, 400, { ok: false, error: 'Missing verification token' });
  regStore.findByVerifyToken(token)
    .then(async (row) => {
      if (!row) return json(res, 400, { ok: false, error: 'Invalid or expired link' });
      row = revealRow(row);
      row.emailVerified = true;
      row.verifiedAt = new Date().toISOString();
      row.verifyToken = null;
      row.updatedAt = new Date().toISOString();
      await regStore.saveRegistration(sealRow(row));
      json(res, 200, {
        ok: true,
        message: 'Email verified successfully',
        email: row.email,
        fullName: row.fullName
      });
    })
    .catch((e) => json(res, 500, { error: e.message }));
}

function handleResendVerify(req, res) {
  readBody(req)
    .then(async (body) => {
      const email = String(body.email || '').trim().toLowerCase();
      if (!email) return json(res, 400, { error: 'Email required' });
      const row = revealRow(await regStore.findByEmail(email));
      if (!row) return json(res, 404, { error: 'Registration not found' });
      if (row.emailVerified) return json(res, 200, { ok: true, alreadyVerified: true });
      if (!row.verifyToken) row.verifyToken = makeVerifyToken();
      await regStore.saveRegistration(sealRow(row));
      if (!emailMod) return json(res, 503, { error: 'Email not configured on server' });
      try {
        const vr = await emailMod.sendVerificationEmail(row, cache);
        json(res, 200, { ok: true, sent: !!vr.sent, message: 'Verification email sent' });
      } catch (e) {
        json(res, 500, { error: e.message });
      }
    })
    .catch((e) => json(res, 400, { error: e.message }));
}

function handleRegister(req, res) {
  readBody(req)
    .then(async (body) => {
      const email = String(body.email || '').trim().toLowerCase();
      const fullName = String(body.fullName || '').trim();
      const phone = String(body.phone || '').trim();
      const countryCode = String(body.countryCode || '').trim();
      const city = String(body.city || '').trim();
      if (!email || !fullName) {
        return json(res, 400, { error: 'Name and email are required' });
      }
      if (!phone || !countryCode || !city) {
        return json(res, 400, { error: 'Phone, country, and city are required' });
      }
      if (!String(body.heardFrom || '').trim()) {
        return json(res, 400, { error: 'Please select how you found us' });
      }
      if (!legalAcceptedOk(body)) {
        return json(res, 400, { error: 'All mandatory legal agreements must be accepted' });
      }
      const existing = revealRow(await regStore.findByEmail(email));
      const plan = body.plan && PLANS[body.plan] ? body.plan : 'free';
      const planPrice = PLANS[plan] ? PLANS[plan].price : 0;
      const emailVerified = !!(existing && existing.emailVerified);
      const verifyToken = emailVerified ? null : (existing && existing.verifyToken) || makeVerifyToken();
      const row = {
        id: existing ? existing.id : 'reg_' + Date.now(),
        fullName,
        email,
        phone,
        country: String(body.country || '').trim(),
        countryCode,
        city,
        postcode: String(body.postcode || '').trim(),
        addressLine: String(body.addressLine || '').trim(),
        experience: body.experience || 'intermediate',
        interest: body.interest || 'all',
        heardFrom: String(body.heardFrom || '').trim(),
        heardFromLabel: String(body.heardFromLabel || body.heardFrom || '').trim(),
        heardFromOther: String(body.heardFromOther || '').trim(),
        broker: String(body.broker || '').trim(),
        message: String(body.message || '').trim(),
        plan,
        planName: PLANS[plan] ? PLANS[plan].name : plan,
        planPrice,
        legalAccepted: body.legalAccepted,
        marketingOptIn: !!(body.legalAccepted && body.legalAccepted.marketing),
        paymentStatus: body.paymentStatus || (planPrice === 0 ? 'free' : 'pending'),
        paypalOrderId: body.paypalOrderId || '',
        paidAt: body.paidAt || null,
        emailVerified,
        verifyToken,
        verifiedAt: existing && existing.verifiedAt ? existing.verifiedAt : null,
        registeredAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const saved = existing
        ? { ...existing, ...row, id: existing.id, registeredAt: existing.registeredAt }
        : row;
      await regStore.saveRegistration(sealRow(saved));
      Object.assign(row, saved);

      let verificationEmailSent = false;
      let verificationError = '';
      if (emailMod && !row.emailVerified) {
        try {
          const vr = await emailMod.sendVerificationEmail(row, cache);
          verificationEmailSent = !!vr.sent;
          if (vr.sent) console.log('[AuraFX email] Verification sent to', row.email);
        } catch (err) {
          verificationError = err.message;
          console.warn('[AuraFX email] Verification failed:', err.message);
        }
      }
      if (emailMod && row.marketingOptIn && row.emailVerified) {
        emailMod.sendWelcome(row, cache).catch((err) => console.warn('[AuraFX welcome]', err.message));
      }

      json(res, 200, {
        ok: true,
        success: true,
        id: row.id,
        registeredAt: row.registeredAt,
        message: 'Registration successful',
        emailVerified: row.emailVerified,
        verificationEmailSent,
        verificationError: verificationError || undefined,
        fullName: row.fullName,
        email: row.email
      });
    })
    .catch((e) => json(res, 400, { error: e.message }));
}

function handlePayment(req, res) {
  readBody(req)
    .then(async (body) => {
      const email = String(body.email || '').trim().toLowerCase();
      const list = await regStore.getRegistrations();
      let row = list.map(revealRow).find((r) => r.id === body.registrationId) ||
        list.map(revealRow).find((r) => r.email === email);
      if (!row) return json(res, 404, { error: 'Registration not found — complete step 1 first' });

      const orderId = String(body.paypalOrderId || '').trim();
      const expectedAmount = Number(body.amount) || row.planPrice || 0;
      let payerEmail = String(body.payerEmail || '').trim();
      let paypalStatus = String(body.paypalStatus || 'COMPLETED');

      if (orderId.startsWith('manual_')) {
        if (!ALLOW_MANUAL_PAYMENT_CONFIRM) {
          return json(res, 403, {
            error: 'Manual payment confirm is disabled. Configure PayPal (see PAYPAL-SETUP.txt) or set ALLOW_MANUAL_PAYMENT_CONFIRM=1 for local testing only.'
          });
        }
      } else if (paypalVerify && paypalVerify.isConfigured()) {
        try {
          const verified = await paypalVerify.verifyPaypalOrder(orderId, expectedAmount);
          payerEmail = verified.payerEmail || payerEmail;
          paypalStatus = verified.status;
        } catch (e) {
          return json(res, 402, { error: e.message });
        }
      } else if (expectedAmount > 0) {
        return json(res, 503, {
          error: 'PayPal server verification not configured. Owner must add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to .env'
        });
      }

      row.paymentStatus = 'paid';
      row.paypalOrderId = orderId;
      row.paypalPayerEmail = payerEmail;
      row.paypalStatus = paypalStatus;
      row.paidAt = new Date().toISOString();
      row.amountPaid = expectedAmount;
      row.updatedAt = new Date().toISOString();
      await regStore.saveRegistration(sealRow(row));
      json(res, 200, { ok: true, message: 'Payment verified and recorded', paymentStatus: 'paid' });
    })
    .catch((e) => json(res, 400, { error: e.message }));
}

function apiConfig() {
  const emailStatus = emailMod ? emailMod.getStatus() : { configured: false };
  const paypalReady = !!(PAYPAL_CLIENT_ID && paypalVerify && paypalVerify.isConfigured());
  return {
    plans: PLANS,
    paypalConfigured: paypalReady,
    paypalClientId: paypalReady ? PAYPAL_CLIENT_ID : '',
    paypalMode: PAYPAL_MODE,
    paypalBusinessEmail: paypalReady ? PAYPAL_BUSINESS_EMAIL : '',
    allowManualPaymentConfirm: IS_PRODUCTION ? false : ALLOW_MANUAL_PAYMENT_CONFIRM,
    dataEncryption: secureFields ? secureFields.enabled() : false,
    currency: 'USD',
    institutionalMode: INSTITUTIONAL_MODE,
    institutionalLivePublic: INSTITUTIONAL_MODE === 'public',
    ownerPreviewAvailable: INSTITUTIONAL_MODE === 'preview' || INSTITUTIONAL_MODE === 'public',
    email: emailStatus,
    storage: regStore.storageInfo(),
    dashboard: Object.assign(
      dashStore ? dashStore.storageInfo() : { backend: 'unavailable' },
      { magicLink: smtpSettings().configured }
    ),
    business: {
      tradingName: business.tradingName,
      supportEmail: business.supportEmail,
      website: business.website
    },
    aiDemoUrl: AI_DEMO_URL
  };
}

function handleEmailSubscribers(req, res) {
  if (!requireAdminApi(req, res)) return;
  regStore.getRegistrations()
    .then((list) => {
      const marketing = list.filter((r) => r.marketingOptIn);
      json(res, 200, {
        total: list.length,
        marketingOptIn: marketing.length,
        marketing,
        all: list.map((r) => ({ email: r.email, fullName: r.fullName, marketingOptIn: !!r.marketingOptIn, plan: r.plan }))
      });
    })
    .catch((e) => json(res, 500, { error: e.message }));
}

function handleEmailDraft(req, res) {
  if (!requireAdminApi(req, res)) return;
  if (!emailMod) return json(res, 503, { error: 'Email module unavailable' });
  readBody(req)
    .then(async (body) => {
      const draft = await emailMod.generateDraft({
        type: body.type || 'forecast',
        serverCache: cache,
        ownerNotes: body.ownerNotes || body.notes || '',
        useAi: !!body.useAi,
        audience: body.audience || 'marketing'
      });
      const list = await regStore.getRegistrations();
      const count = emailMod.filterRecipients(list, body.audience || 'marketing').length;
      json(res, 200, { draft, recipientCount: count });
    })
    .catch((e) => json(res, 400, { error: e.message }));
}

function handleEmailSend(req, res) {
  if (!requireAdminApi(req, res)) return;
  if (!emailMod) return json(res, 503, { error: 'Email module unavailable' });
  readBody(req)
    .then(async (body) => {
      const subject = String(body.subject || '').trim();
      const html = String(body.html || '').trim();
      if (!subject || !html) return json(res, 400, { error: 'Subject and HTML body required' });
      const list = await regStore.getRegistrations();
      const audience = body.audience || 'marketing';
      const dryRun = !!body.dryRun;
      const total = emailMod.filterRecipients(list, audience).length;
      if (total === 0) return json(res, 400, { error: 'No recipients for audience: ' + audience });

      if (dryRun) {
        return emailMod.sendCampaign({ registrations: list, subject, html, audience, dryRun: true })
          .then((c) => json(res, 200, c))
          .catch((e) => json(res, 500, { error: e.message }));
      }

      json(res, 200, {
        ok: true,
        started: true,
        message: 'Sending to ' + total + ' clients in background — check Email log',
        total,
        audience
      });

      emailMod.sendCampaign({ registrations: list, subject, html, audience, dryRun: false })
        .then((c) => console.log('[AuraFX email] Campaign done:', c.id, 'sent', c.sent, 'failed', c.failed))
        .catch((e) => console.error('[AuraFX email] Campaign error:', e.message));
    })
    .catch((e) => json(res, 400, { error: e.message }));
}

function handleEmailStatus(req, res) {
  if (!requireAdminApi(req, res)) return;
  if (!emailMod) return json(res, 200, { configured: false });
  const campaigns = emailMod.getCampaigns();
  json(res, 200, {
    status: emailMod.getStatus(),
    lastCampaign: campaigns[0] || null,
    recentLog: emailMod.getEmailLog().slice(0, 15)
  });
}

function handleInstitutionalLive(req, res) {
  if (!instLiveMod) return json(res, 503, { error: 'Live module unavailable' });
  if (INSTITUTIONAL_MODE === 'demo') {
    return json(res, 403, {
      error: 'Live preview off. Set INSTITUTIONAL_MODE=preview then restart server.',
      institutionalMode: 'demo'
    });
  }
  if (INSTITUTIONAL_MODE === 'preview' && !adminAuthOk(req)) {
    return json(res, 403, { error: 'Admin sign-in required for live preview' });
  }
  instLiveMod.getLivePayload(cache)
    .then((payload) => json(res, 200, payload))
    .catch((e) => json(res, 500, { error: e.message }));
}

function calendarForInstitutional() {
  const fmt = (e) => ({
    t: e.title,
    cur: e.currency || '—',
    time: new Date(e.time).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short', timeZone: 'UTC' }) + ' UTC',
    impact: e.category || e.impact || e.risk
  });
  const cal = cache.calendar || [];
  const high = cal.filter((e) => e.risk === 'HIGH').slice(0, 8).map(fmt);
  const medium = cal.filter((e) => e.risk === 'MEDIUM').slice(0, 6).map(fmt);
  const low = cal.filter((e) => e.risk === 'LOW').slice(0, 6).map(fmt);
  if (!high.length && cache.nextEvent) {
    high.push(fmt({ ...cache.nextEvent, time: cache.nextEvent.time || new Date().toISOString() }));
  }
  return {
    high: high.length ? high : [{ t: 'No high-impact events in window', cur: '—', time: '—', impact: '—' }],
    medium: medium.length ? medium : [{ t: 'See full calendar page', cur: '—', time: '—', impact: '—' }],
    low: low.length ? low : [{ t: 'Low-impact releases throughout session', cur: '—', time: '—', impact: '—' }]
  };
}

function apiInstitutional(quotes) {
  const xau = quotes && quotes.metals && quotes.metals.XAUUSD;
  const eur = quotes && quotes.forex && quotes.forex.EURUSD;
  const changes = (quotes && quotes.changes) || {};
  const sessions = marketSessions ? marketSessions.getFxSessionsUTC() : null;
  const sessionLabel = sessions && marketSessions
    ? marketSessions.activeSessionLabel(sessions)
    : 'London';
  const ranked = marketSessions
    ? marketSessions.rankByChange(changes)
    : { gainers: [{ n: 'XAUUSD', v: '+0.42%' }], losers: [{ n: 'USDJPY', v: '-0.21%' }] };
  const strength = marketSessions && quotes
    ? marketSessions.currencyStrengthFromForex(quotes.forex || {}, changes)
    : [
      { c: 'USD', s: 88 }, { c: 'EUR', s: 72 }, { c: 'GBP', s: 65 },
      { c: 'JPY', s: 41 }, { c: 'AUD', s: 58 }, { c: 'XAU', s: 76 }
    ];
  const goldCh = changes.XAUUSD;
  const goldDaily = goldCh != null ? ((goldCh >= 0 ? '+' : '') + goldCh.toFixed(2) + '%') : 'Live feed';
  const goldSupport = xau
    ? [(xau * 0.995).toFixed(0), (xau * 0.988).toFixed(0)]
    : ['—', '—'];
  const goldResist = xau
    ? [(xau * 1.005).toFixed(0), (xau * 1.012).toFixed(0)]
    : ['—', '—'];
  const heatmap = strength.slice(0, 6).map((s) => ({
    s: s.c,
    v: Math.round((s.s - 50) / 25 * 10) / 10
  }));
  return {
    marketOverview: {
      sentiment: cache.mood === 'RISK-ON' ? 'Risk-On' : cache.mood === 'RISK-OFF' ? 'Risk-Off' : 'Mixed',
      riskMode: cache.mood,
      fearGreed: Math.min(95, Math.max(15, 50 + Math.round((ranked.top[0] && ranked.top[0].pct) || 0) * 5)),
      vix: 17.8,
      currencyStrength: strength,
      gainers: ranked.gainers.length ? ranked.gainers : [{ n: 'XAUUSD', v: '—' }],
      losers: ranked.losers.length ? ranked.losers : [{ n: '—', v: '—' }],
      volumeNote: 'Live quote refresh every 30s · ' + (quotes ? quotes.source : 'server'),
      globalStatus: sessionLabel
    },
    calendar: calendarForInstitutional(),
    newsCategories: {
      forex: ['Dollar firms ahead of CPI'],
      gold: ['Gold holds bid on haven flows'],
      stocks: ['US futures flat into data'],
      crypto: ['BTC consolidates'],
      geo: ['Geopolitical headlines monitored'],
      energy: ['Oil steady'],
      commodity: ['Copper tracks demand'],
      breaking: [cache.nextEvent.title + ' in ' + (cache.nextEvent.minutesUntil || 45) + ' min'],
      centralBank: ['Fed data-dependent tone'],
      institutions: ['Major bank gold outlook updated']
    },
    gold: {
      price: xau || null,
      daily: goldDaily,
      weekly: 'See chart',
      monthly: 'See chart',
      support: goldSupport,
      resistance: goldResist,
      volume: 'Live session',
      instSentiment: 'Net long bias',
      safeHaven: 'Elevated',
      usdCorr: -0.72,
      ratesNote: 'Real yields cap extension',
      quotesUpdatedAt: quotes ? quotes.updatedAt : null,
      quotesSource: quotes ? quotes.source : 'pending'
    },
    forex: {
      strengthRank: strength.map((s) => s.c),
      volRank: ['GBPJPY', 'XAUUSD', 'EURUSD'],
      trending: ranked.top.slice(0, 3).map((r) => r.symbol + ' ' + (r.pct >= 0 ? 'up' : 'down')),
      sessions: {
        asian: sessions && sessions.tokyo ? 'Open' : 'Closed',
        london: sessions && sessions.london ? 'Open' : 'Closed',
        ny: sessions && sessions.newYork ? 'Open' : 'Closed'
      },
      smartMoney: eur ? 'EURUSD ' + Number(eur).toFixed(5) + ' live' : 'USD flows monitored'
    },
    technical: {
      ema: 'EMA 9 > 21 bullish H1', sma: 'Above SMA 200 D1', rsi: 'RSI 58',
      macd: 'Histogram rising', bb: 'Mid-band ride', fib: '61.8% held',
      trendStrength: 72, breakout: xau ? (xau * 1.01).toFixed(0) + ' gold' : 'Watch resistance', reversal: 'None', pattern: 'Ascending triangle'
    },
    aiAssistant: {
      setup: 'Gold long bias into CPI — reduced size.',
      risk: 'Spreads may widen 2-5x on news.',
      sl: 'Below 2328', tp: '2355 / 2372', condition: 'News regime',
      structure: 'Higher lows', sr: '2328-2332 demand', candles: 'Bullish engulfing H4', rr: '1:2.4'
    },
    performance: {
      sampleSize: 'Illustrative only',
      note: 'Historical back-tests are not indicative of future results',
      maxDD: 'Varies by settings',
      disclaimer: 'Educational metrics — not a performance promise'
    },
    institutional: {
      cot: 'Gold specs net long +', positioning: 'USD longs elevated',
      hedge: 'Macro hedges adding gold', oi: 'XAU OI +3% WoW', liquidity: 'Deep NY liquidity'
    },
    aiSummary: 'Forex: USD firm pre-' + (cache.nextEvent.title || 'data') + '. Gold: haven bid. Stocks: cautious. Crypto: neutral. Sentiment: ' + cache.mood + '.',
    alerts: [
      { t: 'NEWS', m: cache.nextEvent.title + ' — HIGH impact soon' },
      { t: 'RISK', m: 'Reduce size 50% before red news' }
    ],
    scanner: [
      { name: 'XAUUSD', type: 'Breakout', score: 84 },
      { name: 'EURUSD', type: 'Trend', score: 78 }
    ],
    heatmap: heatmap.length ? heatmap : [
      { s: 'XAU', v: 0.8 }, { s: 'EUR', v: 0.4 }, { s: 'USD', v: 0.6 },
      { s: 'JPY', v: -0.5 }, { s: 'BTC', v: -0.2 }
    ],
    updatedAt: cache.updatedAt
  };
}

function fileOk(rel) {
  try {
    return fs.existsSync(path.join(PUBLIC, rel));
  } catch {
    return false;
  }
}

function signalNewsWindow() {
  const before = Number(process.env.SIGNAL_NEWS_BEFORE_MIN);
  const after = Number(process.env.SIGNAL_NEWS_AFTER_MIN);
  return {
    before: Number.isFinite(before) && before >= 0 ? before : 30,
    after: Number.isFinite(after) && after >= 0 ? after : 30
  };
}

function signalNewsContext() {
  const source = cache.calendarSource || '';
  const windowMin = signalNewsWindow();
  if (!source) {
    return { newsImminent: false, newsEvents: [], newsWindow: windowMin, newsSource: source };
  }
  const { selectNewsEvents } = require('./signal-math');
  const newsEvents = selectNewsEvents(cache.calendar, new Date(), windowMin.before, windowMin.after);
  const first = newsEvents[0] || null;
  return {
    newsImminent: !!first,
    newsCurrency: first ? first.currency : '',
    newsTitle: first ? first.title : '',
    minutesUntil: first ? first.minutesUntil : null,
    newsEvents,
    newsWindow: windowMin,
    newsSource: source
  };
}

function apiWiring() {
  const base = 'http://127.0.0.1:' + PORT;
  const pages = [
    'index.html', 'dashboard.html', 'members.html', 'login.html', 'signup.html', 'track-record.html', 'trading-plans.html', 'ai-engine.html', 'pricing.html', 'how-it-works.html', 'legal.html', 'disclaimer.html', 'hard-sell.html', 'aura-lite.html', 'mt5-install.html',
    'register.html', 'verify-email.html', 'terms.html', 'privacy.html', 'risk-warning.html',
    'responsible-trading.html', 'regulatory.html', 'refunds.html', 'cookies.html',
    'system-status.html', 'owner-email.html', 'owner-leads.html', 'owner-preview.html'
  ];
  const apis = [
    '/api/health', '/api/status', '/api/quotes', '/api/signals', '/api/signals/tracker', '/api/signals/track-record', '/api/signals/plans', '/api/signals/free', '/api/signals/alerts', '/api/signals/ask', '/api/pricing', '/api/pro-summary', '/api/risk-summary',
    '/api/calendar', '/api/news', '/api/ai/status', '/api/ai/analyze', '/api/institutional', '/api/institutional-live', '/api/markets', '/api/wiring'
  ];
  return {
    ok: true,
    wired: true,
    server: 'AuraFX Node simple-server',
    port: Number(PORT),
    nodeVersion: process.version,
    uptimeSeconds: Math.floor(process.uptime()),
    startedAt: new Date(STARTED_AT).toISOString(),
    baseUrl: base,
    mood: cache.mood,
    dataFreshness: cache.updatedAt,
    links: {
      home: base + '/',
      dashboard: base + '/dashboard.html',
      systemStatus: base + '/system-status.html',
      mt5Install: base + '/mt5-install.html'
    },
    pages: pages.map((f) => ({ file: f, exists: fileOk(f) })),
    apis,
    clientScripts: [
      'js/site-boot.js', 'js/pro-dashboard.js', 'js/institutional.js',
      'js/global-markets.js', 'js/system-status.js'
    ]
  };
}

function tickQuotesFast() {
  cache.updatedAt = new Date().toISOString();
  if (quotesService) {
    quotesService.getQuotes()
      .then((q) => {
        if (q && q.changes) {
          cache.lastQuoteChanges = q.changes;
          if (marketSessions) cache.mood = marketSessions.deriveMood(q.changes);
        }
        cache.updatedAt = q.updatedAt || new Date().toISOString();
      })
      .catch(() => { /* keep last mood */ });
  }
}

function tickLiveDataSlow() {
  if (cache.nextEvent && cache.nextEvent.minutesUntil > 0) {
    cache.nextEvent.minutesUntil = Math.max(0, cache.nextEvent.minutesUntil - 1);
  }
  if (economicCalendar) {
    economicCalendar.refresh()
      .then((p) => {
        applyCalendarToCache(p);
        cache.updatedAt = new Date().toISOString();
      })
      .catch(() => {});
  }
  if (dashStore) {
    const summary = apiProSummary();
    dashStore.appendHistory({
      ts: cache.updatedAt,
      mood: summary.mood,
      score: summary.score,
      bullishProb: summary.bullishProb,
      sessionRisk: summary.sessionRisk
    }).catch(() => {});
    if (cache.lastHistoryMood && cache.lastHistoryMood !== summary.mood) {
      dashStore.appendEvent('warn', 'Market mood changed to ' + summary.mood)
        .catch(() => {});
    }
    cache.lastHistoryMood = summary.mood;
    if (cache.nextEvent && cache.nextEvent.minutesUntil === 30) {
      dashStore.appendEvent('warn', 'High-impact event in 30 min: ' + cache.nextEvent.title)
        .catch(() => {});
    }
  }
}

const FAST_TICK_MS = Number(process.env.LIVE_TICK_MS) || 5000;
setInterval(tickQuotesFast, FAST_TICK_MS);
setInterval(tickLiveDataSlow, 60000);
if (economicCalendar) {
  economicCalendar.refresh(true).then(applyCalendarToCache).catch(() => {});
}
tickQuotesFast();
tickLiveDataSlow();

function dashboardAuth(req) {
  const id = req.headers['x-dashboard-id'] || '';
  const token = req.headers['x-dashboard-token'] || '';
  const email = String(req.headers['x-dashboard-email'] || '').trim().toLowerCase();
  if (!dashStore || !id || !token || !email) return null;
  if (!dashStore.verifyDashboardToken(id, email, token)) return null;
  return { id, email };
}

function dashboardLinkContext(req) {
  return {
    member: memberDesk ? memberDesk.store.memberFromRequest(req) : null,
    ip: String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || 'dashboard').split(',')[0],
    cloudSync: !!(dashStore && dashStore.storageInfo().backend === 'neon')
  };
}

function handleDashboardSession(req, res) {
  if (!dashStore) return json(res, 503, { error: 'Dashboard sync unavailable' });
  readBody(req)
    .then(async (body) => {
      const result = await dashboardLink.request(body, dashboardLinkContext(req));
      json(res, result.status, result.body);
    })
    .catch((e) => json(res, 400, { error: e.message }));
}

function handleDashboardRedeem(req, res) {
  if (!dashStore) return json(res, 503, { error: 'Dashboard sync unavailable' });
  readBody(req)
    .then(async (body) => {
      const result = await dashboardLink.redeem(body && body.token, dashboardLinkContext(req).cloudSync);
      json(res, result.status, result.body);
    })
    .catch((e) => json(res, 400, { error: e.message }));
}

function handleDashboardJournalGet(req, res) {
  const auth = dashboardAuth(req);
  if (!auth) return json(res, 403, { error: 'Sign in required — link your registration' });
  dashStore.getJournal(auth.id)
    .then((entries) => json(res, 200, { ok: true, entries, cloudSync: dashStore.storageInfo().backend === 'neon' }))
    .catch((e) => json(res, 500, { error: e.message }));
}

function handleDashboardJournalPost(req, res) {
  const auth = dashboardAuth(req);
  if (!auth) return json(res, 403, { error: 'Sign in required' });
  readBody(req)
    .then(async (body) => {
      const entries = await dashStore.saveJournal(auth.id, auth.email, body.entries || []);
      json(res, 200, { ok: true, entries, saved: entries.length });
    })
    .catch((e) => json(res, 400, { error: e.message }));
}

function handleDashboardHistory(req, res, rawUrl) {
  const q = rawUrl.includes('?') ? rawUrl.slice(rawUrl.indexOf('?')) : '';
  const range = new URLSearchParams(q).get('range') || '1h';
  if (!dashStore) return json(res, 200, { points: [] });
  dashStore.getHistory(range)
    .then((points) => json(res, 200, { range, points }))
    .catch((e) => json(res, 500, { error: e.message }));
}

function handleDashboardEvents(req, res, rawUrl) {
  const q = rawUrl.includes('?') ? rawUrl.slice(rawUrl.indexOf('?')) : '';
  const limit = new URLSearchParams(q).get('limit') || '40';
  if (!dashStore) return json(res, 200, { events: [] });
  dashStore.getEvents(limit)
    .then((events) => json(res, 200, { events }))
    .catch((e) => json(res, 500, { error: e.message }));
}

function apiProSummary() {
  const quotesSource = quotesService ? 'Yahoo Finance / CoinGecko (public APIs)' : 'Server cache';
  const sessions = marketSessions ? marketSessions.getFxSessionsUTC() : null;
  const sessionLabel = sessions && marketSessions
    ? marketSessions.activeSessionLabel(sessions)
    : 'London';
  const sessionRisk = sessions && marketSessions
    ? marketSessions.sessionRiskLevel(sessions)
    : 'MEDIUM';
  let bullishProb = 58;
  let bearishProb = 42;
  if (quotesService && cache.lastQuoteChanges) {
    const vals = Object.values(cache.lastQuoteChanges).filter((v) => typeof v === 'number');
    if (vals.length) {
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      bullishProb = Math.min(72, Math.max(28, Math.round(50 + avg * 8)));
      bearishProb = 100 - bullishProb;
    }
  }
  return {
    mood: cache.calendarMood || cache.mood,
    sessionRisk: cache.sessionRisk || sessionRisk,
    session: sessionLabel,
    nextEvent: cache.nextEvent,
    bullishProb,
    bearishProb,
    score: Math.min(92, Math.max(45, 68 + Math.round((bullishProb - 50) / 3))),
    sentiment: bullishProb >= 55 ? 'Neutral-bullish' : bullishProb <= 45 ? 'Neutral-bearish' : 'Neutral',
    crashAlert: cache.mood === 'HIGH VOL',
    exposureLots: 0,
    dailyPnlPct: 0,
    updatedAt: cache.updatedAt,
    dataMode: 'live',
    dataSource: quotesSource,
    apiStatus: 'online',
    disclaimer: 'Educational software only. Not financial advice.'
  };
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const headers = securityHeaders({ 'Content-Type': MIME[ext] || 'application/octet-stream' });
    const base = path.basename(filePath);
    if (ext === '.html' || ext === '.webmanifest' || base === 'sw.js') {
      headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
    } else if (ext === '.js' || ext === '.css' || ext === '.svg' || ext === '.png' || ext === '.webp') {
      headers['Cache-Control'] = 'no-cache, must-revalidate';
    }
    res.writeHead(200, headers);
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const rawUrl = req.url || '/';
  const url = rawUrl.split('?')[0];

  if (req.method === 'OPTIONS' && url.startsWith('/api/')) return corsPreflight(res);

  if (url.startsWith('/api/members')) {
    if (!memberDesk) return json(res, 503, { error: 'Members area unavailable' });
    return memberDesk.handle(req, res, {
      url,
      rawUrl,
      json,
      readBody,
      news: signalNewsContext,
      newsWindow: signalNewsWindow,
      calendar: () => cache.calendar || []
    });
  }

  if (url === '/api/register' && req.method === 'POST') return handleRegister(req, res);
  if (url === '/api/verify-email' && req.method === 'GET') return handleVerifyEmail(req, res, rawUrl);
  if (url === '/api/resend-verification' && req.method === 'POST') return handleResendVerify(req, res);
  if (url === '/api/payment' && req.method === 'POST') return handlePayment(req, res);
  if (url === '/api/config') return json(res, 200, apiConfig());
  if (url === '/api/admin/session' && req.method === 'GET') {
    return json(res, 200, {
      authenticated: adminAuthOk(req),
      totpEnabled: adminAuth ? adminAuth.totpEnabled() : false,
      configured: adminAuth ? adminAuth.isConfigured() : false
    });
  }
  if (url === '/api/admin/login' && req.method === 'POST') {
    if (!adminAuth) return json(res, 503, { error: 'Admin auth unavailable' });
    return readBody(req)
      .then((body) => {
        const result = adminAuth.login(req, body);
        if (!result.ok) return json(res, result.status || 403, { error: result.error });
        adminAuth.setSessionCookie(res);
        return json(res, 200, { ok: true, totpRequired: result.totpRequired });
      })
      .catch((e) => json(res, 400, { error: e.message }));
  }
  if (url === '/api/admin/logout' && req.method === 'POST') {
    if (adminAuth) {
      adminAuth.logout(req);
      adminAuth.clearSessionCookie(res);
    }
    return json(res, 200, { ok: true });
  }
  if (url === '/api/dashboard/session' && req.method === 'POST') return handleDashboardSession(req, res);
  if (url === '/api/dashboard/session/redeem' && req.method === 'POST') return handleDashboardRedeem(req, res);
  if (url === '/api/dashboard/journal' && req.method === 'GET') return handleDashboardJournalGet(req, res);
  if (url === '/api/dashboard/journal' && req.method === 'POST') return handleDashboardJournalPost(req, res);
  if (url === '/api/dashboard/history' && req.method === 'GET') return handleDashboardHistory(req, res, rawUrl);
  if (url === '/api/dashboard/events' && req.method === 'GET') return handleDashboardEvents(req, res, rawUrl);

  if (url === '/api/institutional-live' && req.method === 'GET') return handleInstitutionalLive(req, res);
  if (url === '/api/email/subscribers' && req.method === 'GET') return handleEmailSubscribers(req, res);
  if (url === '/api/email/status' && req.method === 'GET') return handleEmailStatus(req, res);
  if (url === '/api/email/draft' && req.method === 'POST') return handleEmailDraft(req, res);
  if (url === '/api/email/send' && req.method === 'POST') return handleEmailSend(req, res);

  if (url === '/api/registrations' && req.method === 'GET') {
    if (!requireAdminApi(req, res)) return;
    return regStore.getRegistrations()
      .then((list) => {
        const revealed = secureFields ? secureFields.revealList(list) : list;
        return json(res, 200, { count: revealed.length, registrations: revealed, storage: regStore.storageInfo() });
      })
      .catch((e) => json(res, 500, { error: e.message }));
  }

  if (url === '/api/health') {
    return json(res, 200, {
      ok: true,
      mode: 'production',
      site: business.website,
      updatedAt: cache.updatedAt,
      quotes: quotesService ? 'available' : 'unavailable',
      signals: signalService ? 'available' : 'unavailable',
      ai: aiIntelligence && aiIntelligence.status().configured ? 'configured' : 'not_configured'
    });
  }
  if (url === '/api/wiring') {
    if (!requireAdminApi(req, res)) return;
    return json(res, 200, apiWiring());
  }
  if (url === '/api/status') {
    return json(res, 200, {
      website: 'online',
      mood: cache.mood,
      nextEvent: cache.nextEvent,
      updatedAt: cache.updatedAt,
      dataMode: 'live',
      dataSource: quotesService ? 'Yahoo Finance / CoinGecko' : 'Server cache',
      apiStatus: 'online'
    });
  }
  if (url === '/api/pro-summary') return json(res, 200, apiProSummary());
  if (url === '/api/ai/status' && req.method === 'GET') {
    return json(res, 200, aiIntelligence ? aiIntelligence.status() : { configured: false, mode: 'analysis_only', executionEnabled: false });
  }
  if (url === '/api/ai/analyze' && req.method === 'POST') {
    if (!aiIntelligence || !quotesService) return json(res, 503, { decision: 'NO_TRADE', error: 'AI or quote service unavailable' });
    return readBody(req).then(async (body) => {
      const symbol = String(body.symbol || '').toUpperCase();
      const timeframe = String(body.timeframe || '').toUpperCase();
      const quotes = await quotesService.getQuotes();
      const groups = [quotes.forex || {}, quotes.metals || {}, quotes.crypto || {}];
      let price = null;
      for (const group of groups) if (Number(group[symbol]) > 0) price = Number(group[symbol]);
      const result = await aiIntelligence.analyze({
        symbol, timeframe, price,
        quoteTime: (quotes.times && (quotes.times[symbol] || quotes.times._fx)) || quotes.updatedAt,
        quoteLive: quotes.live === true,
        changePct: quotes.changes && quotes.changes[symbol],
        market: apiProSummary(), calendar: cache.calendar, news: cache.news
      });
      return json(res, 200, result);
    }).catch((e) => json(res, 400, aiIntelligence.failClosed(e.message)));
  }
  if (url === '/api/risk-summary') {
    return json(res, 200, {
      mood: cache.calendarMood || cache.mood,
      sessionRisk: cache.sessionRisk || 'MEDIUM',
      nextEvent: cache.nextEvent,
      calendar: cache.calendar,
      breakingNews: cache.news,
      highImpactToday: cache.highImpactToday || 0,
      calendarSource: cache.calendarSource || 'server',
      finnhubEnabled: !!cache.finnhubEnabled,
      updatedAt: cache.updatedAt,
      dataMode: cache.finnhubEnabled ? 'live' : 'reference',
      dataSource: cache.calendarSource || (quotesService ? 'Yahoo Finance / CoinGecko' : 'Server cache'),
      apiStatus: 'online',
      disclaimer: 'Educational calendar only — not financial advice.'
    });
  }
  if (url === '/api/calendar' && req.method === 'GET') {
    const q = rawUrl.includes('?') ? rawUrl.split('?')[1] : '';
    const params = new URLSearchParams(q);
    const opts = {
      hours: params.get('hours') || '168',
      risk: params.get('risk') || '',
      currency: params.get('currency') || ''
    };
    const respond = (payload) => {
      const items = economicCalendar
        ? economicCalendar.filterCalendar(opts)
        : (payload.calendar || []).slice(0, 50);
      return json(res, 200, {
        items,
        calendar: items,
        nextEvent: payload.nextEvent,
        highImpactToday: payload.highImpactToday,
        source: payload.source,
        finnhubEnabled: payload.finnhubEnabled,
        updatedAt: payload.updatedAt,
        disclaimer: payload.disclaimer || 'Educational only — not financial advice.'
      });
    };
    if (economicCalendar) {
      return economicCalendar.refresh()
        .then((p) => { applyCalendarToCache(p); return respond(economicCalendar.getPayload()); })
        .catch(() => respond(economicCalendar.getPayload()));
    }
    return respond({ calendar: cache.calendar, nextEvent: cache.nextEvent, updatedAt: cache.updatedAt });
  }
  if (url === '/api/pricing' && req.method === 'GET') {
    try {
      const pricing = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'pricing.json'), 'utf8'));
      return json(res, 200, Object.assign({ ok: true }, pricing));
    } catch (error) {
      return json(res, 500, { ok: false, error: 'Pricing file is missing' });
    }
  }
  if (url === '/api/signals/plans' && req.method === 'GET') {
    if (!signalService) return json(res, 503, { error: 'Signal service unavailable' });
    const force = rawUrl.includes('force=1');
    return signalService.getBoard({ force, news: signalNewsContext() })
      .then((board) => {
        const plans = signalService.getPlans(board);
        plans.public_teaser = true;
        plans.plans = (plans.plans || []).map((plan) => Object.assign({}, plan, {
          key_levels: null,
          levels_note: 'Entry, stop and targets are in the members area.'
        }));
        return json(res, 200, plans);
      })
      .catch((e) => {
        console.warn('[AuraFX] /api/signals/plans:', e.message);
        return json(res, 500, { error: 'Plans unavailable' });
      });
  }
  if (url === '/api/signals/free' && req.method === 'GET') {
    if (!signalService) return json(res, 503, { error: 'Signal service unavailable' });
    const force = rawUrl.includes('force=1');
    return signalService.getBoard({ force, news: signalNewsContext() })
      .then(() => json(res, 200, signalService.getDelayedBoard()))
      .catch((e) => {
        console.warn('[AuraFX] /api/signals/free:', e.message);
        return json(res, 500, { error: 'Delayed scan unavailable' });
      });
  }
  if (url === '/api/signals/track-record' && req.method === 'GET') {
    if (!signalService) return json(res, 503, { error: 'Signal service unavailable' });
    const params = new URLSearchParams(rawUrl.includes('?') ? rawUrl.split('?')[1] : '');
    return signalService.getTrackRecord({
      instrument: params.get('instrument') || '',
      month: params.get('month') || ''
    }).then((record) => json(res, 200, record))
      .catch((e) => {
        console.warn('[AuraFX] /api/signals/track-record:', e.message);
        return json(res, 500, { error: 'Track record unavailable' });
      });
  }
  if (url === '/api/signals/alerts' && req.method === 'GET') {
    if (!signalService) return json(res, 503, { error: 'Signal service unavailable' });
    return json(res, 200, signalService.alertStatus());
  }
  if (url === '/api/signals/alerts' && req.method === 'POST') {
    if (!signalService) return json(res, 503, { error: 'Signal service unavailable' });
    return readBody(req).then(async (body) => {
      try {
        const result = body && body.unsubscribe
          ? await signalService.unsubscribeAlerts(body.token || body.unsubscribe)
          : await signalService.subscribeAlerts(body);
        return json(res, 200, result);
      } catch (error) {
        return json(res, error.status || 400, { error: error.message || 'Alert signup failed' });
      }
    }).catch((e) => json(res, e.status || 400, { error: e.message || 'Alert signup failed' }));
  }
  if (url === '/api/signals/ask' && req.method === 'POST') {
    if (!signalService) return json(res, 503, { error: 'Signal service unavailable' });
    return readBody(req).then(async (body) => {
      try {
        const result = await signalService.ask(body && body.question, { news: signalNewsContext() });
        return json(res, result.ok === false ? 400 : 200, result);
      } catch (error) {
        console.warn('[AuraFX] /api/signals/ask:', error.message);
        return json(res, 500, { error: 'Assistant unavailable' });
      }
    }).catch((e) => json(res, e.status || 400, { error: e.message || 'Assistant unavailable' }));
  }
  if ((url === '/api/signals' || url === '/api/signals/tracker') && req.method === 'GET') {
    if (!signalService) return json(res, 503, { error: 'Signal service unavailable' });
    const force = rawUrl.includes('force=1');
    return signalService.getBoard({ force, news: signalNewsContext() })
      .then((board) => {
        if (url === '/api/signals/tracker') {
          return json(res, 200, {
            ok: true,
            updated_at: board.updated_at,
            tracker: board.tracker,
            disclaimer: board.disclaimer
          });
        }
        return json(res, 200, board);
      })
      .catch((e) => {
        console.warn('[AuraFX] /api/signals:', e.message);
        return json(res, 500, { error: 'Signal scan failed' });
      });
  }
  if (url === '/api/news') return json(res, 200, { items: cache.news, breaking: cache.news });
  if (url === '/api/quotes' && req.method === 'GET') {
    if (!quotesService) return json(res, 503, { error: 'Quotes service unavailable' });
    return quotesService.getQuotes(req.url.includes('force=1'))
      .then((q) => json(res, 200, q))
      .catch((e) => json(res, 500, { error: e.message }));
  }
  if (url === '/api/institutional' && req.method === 'GET') {
    if (quotesService) {
      return quotesService.getQuotes()
        .then((q) => json(res, 200, apiInstitutional(q)))
        .catch(() => json(res, 200, apiInstitutional(null)));
    }
    return json(res, 200, apiInstitutional(null));
  }
  if (url === '/api/markets') {
    const marketWarnings = [
      'HIGH IMPACT: ' + (cache.nextEvent.title || 'Economic release') + ' in ' +
        (cache.nextEvent.minutesUntil || 45) + ' min — reduce exposure',
      'Volatility alert: spreads may widen on ' + (cache.nextEvent.currency || 'USD') + ' pairs'
    ];
    if (liveMarkets) {
      const force = req.url.includes('force=1');
      return liveMarkets.getMarkets(cache.news, marketWarnings, force)
        .then((payload) => json(res, 200, {
          ...payload,
          mood: cache.calendarMood || cache.mood,
          nextEvent: cache.nextEvent,
          finnhubEnabled: cache.finnhubEnabled,
          calendarSource: cache.calendarSource
        }))
        .catch((e) => {
          console.warn('[AuraFX] /api/markets:', e.message);
          return json(res, 200, {
            live: false,
            warnings: marketWarnings,
            mood: cache.mood,
            nextEvent: cache.nextEvent,
            updatedAt: cache.updatedAt
          });
        });
    }
    return json(res, 200, {
      warnings: marketWarnings,
      mood: cache.mood,
      nextEvent: cache.nextEvent,
      updatedAt: cache.updatedAt
    });
  }

  /* Old owner test URL — always send users to the Pro dashboard */
  if (url === '/live-wiring.html' || url === '/live-wiring') {
    res.writeHead(302, {
      Location: '/dashboard.html',
      'Cache-Control': 'no-store'
    });
    return res.end();
  }

  let file = url === '/' ? '/index.html' : url;
  const safe = path.normalize(file).replace(/^(\.\.[/\\])+/, '');

  if (adminAuth && adminAuth.isAdminPage(safe) && !adminAuthOk(req)) {
    return redirectAdminLogin(res, safe);
  }

  const full = path.join(PUBLIC, safe);
  if (!full.startsWith(PUBLIC)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.stat(full, (err, stat) => {
    if (!err && stat.isDirectory()) return serveFile(res, path.join(full, 'index.html'));
    if (err) return serveFile(res, path.join(PUBLIC, 'index.html'));
    serveFile(res, full);
  });
});

function startServer() {
  server.listen(PORT, HOST, () => {
    const local = HOST === '0.0.0.0' ? 'http://127.0.0.1:' + PORT : 'http://' + HOST + ':' + PORT;
    const storage = regStore.storageInfo();
    console.log('');
    console.log('  AURAFX SERVER IS RUNNING');
    console.log('  ========================');
    console.log('  Local:      ' + local + '/');
    console.log('  Live site:  ' + SITE_URL + ' (after DNS + Render)');
    console.log('  Dashboard:  ' + local + '/dashboard.html');
    console.log('  Register:   ' + local + '/register.html');
    console.log('  Owner mail: ' + local + '/owner-email.html');
    console.log('  Domain:     aurafxelite.com');
    console.log('  Storage:    ' + storage.backend + (storage.path ? ' (' + storage.path + ')' : ''));
    if (quotesService) {
      quotesService.startAutoRefresh();
      quotesService.getQuotes(true)
        .then((q) => console.log('  Quotes:     LIVE — XAUUSD $' + (q.metals.XAUUSD || '—') + ' · ' + q.source))
        .catch(() => console.log('  Quotes:     warming up…'));
    }
    if (dashStore) {
      const s = apiProSummary();
      dashStore.appendHistory({
        ts: new Date().toISOString(),
        mood: s.mood,
        score: s.score,
        bullishProb: s.bullishProb,
        sessionRisk: s.sessionRisk
      }).catch(() => {});
      dashStore.appendEvent('info', 'AuraFX Pro dashboard server online')
        .catch(() => {});
      console.log('  Dashboard:  history + journal store (' + dashStore.storageInfo().backend + ')');
    }
    console.log('');
    if (HOST === '127.0.0.1') console.log('  DO NOT CLOSE THIS WINDOW (local mode)');
    console.log('');
  });
}

regStore.init()
  .then(() => (dashStore ? dashStore.init() : null))
  .then(startServer)
  .catch((e) => {
    console.error('[AuraFX] Storage init warning (starting anyway):', e.message);
    startServer();
  });

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log('Port ' + PORT + ' already in use. Close other AuraFX window or restart PC.');
  } else {
    console.log('Error:', e.message);
  }
  process.exit(1);
});
