'use strict';

const crypto = require('crypto');
const { INSTRUMENTS, loadAll } = require('./market-candles');
const analytics = require('./market-analytics');
const { createMembersStore, tierAllows, FEATURES } = require('./members-store');
const { DISCLAIMER } = require('./signal-math');
const { smtpSettings, telegramSettings } = require('./signal-alerts');
const chartMath = require('./chart-math');

const KNOWN = INSTRUMENTS.map((item) => item.id);
const googleStates = new Map();

function googleConfigured() {
  return !!(String(process.env.GOOGLE_CLIENT_ID || '').trim() && String(process.env.GOOGLE_CLIENT_SECRET || '').trim());
}

function channelStatus() {
  const mail = smtpSettings();
  const bot = telegramSettings();
  return {
    email: !!mail.configured,
    telegram: !!bot.configured,
    note: (!mail.configured || !bot.configured)
      ? 'A channel that is not configured is stored and reported as not configured. Nothing is marked sent.'
      : 'Email and Telegram are configured on this server.'
  };
}

function locked(feature) {
  return {
    locked: true,
    feature,
    note: 'This tool is locked on the current tier. The owner sets Free, Pro, or Elite in the members file. There is no payment checkout on the site.'
  };
}

function teaseSignals(signals) {
  return (signals || []).map((signal) => ({
    instrument: signal.instrument,
    name: signal.name,
    action: signal.action,
    regime: signal.regime,
    session: signal.session,
    confidence_basis: signal.confidence_basis || null,
    published: !!signal.published,
    levels_hidden: true
  }));
}

function candleMapFrom(loaded) {
  const map = {};
  (loaded || []).forEach((row) => {
    map[row.instrument.id] = row.h1 || [];
  });
  return map;
}

function evaluateAlerts(alerts, signals, channels) {
  return (alerts || []).map((alert) => {
    const signal = (signals || []).find((item) => item.instrument === alert.instrument);
    let triggered = false;
    let reason = 'Not triggered on this scan.';
    if (!signal || signal.price == null) {
      reason = 'That instrument has no live price on this scan.';
    } else if (alert.type === 'price') {
      const price = Number(signal.price);
      const level = Number(alert.price);
      if (alert.op === 'below' && price < level) {
        triggered = true;
        reason = signal.instrument + ' last price ' + price + ' is below ' + level + '.';
      } else if (alert.op !== 'below' && price > level) {
        triggered = true;
        reason = signal.instrument + ' last price ' + price + ' is above ' + level + '.';
      } else {
        reason = signal.instrument + ' last price is ' + price + '.';
      }
    } else if (alert.type === 'signal') {
      if (signal.action === 'BUY' || signal.action === 'SELL') {
        triggered = true;
        reason = signal.instrument + ' is ' + signal.action + ' on this scan.';
      } else {
        reason = signal.instrument + ' is Wait on this scan.';
      }
    } else if (alert.type === 'regime') {
      if (signal.regime && signal.regime === alert.regime) {
        triggered = true;
        reason = signal.instrument + ' regime is ' + signal.regime + '.';
      } else {
        reason = signal.instrument + ' regime is ' + (signal.regime || 'unset') + '.';
      }
    }
    const wantsEmail = alert.channel === 'email' || alert.channel === 'both';
    const wantsTelegram = alert.channel === 'telegram' || alert.channel === 'both';
    const missing = (wantsEmail && !channels.email) || (wantsTelegram && !channels.telegram);
    return Object.assign({}, alert, {
      triggered,
      reason,
      delivery: missing ? 'not_configured' : 'stored'
    });
  });
}

function createMemberDesk(options) {
  const opts = options || {};
  const store = opts.store || createMembersStore(opts.storeOptions || {});
  const signals = opts.signals;

  function secure(req) {
    const proto = String((req.headers && (req.headers['x-forwarded-proto'] || '')) || '');
    return proto === 'https' || process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
  }

  function member(req) {
    return store.memberFromRequest(req);
  }

  async function liveBoard(news) {
    if (!signals) throw new Error('Signal service unavailable');
    return signals.getBoard({ news: typeof news === 'function' ? news() : news });
  }

  async function candlesFor(id) {
    const instrument = INSTRUMENTS.find((item) => item.id === id);
    if (!instrument) return null;
    const loaded = await loadAll({ symbols: [id] });
    return loaded[0] || null;
  }

  async function workspace(req, news, calendarItems, windowMin) {
    const user = member(req);
    if (!user) {
      const error = new Error('Sign in to open the members area.');
      error.status = 401;
      throw error;
    }
    const board = await liveBoard(news);
    const delayed = signals.getDelayedBoard();
    const channels = channelStatus();
    const window = windowMin || { before: 30, after: 30 };
    const access = {};
    Object.keys(FEATURES).forEach((feature) => {
      access[feature] = tierAllows(user.tier, feature);
    });
    const payload = {
      ok: true,
      member: user,
      access,
      channels,
      disclaimer: DISCLAIMER,
      google: googleConfigured(),
      sessions: analytics.sessionsAt(new Date()),
      calendar: analytics.annotateCalendar(calendarItems || [], new Date(), window.before, window.after).slice(0, 40),
      news_window: window,
      delayed: delayed.ready ? Object.assign({}, delayed, {
        signals: (delayed.signals || []).map((signal) => ({
          instrument: signal.instrument,
          name: signal.name,
          action: signal.action,
          regime: signal.regime,
          session: signal.session,
          entry: signal.entry,
          stop_loss: signal.stop_loss,
          take_profit_1: signal.take_profit_1,
          take_profit_2: signal.take_profit_2,
          risk_reward: signal.risk_reward,
          confidence_basis: signal.confidence_basis || null
        }))
      }) : delayed,
      watchlist: user.watchlist
    };
    if (!access.live) payload.live = locked('live');
    else payload.live = { signals: board.signals, summary: board.summary, feed: board.feed, updated_at: board.updated_at };
    if (!access.scanner) {
      payload.scanner = locked('scanner');
      payload.strength = locked('strength');
      payload.correlation = locked('correlation');
      payload.volatility = locked('scanner');
    } else {
      const loaded = await loadAll();
      const map = candleMapFrom(loaded);
      payload.scanner = {
        rows: analytics.scannerRows(board.signals, map),
        basis: 'Trend, regime, RSI, ATR and 24-hour change come from the hourly candles on this scan.'
      };
      payload.strength = analytics.currencyStrength(map, 24);
      payload.correlation = analytics.correlationMatrix(map, KNOWN, 20);
      payload.volatility = {
        rows: analytics.volatilityRows(board.signals),
        basis: 'ATR versus its recent hourly average. This is a measurement, not a directional forecast.'
      };
    }
    payload.brief = access.brief ? { items: board.signals.map(analytics.briefFor) } : locked('brief');
    payload.history = access.history ? await signals.getTrackRecord({}) : locked('history');
    payload.plans = access.plans ? signals.getPlans(board) : locked('plans');
    payload.journal = access.journal ? user.journal : locked('journal');
    payload.position = access.position ? { enabled: true } : locked('position');
    payload.alerts = access.alerts
      ? { items: evaluateAlerts(user.alerts, board.signals, channels), channels }
      : locked('alerts');
    payload.teaser = teaseSignals(board.signals);
    return payload;
  }

  async function handle(req, res, ctx) {
    const url = ctx.url;
    if (!url.startsWith('/api/members')) return false;
    const json = ctx.json;
    const readBody = ctx.readBody;
    try {
      if (url === '/api/members/options' && req.method === 'GET') {
        json(res, 200, {
          ok: true,
          google: googleConfigured(),
          disclaimer: DISCLAIMER,
          contact: 'support@aurafxelite.com'
        });
        return true;
      }
      if (url === '/api/members/register' && req.method === 'POST') {
        const body = await readBody(req);
        const user = store.register(body);
        res.setHeader('Set-Cookie', store.sessionCookie(user, secure(req)));
        json(res, 200, { ok: true, member: user, disclaimer: DISCLAIMER });
        return true;
      }
      if (url === '/api/members/login' && req.method === 'POST') {
        const body = await readBody(req);
        const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown');
        const user = store.login(body.email, body.password, String(ip).split(',')[0]);
        res.setHeader('Set-Cookie', store.sessionCookie(user, secure(req)));
        json(res, 200, { ok: true, member: user });
        return true;
      }
      if (url === '/api/members/logout' && req.method === 'POST') {
        res.setHeader('Set-Cookie', store.clearCookie(secure(req)));
        json(res, 200, { ok: true });
        return true;
      }
      if (url === '/api/members/me' && req.method === 'GET') {
        const user = member(req);
        json(res, 200, { ok: !!user, member: user, google: googleConfigured() });
        return true;
      }
      if (url === '/api/members/google' && req.method === 'GET') {
        if (!googleConfigured()) {
          json(res, 404, { ok: false, error: 'Google sign-in is not configured on this server.' });
          return true;
        }
        const state = crypto.randomBytes(16).toString('hex');
        googleStates.set(state, Date.now() + 10 * 60 * 1000);
        const redirect = encodeURIComponent((process.env.SITE_URL || 'http://127.0.0.1:3847') + '/api/members/google/callback');
        const auth = 'https://accounts.google.com/o/oauth2/v2/auth?response_type=code&scope=openid%20email%20profile&client_id=' +
          encodeURIComponent(process.env.GOOGLE_CLIENT_ID) + '&redirect_uri=' + redirect + '&state=' + state;
        res.writeHead(302, { Location: auth });
        res.end();
        return true;
      }
      if (url === '/api/members/google/callback' && req.method === 'GET') {
        if (!googleConfigured()) {
          json(res, 404, { ok: false, error: 'Google sign-in is not configured on this server.' });
          return true;
        }
        const params = new URLSearchParams(ctx.rawUrl.includes('?') ? ctx.rawUrl.split('?')[1] : '');
        const state = params.get('state') || '';
        const exp = googleStates.get(state);
        googleStates.delete(state);
        if (!exp || Date.now() > exp) {
          json(res, 400, { ok: false, error: 'Google sign-in expired. Try again.' });
          return true;
        }
        const redirect = (process.env.SITE_URL || 'http://127.0.0.1:3847') + '/api/members/google/callback';
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code: params.get('code') || '',
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: redirect,
            grant_type: 'authorization_code'
          })
        });
        if (!tokenRes.ok) {
          json(res, 502, { ok: false, error: 'Google did not complete sign-in.' });
          return true;
        }
        const token = await tokenRes.json();
        const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
          headers: { Authorization: 'Bearer ' + token.access_token }
        });
        if (!infoRes.ok) {
          json(res, 502, { ok: false, error: 'Google did not return a profile.' });
          return true;
        }
        const profile = await infoRes.json();
        const user = store.loginGoogle(profile);
        res.setHeader('Set-Cookie', store.sessionCookie(user, secure(req)));
        res.writeHead(302, { Location: '/members.html' });
        res.end();
        return true;
      }
      if (url === '/api/members/workspace' && req.method === 'GET') {
        const window = ctx.newsWindow ? ctx.newsWindow() : { before: 30, after: 30 };
        const calendar = ctx.calendar ? ctx.calendar() : [];
        const payload = await workspace(req, ctx.news, calendar, window);
        json(res, 200, payload);
        return true;
      }
      if (url === '/api/members/candles' && req.method === 'GET') {
        const user = member(req);
        if (!user) {
          json(res, 401, { ok: false, error: 'Sign in to open charts.' });
          return true;
        }
        if (!tierAllows(user.tier, 'charts')) {
          json(res, 403, locked('charts'));
          return true;
        }
        const params = new URLSearchParams(ctx.rawUrl.includes('?') ? ctx.rawUrl.split('?')[1] : '');
        const id = String(params.get('instrument') || '').toUpperCase();
        const timeframe = String(params.get('timeframe') || 'H1').toUpperCase();
        if (!KNOWN.includes(id)) {
          json(res, 400, { ok: false, instrument: id, bars: [], note: 'Unknown instrument.' });
          return true;
        }
        if (timeframe === 'M15') {
          const missing = chartMath.candleView(null, 'M15');
          json(res, 200, Object.assign({ instrument: id, overlays: [], signal: null }, missing));
          return true;
        }
        const row = await candlesFor(id);
        const view = chartMath.candleView(row || {}, timeframe);
        const board = view.available ? await liveBoard(ctx.news) : null;
        const signal = board ? ((board.signals || []).find((item) => item.instrument === id) || null) : null;
        json(res, 200, Object.assign({
          instrument: id,
          source: row && row.source || null,
          stale: !!(row && row.stale),
          overlays: view.available ? analytics.chartOverlays(signal) : [],
          signal: signal ? {
            action: signal.action,
            regime: signal.regime,
            support: signal.support,
            resistance: signal.resistance,
            timeframe: 'H1'
          } : null
        }, view));
        return true;
      }
      if (url === '/api/members/chart-layout' && req.method === 'GET') {
        const user = member(req);
        if (!user) {
          json(res, 401, { ok: false, error: 'Sign in to open a chart layout.' });
          return true;
        }
        if (!tierAllows(user.tier, 'charts')) {
          json(res, 403, locked('charts'));
          return true;
        }
        json(res, 200, { ok: true, desk: store.getChartDesk(user.id) });
        return true;
      }
      if (url === '/api/members/chart-layout' && req.method === 'POST') {
        const user = member(req);
        if (!user) {
          json(res, 401, { ok: false, error: 'Sign in to save a chart layout.' });
          return true;
        }
        if (!tierAllows(user.tier, 'charts')) {
          json(res, 403, locked('charts'));
          return true;
        }
        const body = await readBody(req);
        const desk = store.updateChartDesk(user.id, body && body.desk, KNOWN);
        json(res, 200, { ok: true, desk });
        return true;
      }
      if (url === '/api/members/ask' && req.method === 'POST') {
        const user = member(req);
        if (!user) {
          json(res, 401, { ok: false, error: 'Sign in to use the analyst.' });
          return true;
        }
        if (!tierAllows(user.tier, 'analyst')) {
          json(res, 403, locked('analyst'));
          return true;
        }
        const body = await readBody(req);
        const result = await signals.ask(body && body.question, { news: typeof ctx.news === 'function' ? ctx.news() : ctx.news });
        json(res, result.ok === false ? 400 : 200, result);
        return true;
      }
      if (url === '/api/members/watchlist' && req.method === 'POST') {
        const user = member(req);
        if (!user) {
          json(res, 401, { ok: false, error: 'Sign in to save a watchlist.' });
          return true;
        }
        const body = await readBody(req);
        const next = store.updateWatchlist(user.id, body.instruments, KNOWN);
        json(res, 200, { ok: true, watchlist: next.watchlist });
        return true;
      }
      if (url === '/api/members/alerts' && req.method === 'POST') {
        const user = member(req);
        if (!user) {
          json(res, 401, { ok: false, error: 'Sign in to save alerts.' });
          return true;
        }
        if (!tierAllows(user.tier, 'alerts')) {
          json(res, 403, locked('alerts'));
          return true;
        }
        const body = await readBody(req);
        const next = store.updateAlerts(user.id, body.alerts);
        const board = await liveBoard(ctx.news);
        json(res, 200, { ok: true, alerts: evaluateAlerts(next.alerts, board.signals, channelStatus()), channels: channelStatus() });
        return true;
      }
      if (url === '/api/members/journal' && req.method === 'POST') {
        const user = member(req);
        if (!user) {
          json(res, 401, { ok: false, error: 'Sign in to save a journal.' });
          return true;
        }
        if (!tierAllows(user.tier, 'journal')) {
          json(res, 403, locked('journal'));
          return true;
        }
        const body = await readBody(req);
        const next = store.updateJournal(user.id, body.entries);
        json(res, 200, { ok: true, journal: next.journal });
        return true;
      }
      if (url === '/api/members/history' && req.method === 'GET') {
        const user = member(req);
        if (!user) {
          json(res, 401, { ok: false, error: 'Sign in to open signal history.' });
          return true;
        }
        if (!tierAllows(user.tier, 'history')) {
          json(res, 403, locked('history'));
          return true;
        }
        const params = new URLSearchParams(ctx.rawUrl.includes('?') ? ctx.rawUrl.split('?')[1] : '');
        const record = await signals.getTrackRecord({
          instrument: params.get('instrument') || '',
          month: params.get('month') || '',
          session: params.get('session') || ''
        });
        json(res, 200, record);
        return true;
      }
      json(res, 404, { ok: false, error: 'Unknown members route.' });
      return true;
    } catch (error) {
      json(res, error.status || 500, { ok: false, error: error.message || 'Members request failed' });
      return true;
    }
  }

  return { handle, store, workspace, evaluateAlerts };
}

module.exports = { createMemberDesk, evaluateAlerts, teaseSignals, channelStatus };
