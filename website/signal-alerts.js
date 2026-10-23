'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const net = require('net');
const tls = require('tls');
const { DISCLAIMER } = require('./signal-math');

const DEFAULT_FILE = path.join(__dirname, 'data', 'signal-alerts.json');
const SITE_URL = () => String(process.env.SITE_URL || 'https://aurafxelite.com').replace(/\/$/, '');

function smtpSettings() {
  const host = String(process.env.SMTP_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '');
  const from = String(process.env.SMTP_FROM || process.env.EMAIL_FROM || '').trim();
  return {
    configured: !!(host && from),
    host,
    port: Number.isFinite(port) ? port : 587,
    user,
    pass,
    from
  };
}

function telegramSettings() {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  return { configured: !!token, token };
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function validChatId(value) {
  return /^-?\d{5,20}$/.test(String(value || '').trim());
}

function formatAlert(event) {
  const signal = event.signal || {};
  const kind = event.type === 'published'
    ? 'Signal published'
    : event.type === 'tp'
      ? 'Take-profit hit'
      : event.type === 'sl'
        ? 'Stop hit'
        : 'Signal update';
  const lines = [
    'AuraFX Elite — ' + kind,
    (signal.name || signal.instrument || 'Instrument') + ' ' + (signal.action || ''),
    'Entry ' + (signal.entry == null ? '—' : signal.entry),
    'Stop ' + (signal.stop_loss == null ? '—' : signal.stop_loss),
    'Target ' + (signal.take_profit_1 == null ? '—' : signal.take_profit_1)
  ];
  if (event.type === 'published') {
    lines.push('Confidence ' + (signal.confidence == null ? '—' : signal.confidence) + ' is setup quality, not a predicted win rate.');
  } else {
    lines.push('Result ' + (signal.result_r == null ? '—' : signal.result_r + 'R') + ' on the logged signal.');
  }
  lines.push('Opened ' + (signal.opened_at || '—'));
  if (signal.closed_at) lines.push('Closed ' + signal.closed_at);
  lines.push('Analysis only. Nothing was sent to a broker.');
  lines.push(DISCLAIMER);
  lines.push('Measured record: ' + SITE_URL() + '/track-record.html');
  return lines.join('\n');
}

function takeReply(buffer) {
  const parts = buffer.split('\r\n');
  let end = -1;
  for (let i = 0; i < parts.length - 1; i++) {
    if (/^\d{3} /.test(parts[i])) end = i;
  }
  if (end < 0) return null;
  const used = parts.slice(0, end + 1);
  return {
    code: Number(used[end].slice(0, 3)),
    lines: used,
    rest: parts.slice(end + 1).join('\r\n')
  };
}

function smtpRead(socket, state) {
  const ready = takeReply(state.buffer);
  if (ready) {
    state.buffer = ready.rest;
    return Promise.resolve(ready);
  }
  return new Promise((resolve, reject) => {
    const onData = (chunk) => {
      state.buffer += chunk.toString('utf8');
      const parsed = takeReply(state.buffer);
      if (!parsed) return;
      state.buffer = parsed.rest;
      socket.off('data', onData);
      socket.off('error', onError);
      resolve(parsed);
    };
    const onError = (error) => {
      socket.off('data', onData);
      reject(error);
    };
    socket.on('data', onData);
    socket.on('error', onError);
  });
}

function smtpWrite(socket, line) {
  socket.write(line + '\r\n');
}

async function expectCode(socket, state, ok) {
  const reply = await smtpRead(socket, state);
  if (!ok.includes(reply.code)) {
    const error = new Error('SMTP ' + reply.code);
    error.hard = true;
    throw error;
  }
  return reply;
}

async function smtpConversation(socket, message, auth, flags) {
  const state = { buffer: '' };
  if (!flags || !flags.greeted) await expectCode(socket, state, [220]);
  smtpWrite(socket, 'EHLO aurafxelite.com');
  await expectCode(socket, state, [250]);
  if (auth && auth.user) {
    smtpWrite(socket, 'AUTH LOGIN');
    await expectCode(socket, state, [334]);
    smtpWrite(socket, Buffer.from(auth.user).toString('base64'));
    await expectCode(socket, state, [334]);
    smtpWrite(socket, Buffer.from(auth.pass || '').toString('base64'));
    await expectCode(socket, state, [235]);
  }
  smtpWrite(socket, 'MAIL FROM:<' + message.from + '>');
  await expectCode(socket, state, [250]);
  smtpWrite(socket, 'RCPT TO:<' + message.to + '>');
  await expectCode(socket, state, [250, 251]);
  smtpWrite(socket, 'DATA');
  await expectCode(socket, state, [354]);
  const body = String(message.text || '').replace(/^\./gm, '..');
  socket.write(
    'From: ' + message.from + '\r\n' +
    'To: ' + message.to + '\r\n' +
    'Subject: ' + message.subject + '\r\n' +
    'MIME-Version: 1.0\r\n' +
    'Content-Type: text/plain; charset=utf-8\r\n' +
    '\r\n' +
    body + '\r\n.\r\n'
  );
  await expectCode(socket, state, [250]);
  smtpWrite(socket, 'QUIT');
}

function openSmtpSocket(settings, mode) {
  return new Promise((resolve, reject) => {
    if (mode === 'tls') {
      const socket = tls.connect({
        host: settings.host,
        port: settings.port,
        servername: settings.host
      }, () => resolve(socket));
      socket.once('error', reject);
      return;
    }
    const socket = net.connect({ host: settings.host, port: settings.port }, () => resolve(socket));
    socket.once('error', reject);
  });
}

async function upgradeStartTls(socket, host) {
  return new Promise((resolve, reject) => {
    socket.write('STARTTLS\r\n');
    let buffer = '';
    const onData = (chunk) => {
      buffer += chunk.toString('utf8');
      const parsed = takeReply(buffer);
      if (!parsed) return;
      socket.off('data', onData);
      if (parsed.code !== 220) {
        reject(new Error('SMTP STARTTLS ' + parsed.code));
        return;
      }
      const secure = tls.connect({ socket, servername: host }, () => resolve(secure));
      secure.once('error', reject);
    };
    socket.on('data', onData);
  });
}

async function deliverSmtp(message, options) {
  const settings = options || smtpSettings();
  const mode = options && options.mode
    ? options.mode
    : (Number(settings.port) === 465 ? 'tls' : 'starttls');
  let socket = await openSmtpSocket(settings, mode === 'tls' ? 'tls' : 'plain');
  socket.setTimeout(12000, () => socket.destroy(new Error('SMTP timeout')));
  if (mode === 'starttls') {
    const state = { buffer: '' };
    await expectCode(socket, state, [220]);
    smtpWrite(socket, 'EHLO aurafxelite.com');
    await expectCode(socket, state, [250]);
    socket = await upgradeStartTls(socket, settings.host);
    await smtpConversation(socket, message, { user: settings.user, pass: settings.pass }, { greeted: true });
  } else {
    await smtpConversation(socket, message, { user: settings.user, pass: settings.pass });
  }
  socket.end();
}

async function deliverTelegram(chatId, text, fetchImpl) {
  const token = telegramSettings().token;
  if (!token) throw new Error('Telegram bot token is not set');
  const fetchFn = fetchImpl || global.fetch;
  const response = await fetchFn('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true })
  });
  if (!response.ok) throw new Error('Telegram request failed');
  return response;
}

function createAlerts(options) {
  const opts = options || {};
  const file = opts.file || DEFAULT_FILE;
  let subs = [];
  let sent = [];
  let loaded = false;
  let neonDisabled = !process.env.DATABASE_URL || opts.disableNeon === true;

  function readStore() {
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      return {
        subscriptions: Array.isArray(raw.subscriptions) ? raw.subscriptions : [],
        sent: Array.isArray(raw.sent) ? raw.sent : []
      };
    } catch {
      return { subscriptions: [], sent: [] };
    }
  }

  async function writeStore() {
    if (opts.persist === false) return;
    const payload = { subscriptions: subs, sent: sent.slice(-2000) };
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(payload));
    fs.renameSync(tmp, file);
    if (neonDisabled) return;
    try {
      const { neon } = require('@neondatabase/serverless');
      const sql = neon(process.env.DATABASE_URL);
      await sql`
        INSERT INTO aura_signal_alerts (id, payload)
        VALUES ('store', ${JSON.stringify(payload)}::jsonb)
        ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload
      `;
    } catch (error) {
      neonDisabled = true;
      console.warn('[AuraFX] signal alert file fallback:', error.message);
    }
  }

  async function ready() {
    if (loaded) return;
    loaded = true;
    const stored = readStore();
    subs = stored.subscriptions.slice(-200);
    sent = stored.sent.slice(-2000);
    if (neonDisabled) return;
    try {
      const { neon } = require('@neondatabase/serverless');
      const sql = neon(process.env.DATABASE_URL);
      await sql`
        CREATE TABLE IF NOT EXISTS aura_signal_alerts (
          id TEXT PRIMARY KEY,
          payload JSONB NOT NULL
        )
      `;
      const found = await sql`SELECT payload FROM aura_signal_alerts WHERE id = 'store' LIMIT 1`;
      const row = found && found[0];
      const payload = row && (typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload);
      if (payload && Array.isArray(payload.subscriptions) && payload.subscriptions.length) {
        subs = payload.subscriptions.slice(-200);
        sent = Array.isArray(payload.sent) ? payload.sent.slice(-2000) : sent;
      }
    } catch (error) {
      neonDisabled = true;
      console.warn('[AuraFX] signal alert file fallback:', error.message);
    }
  }

  function status() {
    const mail = opts.smtp || smtpSettings();
    const bot = opts.telegram || telegramSettings();
    return {
      email: !!mail.configured,
      telegram: !!bot.configured,
      disclaimer: DISCLAIMER
    };
  }

  async function subscribe(body) {
    await ready();
    const input = body || {};
    if (input.consent !== true) {
      const error = new Error('Consent is required before alerts are saved.');
      error.status = 400;
      throw error;
    }
    const email = String(input.email || '').trim().toLowerCase();
    const chatId = String(input.telegram_chat_id || '').trim();
    if (email && !validEmail(email)) {
      const error = new Error('Enter a valid email address.');
      error.status = 400;
      throw error;
    }
    if (chatId && !validChatId(chatId)) {
      const error = new Error('Telegram chat id should be the numeric id from the bot.');
      error.status = 400;
      throw error;
    }
    if (!email && !chatId) {
      const error = new Error('Add an email address or a Telegram chat id.');
      error.status = 400;
      throw error;
    }
    const channels = status();
    if (email && !channels.email) {
      const error = new Error('Email alerts need SMTP_HOST and SMTP_FROM on the server.');
      error.status = 503;
      throw error;
    }
    if (chatId && !channels.telegram) {
      const error = new Error('Telegram alerts need TELEGRAM_BOT_TOKEN on the server.');
      error.status = 503;
      throw error;
    }
    const instruments = Array.isArray(input.instruments)
      ? input.instruments.map((id) => String(id || '').toUpperCase()).filter(Boolean).slice(0, 20)
      : [];
    let row = subs.find((item) => (email && item.email === email) || (chatId && item.telegram_chat_id === chatId));
    if (!row) {
      row = { id: crypto.randomBytes(8).toString('hex'), token: crypto.randomBytes(16).toString('hex'), created_at: new Date().toISOString() };
      subs.push(row);
    }
    row.email = email || '';
    row.telegram_chat_id = chatId || '';
    row.instruments = instruments;
    row.notify_publish = input.notify_publish !== false;
    row.notify_close = input.notify_close !== false;
    row.updated_at = new Date().toISOString();
    subs = subs.slice(-200);
    await writeStore();
    return {
      ok: true,
      id: row.id,
      token: row.token,
      email: !!row.email,
      telegram: !!row.telegram_chat_id,
      unsubscribe_path: '/track-record.html?unsubscribe=' + row.token
    };
  }

  async function unsubscribe(token) {
    await ready();
    const key = String(token || '');
    const before = subs.length;
    subs = subs.filter((item) => item.token !== key);
    if (subs.length === before) {
      const error = new Error('That unsubscribe link is not active.');
      error.status = 404;
      throw error;
    }
    await writeStore();
    return { ok: true };
  }

  async function sendOne(sub, event) {
    const text = formatAlert(event);
    const subject = 'AuraFX Elite — ' + (event.type === 'published' ? 'signal published' : event.type === 'tp' ? 'take-profit hit' : 'stop hit');
    if (sub.email) {
      const message = { from: (opts.smtp || smtpSettings()).from, to: sub.email, subject, text: text + '\n\nUnsubscribe: ' + SITE_URL() + '/track-record.html?unsubscribe=' + sub.token };
      if (opts.deliverEmail) await opts.deliverEmail(message);
      else await deliverSmtp(message, opts.smtp || smtpSettings());
    }
    if (sub.telegram_chat_id) {
      if (opts.deliverTelegram) await opts.deliverTelegram(sub.telegram_chat_id, text);
      else await deliverTelegram(sub.telegram_chat_id, text, opts.fetchImpl);
    }
  }

  async function dispatch(events) {
    await ready();
    const list = Array.isArray(events) ? events : [];
    let delivered = 0;
    for (const event of list) {
      if (!event || !event.signal || !event.signal.id) continue;
      if (event.type !== 'published' && event.type !== 'tp' && event.type !== 'sl') continue;
      for (const sub of subs) {
        const key = sub.id + ':' + event.signal.id + ':' + event.type;
        if (sent.includes(key)) continue;
        if (event.type === 'published' && sub.notify_publish === false) continue;
        if (event.type !== 'published' && sub.notify_close === false) continue;
        if (sub.instruments && sub.instruments.length && !sub.instruments.includes(event.signal.instrument)) continue;
        try {
          await sendOne(sub, event);
          sent.push(key);
          delivered += 1;
        } catch (error) {
          console.warn('[AuraFX] signal alert skipped:', error.message);
        }
      }
    }
    if (delivered) await writeStore();
    return { delivered };
  }

  return { ready, status, subscribe, unsubscribe, dispatch, formatAlert };
}

module.exports = {
  createAlerts,
  formatAlert,
  deliverSmtp,
  smtpConversation,
  smtpSettings,
  telegramSettings,
  validEmail,
  validChatId,
  DEFAULT_FILE
};
