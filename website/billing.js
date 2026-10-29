'use strict';

const crypto = require('crypto');

const REQUIRED = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_PRO', 'STRIPE_PRICE_ELITE'];
const TOLERANCE_SEC = 300;

function stripeSettings(env) {
  const source = env || process.env;
  const secretKey = String(source.STRIPE_SECRET_KEY || '').trim();
  const webhookSecret = String(source.STRIPE_WEBHOOK_SECRET || '').trim();
  const pricePro = String(source.STRIPE_PRICE_PRO || '').trim();
  const priceElite = String(source.STRIPE_PRICE_ELITE || '').trim();
  return {
    enabled: !!(secretKey && webhookSecret && pricePro && priceElite),
    missing: REQUIRED.filter((key) => !String(source[key] || '').trim()),
    secretKey,
    webhookSecret,
    prices: { pro: pricePro, elite: priceElite }
  };
}

function signStripePayload(secret, timestamp, payload) {
  return crypto.createHmac('sha256', secret).update(String(timestamp) + '.' + payload).digest('hex');
}

function verifyStripeSignature(payload, header, secret, nowMs) {
  const raw = Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload || '');
  const given = String(header || '');
  if (!secret) return { ok: false, reason: 'Webhook secret is not configured.' };
  if (!given) return { ok: false, reason: 'Missing Stripe signature.' };
  const parts = {};
  given.split(',').forEach((piece) => {
    const eq = piece.indexOf('=');
    if (eq > 0) {
      const key = piece.slice(0, eq).trim();
      const value = piece.slice(eq + 1).trim();
      if (!parts[key]) parts[key] = [];
      parts[key].push(value);
    }
  });
  const timestamp = Number(parts.t && parts.t[0]);
  const signatures = parts.v1 || [];
  if (!Number.isFinite(timestamp) || !signatures.length) {
    return { ok: false, reason: 'Stripe signature is malformed.' };
  }
  const now = Math.floor((nowMs == null ? Date.now() : nowMs) / 1000);
  if (Math.abs(now - timestamp) > TOLERANCE_SEC) {
    return { ok: false, reason: 'Stripe signature is outside the time window.' };
  }
  const expected = signStripePayload(secret, timestamp, raw);
  const match = signatures.some((sig) => {
    const a = Buffer.from(expected);
    const b = Buffer.from(String(sig));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
  if (!match) return { ok: false, reason: 'Stripe signature does not match.' };
  return { ok: true };
}

async function applyBillingEvent(store, event) {
  if (!event || !event.id || !event.type) {
    const error = new Error('Stripe event is incomplete.');
    error.status = 400;
    throw error;
  }
  const claimed = await Promise.resolve(store.claimBillingEvent(event.id));
  if (!claimed) return { ok: true, duplicate: true };
  const object = event.data && event.data.object ? event.data.object : {};
  if (event.type === 'checkout.session.completed') {
    const tier = String(object.metadata && object.metadata.tier || '').toLowerCase();
    const email = String(object.customer_email || (object.customer_details && object.customer_details.email) || '').trim().toLowerCase();
    if ((tier === 'pro' || tier === 'elite') && email) {
      await Promise.resolve(store.setTier(email, tier));
      if (object.customer) await Promise.resolve(store.setStripeCustomer(email, object.customer));
      return { ok: true, tier, email };
    }
    return { ok: true, ignored: true };
  }
  if (event.type === 'customer.subscription.deleted') {
    const row = await Promise.resolve(store.findByStripeCustomer(object.customer));
    if (row) await Promise.resolve(store.setTier(row.email, 'free'));
    return { ok: true, tier: row ? 'free' : null };
  }
  return { ok: true, ignored: true };
}

async function handleWebhook(settings, payload, header, store, nowMs) {
  const check = verifyStripeSignature(payload, header, settings.webhookSecret, nowMs);
  if (!check.ok) {
    const error = new Error(check.reason);
    error.status = 400;
    throw error;
  }
  const raw = Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload || '');
  let event;
  try {
    event = JSON.parse(raw);
  } catch (error) {
    const invalid = new Error('Stripe event was not JSON.');
    invalid.status = 400;
    throw invalid;
  }
  return applyBillingEvent(store, event);
}

function stripeClient(settings, override) {
  if (override) return override;
  const stripe = require('stripe');
  return stripe(settings.secretKey);
}

async function createCheckoutSession(settings, member, tier, siteUrl, client) {
  if (!settings.enabled) {
    const error = new Error('Checkout is coming soon.');
    error.status = 503;
    throw error;
  }
  const plan = String(tier || '').toLowerCase();
  if (plan !== 'pro' && plan !== 'elite') {
    const error = new Error('Choose Pro or Elite.');
    error.status = 400;
    throw error;
  }
  if (!member || !member.email || !member.id) {
    const error = new Error('Sign in before checkout.');
    error.status = 401;
    throw error;
  }
  const origin = String(siteUrl || 'https://aurafxelite.com').replace(/\/$/, '');
  const stripe = stripeClient(settings, client);
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: member.email,
    client_reference_id: member.id,
    line_items: [{ price: settings.prices[plan], quantity: 1 }],
    metadata: { tier: plan, member_id: member.id },
    success_url: origin + '/members.html?billing=success',
    cancel_url: origin + '/pricing.html?billing=cancel',
    subscription_data: { metadata: { tier: plan, member_id: member.id } }
  });
  return { ok: true, url: session.url, id: session.id };
}

async function createPortalSession(settings, customerId, siteUrl, client) {
  if (!settings.enabled) {
    const error = new Error('Billing portal is coming soon.');
    error.status = 503;
    throw error;
  }
  if (!customerId) {
    const error = new Error('No Stripe subscription is linked to this account yet.');
    error.status = 404;
    throw error;
  }
  const origin = String(siteUrl || 'https://aurafxelite.com').replace(/\/$/, '');
  const stripe = stripeClient(settings, client);
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: origin + '/members.html'
  });
  return { ok: true, url: session.url };
}

module.exports = {
  REQUIRED,
  stripeSettings,
  signStripePayload,
  verifyStripeSignature,
  applyBillingEvent,
  handleWebhook,
  createCheckoutSession,
  createPortalSession
};
