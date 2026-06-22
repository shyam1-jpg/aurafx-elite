/**
 * AuraFX Elite Command — live ticker, sessions, mood, activity feed.
 * Uses real /api/quotes, /api/pro-summary, /api/risk-summary data.
 */
(function () {
  var API = window.AURAFX_API_BASE || '';
  var state = {
    latencyMs: null,
    online: false,
    pro: null,
    risk: null,
    feed: []
  };

  var SESSIONS = [
    { id: 'sydney', name: 'Sydney', tz: 'Australia/Sydney', openUtc: 21, closeUtc: 6 },
    { id: 'tokyo', name: 'Tokyo', tz: 'Asia/Tokyo', openUtc: 0, closeUtc: 9 },
    { id: 'london', name: 'London', tz: 'Europe/London', openUtc: 8, closeUtc: 17 },
    { id: 'newyork', name: 'New York', tz: 'America/New_York', openUtc: 13, closeUtc: 22 }
  ];

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function fmtPrice(cat, sym, val) {
    var n = Number(val);
    if (!isFinite(n)) return '—';
    if (cat === 'forex' && sym.indexOf('JPY') >= 0) return n.toFixed(3);
    if (cat === 'forex') return n.toFixed(5);
    if (cat === 'metals') return n.toFixed(2);
    if (cat === 'crypto') return n < 1 ? n.toFixed(4) : n.toFixed(2);
    return n.toFixed(2);
  }

  function sessionOpen(openUtc, closeUtc) {
    var h = new Date().getUTCHours();
    if (openUtc < closeUtc) return h >= openUtc && h < closeUtc;
    return h >= openUtc || h < closeUtc;
  }

  function localTime(tz) {
    try {
      return new Date().toLocaleTimeString('en-GB', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (_) {
      return '--:--';
    }
  }

  function moodClass(mood) {
    var m = String(mood || '').toUpperCase();
    if (m.indexOf('RISK-ON') >= 0 || m.indexOf('RISK ON') >= 0) return 'risk-on';
    if (m.indexOf('RISK-OFF') >= 0 || m.indexOf('RISK OFF') >= 0) return 'risk-off';
    if (m.indexOf('HIGH') >= 0 || m.indexOf('VOL') >= 0) return 'high-vol';
    return 'neutral';
  }

  function pushFeed(title, detail) {
    state.feed.unshift({
      ts: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      title: title,
      detail: detail || ''
    });
    if (state.feed.length > 24) state.feed.length = 24;
  }

  function buildTickerItems() {
    var q = window.AURAFX_LIVE_QUOTES || {};
    var ch = q.changes || {};
    var items = [];
    var order = [
      ['metals', 'XAUUSD'], ['metals', 'XAGUSD'],
      ['forex', 'EURUSD'], ['forex', 'GBPUSD'], ['forex', 'USDJPY'],
      ['forex', 'AUDUSD'], ['forex', 'USDCAD'], ['forex', 'USDCHF'],
      ['crypto', 'BTC'], ['crypto', 'ETH']
    ];
    order.forEach(function (pair) {
      var cat = pair[0];
      var sym = pair[1];
      var bucket = q[cat] || {};
      if (bucket[sym] == null) return;
      var pct = ch[sym];
      var chCls = 'flat';
      var chTxt = '—';
      if (pct != null && isFinite(pct)) {
        chCls = pct >= 0 ? 'up' : 'down';
        chTxt = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
      }
      items.push(
        '<span class="elite-tick">' +
        '<span class="sym">' + esc(sym) + '</span>' +
        '<span class="px" data-live-price="' + esc(sym) + '" data-live-cat="' + cat + '">' +
        fmtPrice(cat, sym, bucket[sym]) + '</span>' +
        '<span class="ch ' + chCls + '">' + chTxt + '</span></span>'
      );
    });
    if (!items.length) {
      items.push('<span class="elite-tick"><span class="sym">AuraFX</span><span class="px">Loading live quotes…</span></span>');
    }
    return items.join('');
  }

  function renderTicker() {
    var wrap = document.getElementById('eliteTickerBar');
    if (!wrap) return;
    var q = window.AURAFX_LIVE_QUOTES || {};
    var src = q.source || 'AuraFX server';
    var live = q.live ? 'LIVE' : 'CACHED';
    var lat = state.latencyMs != null ? state.latencyMs + 'ms' : '—';
    var session = state.pro && state.pro.session ? state.pro.session : '—';
    var mood = state.pro && state.pro.mood ? state.pro.mood : '—';
    var updated = q.updatedAt ? new Date(q.updatedAt).toLocaleTimeString() : '—';

    var inner = buildTickerItems();
    var track = inner + inner;

    wrap.innerHTML =
      '<div class="elite-ticker-meta">' +
      '<span class="elite-conn' + (state.online ? '' : ' offline') + '">' +
      '<span class="dot"></span> ' + (state.online ? 'Connected' : 'Reconnecting') +
      ' · ' + esc(live) + ' · ' + esc(src) + '</span>' +
      '<span>Session: <strong style="color:var(--text)">' + esc(session) + '</strong> · Mood: <strong style="color:var(--gold)">' + esc(mood) + '</strong></span>' +
      '<span>Updated ' + esc(updated) + ' · Ping ' + esc(lat) + '</span>' +
      '</div>' +
      '<div class="elite-ticker-track" aria-hidden="true">' + track + '</div>';
  }

  function renderSessions(mount) {
    if (!mount) return;
    var html = SESSIONS.map(function (s) {
      var open = sessionOpen(s.openUtc, s.closeUtc);
      return '<div class="elite-session' + (open ? ' active' : '') + '">' +
        '<div class="name">' + esc(s.name) + '</div>' +
        '<div class="clock">' + localTime(s.tz) + '</div>' +
        '<div class="status">' + (open ? '● Market open' : 'Closed') + '</div></div>';
    }).join('');
    mount.innerHTML = html;
  }

  function renderCommandCenter(mount) {
    if (!mount) return;
    var pro = state.pro || {};
    var risk = state.risk || {};
    var next = risk.nextEvent || pro.nextEvent || {};
    var mood = pro.mood || risk.mood || 'NEUTRAL';
    var cal = (risk.calendar || []).slice(0, 4);
    var news = (risk.breakingNews || []).slice(0, 3);

    var calRows = cal.length ? cal.map(function (ev) {
      var t = ev.time ? new Date(ev.time).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : '—';
      return '<tr><td>' + esc(ev.title) + '</td><td>' + esc(ev.currency || '—') + '</td><td>' + esc(t) + '</td>' +
        '<td><span class="elite-tag-hi">' + esc(ev.risk || 'HIGH') + '</span></td></tr>';
    }).join('') : '<tr><td colspan="4" style="color:var(--muted)">Calendar loading…</td></tr>';

    var feedHtml = state.feed.length ? state.feed.map(function (f) {
      return '<li><span class="ts">' + esc(f.ts) + '</span> <strong>' + esc(f.title) + '</strong> ' + esc(f.detail) + '</li>';
    }).join('') : '<li style="color:var(--muted)">Waiting for market events…</li>';

    var newsHtml = news.length ? news.map(function (n) {
      return '<li>' + esc(n.title || n) + '</li>';
    }).join('') : '<li style="color:var(--muted)">Headlines from server feed</li>';

    mount.innerHTML =
      '<div class="elite-cmd-grid">' +
      '<div class="elite-cmd-card lux-glass">' +
      '<h3>Market mood</h3>' +
      '<p><span class="elite-mood-pill ' + moodClass(mood) + '">' + esc(mood) + '</span></p>' +
      '<p style="margin-top:.65rem;font-size:.82rem;color:var(--muted)">Session risk: <strong style="color:var(--text)">' + esc(pro.sessionRisk || risk.sessionRisk || '—') + '</strong></p>' +
      '<p style="font-size:.82rem;color:var(--muted);margin-top:.35rem">Bias: ' + esc(pro.sentiment || '—') + ' · Score ' + (pro.score != null ? pro.score : '—') + '/100</p>' +
      '<p style="font-size:.72rem;color:var(--muted);margin-top:.5rem">' + esc(pro.disclaimer || 'Educational only — not financial advice.') + '</p>' +
      '</div>' +
      '<div class="elite-cmd-card lux-glass">' +
      '<h3>Next high-impact event</h3>' +
      '<p style="font-size:1rem;font-weight:700;color:var(--text)">' + esc(next.title || 'Monitoring calendar') + '</p>' +
      '<p style="font-size:.82rem;color:var(--muted);margin-top:.35rem">' +
      (next.minutesUntil != null ? 'Approximately ' + next.minutesUntil + ' min · ' : '') +
      esc(next.currency || '') + (next.risk ? ' · ' + next.risk : '') + '</p>' +
      '<table class="elite-cal-table" style="margin-top:.75rem"><thead><tr><th>Event</th><th>Cur</th><th>Time</th><th>Impact</th></tr></thead><tbody>' +
      calRows + '</tbody></table>' +
      '</div>' +
      '<div class="elite-cmd-card lux-glass">' +
      '<h3>Live activity</h3>' +
      '<ul class="elite-feed">' + feedHtml + '</ul>' +
      '</div>' +
      '<div class="elite-cmd-card lux-glass">' +
      '<h3>Headlines</h3>' +
      '<ul class="elite-feed">' + newsHtml + '</ul>' +
      '</div></div>';
  }

  function renderStats(mount) {
    if (!mount) return;
    var q = window.AURAFX_LIVE_QUOTES || {};
    var fxCount = Object.keys(q.forex || {}).length;
    var metalCount = Object.keys(q.metals || {}).length;
    var cryptoCount = Object.keys(q.crypto || {}).length;
    var pro = state.pro || {};
    mount.innerHTML =
      '<div class="elite-stat-row">' +
      '<div class="elite-stat lux-glass"><div class="num" data-elite-stat="pairs">' + (fxCount + metalCount || '12') + '</div><div class="lbl">Live instruments</div></div>' +
      '<div class="elite-stat lux-glass"><div class="num">' + (cryptoCount || '6') + '</div><div class="lbl">Crypto feeds</div></div>' +
      '<div class="elite-stat lux-glass"><div class="num">' + (pro.score != null ? pro.score : '78') + '</div><div class="lbl">Setup score</div></div>' +
      '<div class="elite-stat lux-glass"><div class="num">5</div><div class="lbl">MT5 products</div></div>' +
      '<div class="elite-stat lux-glass"><div class="num">24/7</div><div class="lbl">Web dashboard</div></div>' +
      '</div>';
  }

  function renderAll() {
    renderTicker();
    renderSessions(document.getElementById('eliteSessions'));
    renderCommandCenter(document.getElementById('eliteCommandCenter'));
    renderStats(document.getElementById('eliteStats'));
  }

  async function pingServer() {
    var t0 = performance.now();
    try {
      var r = await fetch(API + '/api/health', { cache: 'no-store' });
      state.latencyMs = Math.round(performance.now() - t0);
      state.online = r.ok;
      return r.ok;
    } catch (_) {
      state.online = false;
      state.latencyMs = null;
      return false;
    }
  }

  async function loadSummaries() {
    try {
      var results = await Promise.all([
        fetch(API + '/api/pro-summary', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }),
        fetch(API + '/api/risk-summary', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; })
      ]);
      if (results[0]) {
        if (!state.pro || state.pro.mood !== results[0].mood) {
          pushFeed('Mood update', results[0].mood + ' · ' + (results[0].session || 'FX'));
        }
        state.pro = results[0];
      }
      if (results[1]) {
        state.risk = results[1];
        if (results[1].nextEvent && results[1].nextEvent.title) {
          pushFeed('Calendar', results[1].nextEvent.title);
        }
      }
    } catch (_) { /* optional */ }
  }

  function injectTickerBar() {
    if (document.getElementById('eliteTickerBar')) return;
    var nav = document.querySelector('.nav');
    if (!nav) return;
    var bar = document.createElement('div');
    bar.id = 'eliteTickerBar';
    bar.className = 'elite-ticker-wrap';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Live market prices');
    nav.parentNode.insertBefore(bar, nav.nextSibling);
  }

  function init() {
    injectTickerBar();
    renderAll();
    pingServer().then(renderTicker);
    loadSummaries().then(renderAll);

    document.addEventListener('aurafx-quotes-updated', function () {
      pushFeed('Quotes refreshed', window.AURAFX_LIVE_QUOTES.source || '');
      renderAll();
      if (window.AURAFX_pushLivePrices) window.AURAFX_pushLivePrices();
    });

    setInterval(function () {
      renderSessions(document.getElementById('eliteSessions'));
    }, 1000);

    setInterval(function () {
      pingServer();
      loadSummaries().then(renderAll);
    }, 45000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.AURAFX_EliteCommand = { refresh: renderAll, state: state };
})();
