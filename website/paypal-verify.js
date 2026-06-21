/**
 * Server-side PayPal order verification — never trust the browser alone.
 * Requires PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET in environment.
 */
const https = require('https');

const CLIENT_ID = String(process.env.PAYPAL_CLIENT_ID || '').trim();
const CLIENT_SECRET = String(process.env.PAYPAL_CLIENT_SECRET || '').trim();
const MODE = String(process.env.PAYPAL_MODE || 'sandbox').toLowerCase();

function apiHost() {
  return MODE === 'live' ? 'api-m.paypal.com' : 'api-m.sandbox.paypal.com';
}

function postForm(path, body, headers) {
  return new Promise((resolve, reject) => {
    const data = body;
    const req = https.request(
      {
        hostname: apiHost(),
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(data),
          ...headers
        }
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(raw) });
          } catch {
            reject(new Error('PayPal auth response invalid'));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJson(path, token) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: apiHost(),
        path,
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json'
        }
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(raw) });
          } catch {
            reject(new Error('PayPal order response invalid'));
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

let tokenCache = { value: '', expiresAt: 0 };

async function getAccessToken() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('PayPal not configured — set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET');
  }
  if (tokenCache.value && Date.now() < tokenCache.expiresAt - 60000) {
    return tokenCache.value;
  }
  const basic = Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64');
  const res = await postForm('/v1/oauth2/token', 'grant_type=client_credentials', {
    Authorization: 'Basic ' + basic
  });
  if (res.status !== 200 || !res.body.access_token) {
    throw new Error('PayPal authentication failed — check Client ID and Secret');
  }
  tokenCache = {
    value: res.body.access_token,
    expiresAt: Date.now() + (Number(res.body.expires_in) || 300) * 1000
  };
  return tokenCache.value;
}

/**
 * Verify a captured PayPal order matches expected amount (USD).
 * @returns {{ ok: true, payerEmail: string, status: string, amount: number }}
 */
async function verifyPaypalOrder(orderId, expectedAmountUsd) {
  const id = String(orderId || '').trim();
  if (!id || id.startsWith('manual_')) {
    throw new Error('Invalid PayPal order ID');
  }
  const token = await getAccessToken();
  const res = await getJson('/v2/checkout/orders/' + encodeURIComponent(id), token);
  if (res.status !== 200) {
    throw new Error('PayPal order not found or not accessible');
  }
  const order = res.body;
  const status = String(order.status || '');
  if (status !== 'COMPLETED' && status !== 'APPROVED') {
    throw new Error('PayPal payment not completed (status: ' + status + ')');
  }
  const unit = order.purchase_units && order.purchase_units[0];
  const capture = unit && unit.payments && unit.payments.captures && unit.payments.captures[0];
  const amountVal = capture
    ? Number(capture.amount && capture.amount.value)
    : Number(unit && unit.amount && unit.amount.value);
  const currency = capture
    ? String(capture.amount && capture.amount.currency_code || 'USD')
    : String(unit && unit.amount && unit.amount.currency_code || 'USD');
  if (currency !== 'USD') throw new Error('Unexpected PayPal currency');
  const expected = Number(expectedAmountUsd);
  if (!Number.isFinite(amountVal) || Math.abs(amountVal - expected) > 0.01) {
    throw new Error('PayPal amount does not match plan price');
  }
  const payerEmail =
    (order.payer && order.payer.email_address) ||
    (capture && capture.payee && capture.payee.email_address) ||
    '';
  return { ok: true, payerEmail, status, amount: amountVal };
}

function isConfigured() {
  return !!(CLIENT_ID && CLIENT_SECRET);
}

module.exports = { verifyPaypalOrder, isConfigured, getAccessToken };
