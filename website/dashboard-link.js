'use strict';

const crypto = require('crypto');

const GENERIC_MAGIC = 'If that email has a member account and a registration, a sign-in link was emailed. The link expires in 15 minutes and works once.';
const PASSWORD_REQUIRED = 'A member password is required. Knowing a registration email does not open the dashboard.';
const PASSWORD_REJECTED = 'Email or password is not recognised.';
const SMTP_OFF = 'Magic links are unavailable because SMTP is not configured. Sign in with your member password.';

function createDashboardLink(options) {
  const opts = options || {};
  const pending = new Map();
  const sentAt = new Map();
  const ttl = opts.ttlMs || 15 * 60 * 1000;

  function now() {
    return typeof opts.now === 'function' ? opts.now() : Date.now();
  }

  function hash(token) {
    return crypto.createHash('sha256').update(String(token || '')).digest('hex');
  }

  function site() {
    const value = typeof opts.siteUrl === 'function' ? opts.siteUrl() : opts.siteUrl;
    return String(value || 'https://aurafxelite.com').replace(/\/$/, '');
  }

  function issue(reg, cloudSync) {
    return {
      status: 200,
      body: {
        ok: true,
        id: reg.id,
        fullName: reg.fullName || reg.name || '',
        email: reg.email,
        emailVerified: !!reg.emailVerified,
        dashboardToken: opts.makeToken(reg.id, reg.email),
        cloudSync: !!cloudSync
      }
    };
  }

  async function registrationFor(email) {
    if (!opts.findRegistration) return null;
    const row = await opts.findRegistration(email);
    return row && row.email ? row : null;
  }

  async function request(body, context) {
    const ctx = context || {};
    const posted = body || {};
    const member = ctx.member || null;
    const email = String(posted.email || (member && member.email) || '').trim().toLowerCase();
    const magic = posted.magic === true;
    const password = posted.password == null ? '' : String(posted.password);

    if (magic) {
      const smtp = opts.smtpConfigured ? !!opts.smtpConfigured() : false;
      if (!smtp) {
        return { status: 503, body: { ok: false, smtp: false, error: SMTP_OFF } };
      }
      if (!email) return { status: 400, body: { ok: false, error: 'Email required' } };
      const recent = (sentAt.get(email) || []).filter((stamp) => now() - stamp < 60 * 60 * 1000);
      if (recent.length >= 5) {
        return { status: 429, body: { ok: false, error: 'Too many sign-in emails. Try again later or use your password.' } };
      }
      const knownMember = opts.members && opts.members.findByEmail ? await opts.members.findByEmail(email) : null;
      const reg = knownMember ? await registrationFor(email) : null;
      const same = {
        status: 200,
        body: { ok: true, smtp: true, message: GENERIC_MAGIC }
      };
      if (!knownMember || !reg) {
        sentAt.set(email, recent);
        return same;
      }
      const token = crypto.randomBytes(24).toString('hex');
      pending.set(hash(token), { email, exp: now() + ttl, used: false });
      const link = site() + '/dashboard.html?dash_link=' + token;
      try {
        await opts.sendMail({
          to: email,
          subject: 'AuraFX Elite dashboard sign-in link',
          text: [
            'Use this link to open your AuraFX Elite dashboard journal.',
            link,
            'It expires in 15 minutes and works once.',
            'If you did not ask for this, ignore the email.',
            'Aura Elite FX provides AI-assisted market analysis, confidence scoring, backtesting and risk tools. Trading involves risk and no result is guaranteed.'
          ].join('\n')
        });
      } catch (error) {
        pending.delete(hash(token));
        return { status: 502, body: { ok: false, smtp: true, error: 'The sign-in email could not be sent. Use your member password.' } };
      }
      recent.push(now());
      sentAt.set(email, recent);
      return same;
    }

    if (!password) {
      if (member && member.email && (!posted.email || String(posted.email).trim().toLowerCase() === member.email)) {
        const reg = await registrationFor(member.email);
        if (!reg) {
          return {
            status: 401,
            body: { ok: false, error: 'That member session has no dashboard registration. Register first, then sign in with the same email.' }
          };
        }
        return issue(reg, ctx.cloudSync);
      }
      return { status: 401, body: { ok: false, error: PASSWORD_REQUIRED } };
    }

    if (!email) return { status: 400, body: { ok: false, error: 'Email required' } };
    try {
      await opts.members.login(email, password, ctx.ip || 'dashboard');
    } catch (error) {
      const status = error.status || 401;
      return {
        status,
        body: { ok: false, error: status === 429 ? error.message : PASSWORD_REJECTED }
      };
    }
    const reg = await registrationFor(email);
    if (!reg) return { status: 401, body: { ok: false, error: PASSWORD_REJECTED } };
    return issue(reg, ctx.cloudSync);
  }

  async function redeem(token, cloudSync) {
    const row = pending.get(hash(token));
    if (!row || row.used || now() > row.exp) {
      return { status: 401, body: { ok: false, error: 'That sign-in link is invalid or already used.' } };
    }
    row.used = true;
    const reg = await registrationFor(row.email);
    if (!reg) return { status: 401, body: { ok: false, error: 'That sign-in link is invalid or already used.' } };
    return issue(reg, cloudSync);
  }

  return { request, redeem };
}

module.exports = {
  createDashboardLink,
  GENERIC_MAGIC,
  PASSWORD_REQUIRED,
  SMTP_OFF
};
