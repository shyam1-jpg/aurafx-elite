/**
 * Owner email campaigns — Resend API (no extra npm). Optional OpenAI polish.
 */
const fs = require('fs');
const path = require('path');

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'AuraFX Elite <onboarding@resend.dev>';
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || '';
const SITE_URL = process.env.SITE_URL || 'https://aurafxelite.com';
const AUTO_WELCOME = process.env.EMAIL_AUTO_WELCOME === '1' || process.env.EMAIL_AUTO_WELCOME === 'true';

const DATA_DIR = path.join(__dirname, 'data');
const LOG_FILE = path.join(DATA_DIR, 'email-log.json');
const CAMPAIGN_FILE = path.join(DATA_DIR, 'email-campaigns.json');

const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 1100;

function ensureData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(file, fallback) {
  ensureData();
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  ensureData();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function isConfigured() {
  return !!RESEND_API_KEY;
}

function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function personalize(html, client) {
  const first = (client.fullName || 'Trader').split(/\s+/)[0];
  const map = {
    name: first,
    fullName: client.fullName || 'Trader',
    email: client.email,
    country: client.country || '',
    plan: client.planName || client.plan || ''
  };
  return html.replace(/\{\{(\w+)\}\}/gi, (_, key) => escHtml(map[key.toLowerCase()] || ''));
}

function personalizeSubject(subject, client) {
  const first = (client.fullName || 'Trader').split(/\s+/)[0];
  return subject
    .replace(/\{\{name\}\}/gi, first)
    .replace(/\{\{fullName\}\}/gi, client.fullName || 'Trader');
}

function wrapEmailHtml(bodyInner) {
  return '<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="margin:0;background:#0a0e14;font-family:Inter,Arial,sans-serif;color:#e8ecf0;">' +
    '<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">' +
    '<table width="600" style="max-width:600px;background:#121820;border:1px solid #2a3040;border-radius:12px;overflow:hidden">' +
    '<tr><td style="background:linear-gradient(135deg,#1a2030,#0d1118);padding:20px 24px;border-bottom:2px solid #d4af37">' +
    '<img src="' + escHtml(SITE_URL) + '/assets/aura-logo.svg" width="40" height="40" alt="AuraFX" style="vertical-align:middle;border-radius:8px;margin-right:10px"/>' +
    '<span style="font-size:22px;font-weight:700;color:#d4af37;vertical-align:middle">AuraFX</span> <span style="color:#888;font-size:14px;vertical-align:middle"> Elite</span></td></tr>' +
    '<tr><td style="padding:24px;font-size:15px;line-height:1.65">' + bodyInner + '</td></tr>' +
    '<tr><td style="padding:16px 24px;background:#080c14;font-size:11px;color:#888;border-top:1px solid #2a3040">' +
    'Not financial advice. Trading involves risk. <a href="' + escHtml(SITE_URL) + '/risk-warning.html" style="color:#d4af37">Risk warning</a> · ' +
    '<a href="' + escHtml(SITE_URL) + '/register.html" style="color:#d4af37">Dashboard</a></td></tr></table></td></tr></table></body></html>';
}

function buildContext(serverCache, extra) {
  extra = extra || {};
  const ev = (serverCache && serverCache.nextEvent) || {};
  const dateStr = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  return {
    date: dateStr,
    mood: (serverCache && serverCache.mood) || 'CAUTION',
    nextEvent: ev.title || 'Economic data',
    eventMins: ev.minutesUntil != null ? ev.minutesUntil : '—',
    eventCur: ev.currency || 'USD',
    siteUrl: SITE_URL,
    goldNote: extra.goldNote || 'Monitor XAUUSD around news — reduce size before high impact.',
    forexNote: extra.forexNote || 'USD pairs may widen spreads into the release.',
    bias: extra.bias || 'Neutral-to-cautious until data passes.'
  };
}

function buildWelcomeDraft(ctx) {
  const inner =
    '<p style="margin:0 0 16px">Hi {{name}},</p>' +
    '<p style="margin:0 0 16px">Welcome to <strong style="color:#d4af37">AuraFX Elite</strong>. Your registration is confirmed.</p>' +
    '<p style="margin:0 0 16px"><strong>Today:</strong> ' + escHtml(ctx.date) + '</p>' +
    '<p style="margin:0 0 16px">Open your dashboard for live markets, risk tools, and signals:</p>' +
    '<p style="margin:0 0 20px"><a href="' + escHtml(ctx.siteUrl) + '/dashboard.html" style="display:inline-block;background:#d4af37;color:#0a0e14;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700">Open dashboard</a></p>' +
    '<p style="margin:0;color:#888;font-size:13px">You opted in to updates. Unsubscribe: reply STOP or contact support.</p>';
  return {
    subject: 'Welcome to AuraFX Elite',
    html: wrapEmailHtml(inner),
    type: 'welcome'
  };
}

function buildForecastDraft(ctx, ownerNotes) {
  const notes = ownerNotes
    ? '<div style="margin:16px 0;padding:14px;background:#1a2030;border-left:3px solid #d4af37;border-radius:6px">' +
      escHtml(ownerNotes).replace(/\n/g, '<br/>') + '</div>'
    : '';
  const inner =
    '<p style="margin:0 0 8px;font-size:12px;color:#d4af37;text-transform:uppercase;letter-spacing:.06em">Daily trading forecast</p>' +
    '<p style="margin:0 0 16px">Hi {{name}},</p>' +
    '<p style="margin:0 0 16px"><strong>Date:</strong> ' + escHtml(ctx.date) + '</p>' +
    '<table width="100%" style="margin:0 0 16px;font-size:14px">' +
    '<tr><td style="padding:8px;border:1px solid #2a3040;color:#888">Risk mood</td><td style="padding:8px;border:1px solid #2a3040"><strong>' + escHtml(ctx.mood) + '</strong></td></tr>' +
    '<tr><td style="padding:8px;border:1px solid #2a3040;color:#888">Next event</td><td style="padding:8px;border:1px solid #2a3040">' + escHtml(ctx.nextEvent) + ' (' + escHtml(ctx.eventCur) + ') ~' + escHtml(String(ctx.eventMins)) + ' min</td></tr>' +
    '<tr><td style="padding:8px;border:1px solid #2a3040;color:#888">Bias</td><td style="padding:8px;border:1px solid #2a3040">' + escHtml(ctx.bias) + '</td></tr></table>' +
    '<p style="margin:0 0 12px"><strong>Gold:</strong> ' + escHtml(ctx.goldNote) + '</p>' +
    '<p style="margin:0 0 12px"><strong>Forex:</strong> ' + escHtml(ctx.forexNote) + '</p>' +
    notes +
    '<p style="margin:16px 0 0"><a href="' + escHtml(ctx.siteUrl) + '/dashboard.html" style="color:#d4af37">Full terminal on dashboard →</a></p>' +
    '<p style="margin:16px 0 0;font-size:12px;color:#888">Past performance ≠ future results. Not personal advice.</p>';
  return {
    subject: 'AuraFX Forecast — ' + new Date().toLocaleDateString('en-GB'),
    html: wrapEmailHtml(inner),
    type: 'forecast'
  };
}

async function polishWithOpenAI(draft, ctx) {
  if (!OPENAI_API_KEY) return draft;
  try {
    const prompt =
      'Improve this trading newsletter email for retail forex/gold clients. Keep disclaimers. Return JSON only: {"subject":"...","bodyHtml":"inner html fragment without wrapper"}.\n' +
      'Subject: ' + draft.subject + '\nBody:\n' + draft.html.replace(/<[^>]+>/g, ' ').slice(0, 2000);
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + OPENAI_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
        max_tokens: 1200
      })
    });
    if (!r.ok) return draft;
    const data = await r.json();
    const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!text) return draft;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return draft;
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.subject) draft.subject = parsed.subject;
    if (parsed.bodyHtml) draft.html = wrapEmailHtml(parsed.bodyHtml.replace(/\{\{name\}\}/gi, '{{name}}'));
    draft.aiPolished = true;
  } catch (e) {
    draft.aiError = e.message;
  }
  return draft;
}

async function generateDraft(options) {
  const ctx = buildContext(options.serverCache, options.contextExtra);
  let draft = options.type === 'welcome'
    ? buildWelcomeDraft(ctx)
    : buildForecastDraft(ctx, options.ownerNotes || '');
  if (options.useAi) draft = await polishWithOpenAI(draft, ctx);
  draft.generatedAt = new Date().toISOString();
  draft.recipientHint = options.audience || 'marketing';
  return draft;
}

async function sendOneEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not set on server');
  const payload = {
    from: EMAIL_FROM,
    to: [to],
    subject,
    html
  };
  if (EMAIL_REPLY_TO) payload.reply_to = EMAIL_REPLY_TO;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + RESEND_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message || data.error || 'Resend HTTP ' + r.status);
  return data;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function filterRecipients(registrations, audience) {
  const list = registrations.filter((r) => r.email && /@/.test(r.email));
  if (audience === 'marketing') return list.filter((r) => r.marketingOptIn);
  if (audience === 'paid') {
    return list.filter((r) => r.paymentStatus === 'paid' || r.paymentStatus === 'free');
  }
  return list;
}

async function sendCampaign(options) {
  const { registrations, subject, html, audience, dryRun } = options;
  const recipients = filterRecipients(registrations, audience || 'marketing');
  const campaign = {
    id: 'camp_' + Date.now(),
    subject,
    audience: audience || 'marketing',
    dryRun: !!dryRun,
    total: recipients.length,
    sent: 0,
    failed: 0,
    errors: [],
    startedAt: new Date().toISOString(),
    finishedAt: null
  };

  if (dryRun) {
    campaign.finishedAt = new Date().toISOString();
    campaign.preview = recipients.slice(0, 5).map((r) => r.email);
    appendCampaign(campaign);
    return campaign;
  }

  if (!isConfigured()) throw new Error('Email not configured — set RESEND_API_KEY');

  for (let i = 0; i < recipients.length; i++) {
    const client = recipients[i];
    try {
      const body = personalize(html, client);
      await sendOneEmail({ to: client.email, subject: personalizeSubject(subject, client), html: body });
      campaign.sent++;
      appendLog({ type: 'campaign', email: client.email, subject, campaignId: campaign.id, ok: true });
    } catch (e) {
      campaign.failed++;
      if (campaign.errors.length < 20) campaign.errors.push({ email: client.email, error: e.message });
      appendLog({ type: 'campaign', email: client.email, subject, campaignId: campaign.id, ok: false, error: e.message });
    }
    if ((i + 1) % BATCH_SIZE === 0 && i + 1 < recipients.length) await sleep(BATCH_DELAY_MS);
  }

  campaign.finishedAt = new Date().toISOString();
  appendCampaign(campaign);
  return campaign;
}

async function sendWelcome(client, serverCache) {
  if (!AUTO_WELCOME || !isConfigured()) return { skipped: true, reason: 'disabled or not configured' };
  if (!client.marketingOptIn) return { skipped: true, reason: 'no marketing opt-in' };
  const draft = await generateDraft({ type: 'welcome', serverCache, useAi: false });
  const html = personalize(draft.html, client);
  const subject = personalizeSubject(draft.subject, client);
  await sendOneEmail({ to: client.email, subject, html });
  appendLog({ type: 'welcome', email: client.email, subject, ok: true });
  return { sent: true };
}

function buildVerificationEmail(client, verifyUrl) {
  const inner =
    '<p style="margin:0 0 16px">Hi {{name}},</p>' +
    '<p style="margin:0 0 16px"><strong style="color:#2ecc71">Your registration was successful.</strong></p>' +
    '<p style="margin:0 0 16px">Please verify your email address to activate your AuraFX Elite account:</p>' +
    '<p style="margin:0 0 24px;text-align:center">' +
    '<a href="' + escHtml(verifyUrl) + '" style="display:inline-block;background:#d4af37;color:#0a0e14;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px">Verify my email</a></p>' +
    '<p style="margin:0 0 12px;font-size:13px;color:#888">Or copy this link into your browser:</p>' +
    '<p style="margin:0 0 16px;font-size:12px;word-break:break-all;color:#aaa">' + escHtml(verifyUrl) + '</p>' +
    '<p style="margin:0;font-size:12px;color:#888">Link expires in 48 hours. If you did not register, ignore this email.</p>';
  return {
    subject: 'Verify your email — AuraFX Elite registration',
    html: wrapEmailHtml(inner)
  };
}

async function sendVerificationEmail(client, serverCache) {
  if (!isConfigured()) return { skipped: true, reason: 'RESEND_API_KEY not set' };
  if (!client.email || !client.verifyToken) return { skipped: true, reason: 'missing email or token' };
  if (client.emailVerified) return { skipped: true, reason: 'already verified' };
  const verifyUrl = SITE_URL.replace(/\/$/, '') + '/verify-email.html?token=' + encodeURIComponent(client.verifyToken);
  const draft = buildVerificationEmail(client, verifyUrl);
  const html = personalize(draft.html, client);
  const subject = personalizeSubject(draft.subject, client);
  await sendOneEmail({ to: client.email, subject, html });
  appendLog({ type: 'verify', email: client.email, subject, ok: true });
  return { sent: true, verifyUrl };
}

function appendLog(entry) {
  const log = readJson(LOG_FILE, []);
  log.unshift({ ...entry, at: new Date().toISOString() });
  writeJson(LOG_FILE, log.slice(0, 500));
}

function appendCampaign(c) {
  const list = readJson(CAMPAIGN_FILE, []);
  list.unshift(c);
  writeJson(CAMPAIGN_FILE, list.slice(0, 100));
}

function getStatus() {
  return {
    configured: isConfigured(),
    provider: 'Resend',
    from: EMAIL_FROM,
    autoWelcome: AUTO_WELCOME,
    aiAvailable: !!OPENAI_API_KEY,
    siteUrl: SITE_URL,
    batchSize: BATCH_SIZE
  };
}

function getCampaigns() {
  return readJson(CAMPAIGN_FILE, []);
}

function getEmailLog() {
  return readJson(LOG_FILE, []);
}

module.exports = {
  isConfigured,
  generateDraft,
  sendCampaign,
  sendWelcome,
  sendVerificationEmail,
  filterRecipients,
  getStatus,
  getCampaigns,
  getEmailLog,
  readJson,
  LOG_FILE,
  CAMPAIGN_FILE,
  AUTO_WELCOME
};
