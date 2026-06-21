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
  '.svg': 'image/svg+xml'
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
  updatedAt: new Date().toISOString()
};

const OWNER_KEY = process.env.AURAFX_OWNER_KEY || 'aurafx-owner';
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

function ownerKeyOk(req) {
  return req.headers['x-owner-key'] === OWNER_KEY;
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
    'Access-Control-Allow-Headers': 'Content-Type, X-Owner-Key'
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
        verificationError: verificationError || undefined
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
  const paypalReady = !!(PAYPAL_CLIENT_ID && (paypalVerify && paypalVerify.isConfigured()));
  return {
    plans: PLANS,
    paypalConfigured: paypalReady,
    paypalClientId: PAYPAL_CLIENT_ID,
    paypalMode: PAYPAL_MODE,
    paypalBusinessEmail: PAYPAL_BUSINESS_EMAIL,
    allowManualPaymentConfirm: ALLOW_MANUAL_PAYMENT_CONFIRM,
    dataEncryption: secureFields ? secureFields.enabled() : false,
    currency: 'USD',
    institutionalMode: INSTITUTIONAL_MODE,
    institutionalLivePublic: INSTITUTIONAL_MODE === 'public',
    ownerPreviewAvailable: INSTITUTIONAL_MODE === 'preview' || INSTITUTIONAL_MODE === 'public',
    email: emailStatus,
    storage: regStore.storageInfo()
  };
}

function handleEmailSubscribers(req, res) {
  if (!ownerKeyOk(req)) return json(res, 403, { error: 'Forbidden' });
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
  if (!ownerKeyOk(req)) return json(res, 403, { error: 'Forbidden' });
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
  if (!ownerKeyOk(req)) return json(res, 403, { error: 'Forbidden' });
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
  if (!ownerKeyOk(req)) return json(res, 403, { error: 'Forbidden' });
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
  if (INSTITUTIONAL_MODE === 'preview' && !instLiveMod.ownerKeyOk(req, OWNER_KEY)) {
    return json(res, 403, { error: 'Valid X-Owner-Key required for live preview' });
  }
  instLiveMod.getLivePayload(cache)
    .then((payload) => json(res, 200, payload))
    .catch((e) => json(res, 500, { error: e.message }));
}

function apiInstitutional(quotes) {
  const xau = quotes && quotes.metals && quotes.metals.XAUUSD;
  const eur = quotes && quotes.forex && quotes.forex.EURUSD;
  const goldSupport = xau
    ? [(xau * 0.995).toFixed(0), (xau * 0.988).toFixed(0)]
    : ['—', '—'];
  const goldResist = xau
    ? [(xau * 1.005).toFixed(0), (xau * 1.012).toFixed(0)]
    : ['—', '—'];
  return {
    marketOverview: {
      sentiment: 'Risk-On',
      riskMode: 'Moderate Risk-On',
      fearGreed: 62,
      vix: 18.4,
      currencyStrength: [
        { c: 'USD', s: 88 }, { c: 'EUR', s: 72 }, { c: 'GBP', s: 65 },
        { c: 'JPY', s: 41 }, { c: 'AUD', s: 58 }, { c: 'XAU', s: 76 }
      ],
      gainers: [{ n: 'XAUUSD', v: '+0.42%' }, { n: 'EURUSD', v: '+0.18%' }],
      losers: [{ n: 'USDJPY', v: '-0.21%' }],
      volumeNote: 'Forex cash session volume +8% vs 20d avg',
      globalStatus: 'US open · Europe active · Asia closed'
    },
    calendar: {
      high: [
        { t: cache.nextEvent.title || 'US CPI m/m', cur: 'USD', time: '14:30 UTC', impact: 'Inflation' },
        { t: 'FOMC Rate Decision', cur: 'USD', time: '19:00 UTC', impact: 'Interest rate' }
      ],
      medium: [{ t: 'US Retail Sales', cur: 'USD', time: '13:30 UTC', impact: 'Retail sales' }],
      low: [{ t: 'JP Trade Balance', cur: 'JPY', time: '23:50 UTC', impact: 'Trade balance' }]
    },
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
      daily: 'Live feed',
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
      strengthRank: ['USD', 'EUR', 'GBP', 'AUD', 'JPY'],
      volRank: ['GBPJPY', 'XAUUSD', 'EURUSD'],
      trending: ['XAUUSD up', 'EURUSD up'],
      sessions: { asian: 'Range', london: 'Trend', ny: 'Volatile' },
      smartMoney: 'USD accumulation on dips'
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
      winRate: 76.2, rr: 2.1, avgWin: 142, avgLoss: 68, profitFactor: 1.48,
      maxDD: 11.2, consecWins: 5, consecLoss: 2, sharpe: 1.12, monthlyGrowth: 4.2
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
    heatmap: [
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

function apiWiring() {
  const base = 'http://127.0.0.1:' + PORT;
  const pages = [
    'index.html', 'dashboard.html', 'hard-sell.html', 'aura-lite.html', 'mt5-install.html',
    'register.html', 'verify-email.html', 'terms.html', 'privacy.html', 'risk-warning.html',
    'responsible-trading.html', 'regulatory.html', 'refunds.html', 'cookies.html',
    'system-status.html', 'owner-email.html', 'owner-leads.html', 'owner-preview.html'
  ];
  const apis = [
    '/api/health', '/api/status', '/api/quotes', '/api/pro-summary', '/api/risk-summary',
    '/api/news', '/api/institutional', '/api/institutional-live', '/api/markets', '/api/wiring'
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

function tickLiveData() {
  cache.updatedAt = new Date().toISOString();
  if (cache.nextEvent && cache.nextEvent.minutesUntil > 0) {
    cache.nextEvent.minutesUntil = Math.max(0, cache.nextEvent.minutesUntil - 1);
  }
}

setInterval(tickLiveData, 60000);

function apiProSummary() {
  return {
    mood: cache.mood,
    sessionRisk: 'MEDIUM',
    session: 'London',
    nextEvent: cache.nextEvent,
    bullishProb: 58,
    bearishProb: 42,
    score: 78,
    sentiment: 'Bullish',
    crashAlert: false,
    exposureLots: 0,
    dailyPnlPct: 0,
    updatedAt: cache.updatedAt
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
    if (ext === '.html') headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
    res.writeHead(200, headers);
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const rawUrl = req.url || '/';
  const url = rawUrl.split('?')[0];

  if (req.method === 'OPTIONS' && url.startsWith('/api/')) return corsPreflight(res);

  if (url === '/api/register' && req.method === 'POST') return handleRegister(req, res);
  if (url === '/api/verify-email' && req.method === 'GET') return handleVerifyEmail(req, res, rawUrl);
  if (url === '/api/resend-verification' && req.method === 'POST') return handleResendVerify(req, res);
  if (url === '/api/payment' && req.method === 'POST') return handlePayment(req, res);
  if (url === '/api/config') return json(res, 200, apiConfig());
  if (url === '/api/institutional-live' && req.method === 'GET') return handleInstitutionalLive(req, res);
  if (url === '/api/email/subscribers' && req.method === 'GET') return handleEmailSubscribers(req, res);
  if (url === '/api/email/status' && req.method === 'GET') return handleEmailStatus(req, res);
  if (url === '/api/email/draft' && req.method === 'POST') return handleEmailDraft(req, res);
  if (url === '/api/email/send' && req.method === 'POST') return handleEmailSend(req, res);

  if (url === '/api/registrations' && req.method === 'GET') {
    if (!ownerKeyOk(req)) return json(res, 403, { error: 'Forbidden' });
    return regStore.getRegistrations()
      .then((list) => {
        const revealed = secureFields ? secureFields.revealList(list) : list;
        return json(res, 200, { count: revealed.length, registrations: revealed, storage: regStore.storageInfo() });
      })
      .catch((e) => json(res, 500, { error: e.message }));
  }

  if (url === '/api/health') return json(res, 200, { ok: true, mode: 'simple-server', port: PORT });
  if (url === '/api/wiring') return json(res, 200, apiWiring());
  if (url === '/api/status') return json(res, 200, { website: 'online', mood: cache.mood });
  if (url === '/api/pro-summary') return json(res, 200, apiProSummary());
  if (url === '/api/risk-summary') {
    return json(res, 200, {
      mood: cache.mood,
      sessionRisk: 'MEDIUM',
      nextEvent: cache.nextEvent,
      calendar: cache.calendar,
      breakingNews: cache.news,
      updatedAt: cache.updatedAt
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
    return json(res, 200, {
      warnings: [
        'HIGH IMPACT: ' + (cache.nextEvent.title || 'Economic release') + ' in ' +
          (cache.nextEvent.minutesUntil || 45) + ' min — reduce exposure',
        'Volatility alert: spreads may widen on ' + (cache.nextEvent.currency || 'USD') + ' pairs'
      ],
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
    console.log('');
    if (HOST === '127.0.0.1') console.log('  DO NOT CLOSE THIS WINDOW (local mode)');
    console.log('');
  });
}

regStore.init()
  .then(startServer)
  .catch((e) => {
    console.error('[AuraFX] Storage init failed:', e.message);
    process.exit(1);
  });

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log('Port ' + PORT + ' already in use. Close other AuraFX window or restart PC.');
  } else {
    console.log('Error:', e.message);
  }
  process.exit(1);
});
