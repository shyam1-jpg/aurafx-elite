/**
 * AuraFX Pro Dashboard — tiers A+B+C: shell, charts, event log, cloud journal.
 */
(function () {
  const API = window.AURAFX_API_BASE != null ? window.AURAFX_API_BASE : '';
  const IS_LIVE_HOST = window.location.protocol !== 'file:' &&
    /aurafxelite\.com|onrender\.com/i.test(window.location.hostname || '');
  const JOURNAL_KEY = 'aurafx_journal';
  const CLIENT_KEY = 'aurafx_client';
  const THEME_KEY = 'aurafx_dash_theme';
  const REFRESH_MS = 5000;
  const QUOTE_UI_MS = 1000;
  const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
  const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;

  const $ = (id) => document.getElementById(id);
  let chartRange = '1h';
  let moodChart = null;
  let bullChart = null;
  let riskGauge = null;
  let lastRefreshMs = 0;
  let refreshInFlight = false;
  let hasLoadedOnce = false;
  let client = null;
  let cloudBackend = 'unavailable';

  function validEmail(s) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
  }

  function cloudConfigured() {
    return cloudBackend === 'neon';
  }

  async function loadSiteConfig() {
    try {
      const r = await fetch(API + '/api/config', { cache: 'no-store' });
      if (!r.ok) return;
      const cfg = await r.json();
      cloudBackend = (cfg.dashboard && cfg.dashboard.backend) || 'unavailable';
    } catch (_) { /* offline */ }
    updateCloudSyncUI();
  }

  function updateCloudSyncUI() {
    const syncBtn = $('btnSyncJournal');
    const note = $('cloudSyncNote');
    const settingsNote = $('cloudSyncSettingsNote');
    const linked = !!(client && client.dashboardToken);
    const showSync = cloudConfigured() && linked;

    if (syncBtn) syncBtn.hidden = !showSync;
    if (note) {
      if (showSync) {
        note.hidden = true;
        note.textContent = '';
      } else {
        note.hidden = false;
        note.textContent = cloudConfigured()
          ? 'Link your account in Settings to enable cloud sync.'
          : 'Cloud sync not configured yet.';
      }
    }
    if (settingsNote) {
      settingsNote.textContent = cloudConfigured()
        ? 'Cloud journal sync is available when you link your registration email below.'
        : 'Cloud sync not configured yet — your journal stays on this device only.';
    }
    const badge = $('journalSyncBadge');
    if (badge && !(client && client.dashboardToken && cloudConfigured())) {
      badge.textContent = 'Local only';
      badge.className = 'sync-badge local';
    }
  }

  function loadClient() {
    try {
      client = JSON.parse(localStorage.getItem(CLIENT_KEY) || 'null');
    } catch {
      client = null;
    }
    return client;
  }

  function saveClient(c) {
    client = c;
    localStorage.setItem(CLIENT_KEY, JSON.stringify(c));
    renderUser();
  }

  function authHeaders() {
    if (!client || !client.id || !client.email || !client.dashboardToken) return {};
    return {
      'X-Dashboard-Id': client.id,
      'X-Dashboard-Token': client.dashboardToken,
      'X-Dashboard-Email': client.email
    };
  }

  function renderUser() {
    loadClient();
    const nameEl = $('userName');
    const av = $('userAvatar');
    const out = $('btnSignOut');
    const guestBtn = $('btnGuestAuth');
    const loggedIn = !!(client && client.fullName);
    if (!nameEl) return;
    if (loggedIn) {
      nameEl.textContent = client.fullName.split(' ')[0];
      av.textContent = (client.fullName[0] || 'U').toUpperCase();
      if (out) out.hidden = false;
      if (guestBtn) guestBtn.hidden = true;
      const badge = $('journalSyncBadge');
      if (badge && client.dashboardToken && cloudConfigured()) {
        badge.textContent = 'Cloud sync ready';
        badge.className = 'sync-badge';
      }
    } else {
      nameEl.textContent = 'Guest';
      av.textContent = '?';
      if (out) out.hidden = true;
      if (guestBtn) guestBtn.hidden = false;
    }
    updateCloudSyncUI();
  }

  function getSessionGMT() {
    const h = new Date().getUTCHours();
    if (h >= 12 && h < 16) return { name: 'London / NY Overlap', best: true };
    if (h >= 7 && h < 16) return { name: 'London', best: true };
    if (h >= 12 && h < 21) return { name: 'New York', best: true };
    if (h >= 0 && h < 9) return { name: 'Asian', best: false };
    return { name: 'Off-hours', best: false };
  }

  function setStatus(mode, lines) {
    const bar = $('statusBar');
    if (!bar) return;
    bar.className = 'status-bar ' + mode;
    const age = lastRefreshMs ? Math.round((Date.now() - lastRefreshMs) / 1000) + 's ago' : '';
    bar.innerHTML = lines.map((l) => '<span class="status-line">' + l + '</span>').join('') +
      (age ? '<span class="status-line"><span class="refresh-dot"></span>' + age + '</span>' : '');
  }

  function formatUpdated(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return iso;
    }
  }

  function quoteAgeSec() {
    const q = window.AURAFX_LIVE_QUOTES;
    if (!q || !q.updatedAt) return null;
    const age = Math.round((Date.now() - new Date(q.updatedAt).getTime()) / 1000);
    return age < 0 ? 0 : age;
  }

  function buildFallbackQuotes() {
    const bases = window.AURAFX_PRICE_BASES || {};
    return {
      loaded: true,
      live: false,
      source: 'Reference data (offline)',
      updatedAt: new Date().toISOString(),
      refreshSeconds: 1,
      forex: bases.forex || {},
      metals: bases.metals || {},
      crypto: bases.crypto || {},
      changes: {}
    };
  }

  function buildFallbackPro() {
    const sess = getSessionGMT();
    return {
      mood: 'NEUTRAL',
      session: sess.name,
      sessionRisk: 'MEDIUM',
      score: 55,
      bullishProb: 55,
      bearishProb: 45,
      sentiment: 'Neutral',
      apiStatus: 'degraded',
      dataMode: 'reference',
      dataSource: 'Local reference prices',
      updatedAt: new Date().toISOString(),
      exposureLots: 0,
      dailyPnlPct: 0,
      correlated: 0
    };
  }

  function buildFallbackRisk() {
    return {
      mood: 'NEUTRAL',
      sessionRisk: 'MEDIUM',
      apiStatus: 'degraded',
      updatedAt: new Date().toISOString(),
      calendar: [],
      nextEvent: null
    };
  }

  function renderTicker() {
    const el = $('priceTicker');
    if (!el) return;
    const q = window.AURAFX_LIVE_QUOTES || {};
    const xau = q.metals && q.metals.XAUUSD;
    const eur = q.forex && q.forex.EURUSD;
    const btc = q.crypto && (q.crypto.BTC || q.crypto.BTCUSD);
    const items = [];
    if (xau) items.push('<span class="dash-ticker-item">XAUUSD <strong>$' + Number(xau).toFixed(2) + '</strong></span>');
    if (eur) items.push('<span class="dash-ticker-item">EURUSD <strong>' + Number(eur).toFixed(5) + '</strong></span>');
    if (btc) items.push('<span class="dash-ticker-item">BTC <strong>$' + Number(btc).toFixed(0) + '</strong></span>');
    const feedLabel = q.live === false
      ? 'Reference feed'
      : (q.source || '—');
    items.push('<span class="dash-ticker-item muted"><span class="lbl">Feed:</span>' + feedLabel + '</span>');
    el.innerHTML = items.length > 1
      ? items.join('')
      : '<span class="dash-ticker-item muted">Live feed temporarily unavailable. Showing demo/reference data.</span>';
  }

  function updateQuoteAgeUi() {
    const qa = quoteAgeSec();
    const kQuoteAge = $('kpiQuoteAge');
    if (kQuoteAge) kQuoteAge.textContent = qa != null ? qa + 's' : '—';
    const grid = $('healthGrid');
    if (grid && grid.children.length) {
      const first = grid.children[0];
      if (first) {
        first.className = 'health-item ' + (qa != null && qa < 10 ? 'ok' : 'fail');
        const spans = first.querySelectorAll('span');
        if (spans[1]) spans[1].textContent = qa != null ? qa + 's old' : 'reference';
      }
    }
  }

  document.addEventListener('aurafx-quotes-updated', renderTicker);

  function loadJournalLocal() {
    try {
      return JSON.parse(localStorage.getItem(JOURNAL_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function saveJournalLocal(entries) {
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(entries));
  }

  async function pullJournalCloud() {
    if (!client || !client.dashboardToken || !cloudConfigured()) return;
    try {
      const r = await fetch(API + '/api/dashboard/journal', { headers: authHeaders() });
      const d = await r.json();
      if (r.ok && d.entries && d.entries.length) {
        saveJournalLocal(d.entries);
        const badge = $('journalSyncBadge');
        if (badge) {
          badge.textContent = d.cloudSync ? 'Cloud synced' : 'Local + server';
          badge.className = 'sync-badge';
        }
      }
    } catch (_) { /* offline */ }
  }

  async function pushJournalCloud() {
    if (!cloudConfigured()) {
      alert('Cloud sync is not configured on the server yet.');
      return;
    }
    if (!client || !client.dashboardToken) {
      alert('Link your account in Settings first.');
      return;
    }
    const entries = loadJournalLocal();
    const r = await fetch(API + '/api/dashboard/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ entries })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Sync failed');
    alert('Journal synced (' + d.saved + ' entries).');
  }

  function renderJournal() {
    const entries = loadJournalLocal();
    const ins = $('journalInsights');
    if (ins && !ins.dataset.pendingMsg) {
      ins.textContent = entries.length
        ? 'Personal journal: ' + entries.length + ' trade(s) on this device.'
        : 'No trades logged yet.';
      ins.style.color = '';
    }
    const list = $('journalList');
    if (!list) return;
    list.innerHTML = entries.length === 0
      ? '<li>No saved trades yet</li>'
      : entries.slice(-20).reverse().map((e) =>
          '<li>' + new Date(e.time).toLocaleString() + ' ' + e.symbol + ' ' + e.dir + ' ' + e.entry + '→' + e.exit + '</li>'
        ).join('');
  }

  const checklistItems = [
    { id: 'trend', label: 'Trend confirmed (MTF)' },
    { id: 'sr', label: 'Support/Resistance confirmed' },
    { id: 'news', label: 'News clear' },
    { id: 'risk', label: 'Risk acceptable' },
    { id: 'rr', label: 'Risk/Reward ≥ 1:2' },
    { id: 'vol', label: 'Volume confirmation' },
    { id: 'session', label: 'Session active' }
  ];

  function renderChecklist(data) {
    const cl = $('checklist');
    const cr = $('checkResult');
    if (!cl || !cr) return;
    const flags = {
      trend: data.mood !== 'DANGEROUS' && (data.score ?? 50) >= 70,
      sr: true,
      news: !data.nextEvent || data.nextEvent.minutesUntil > 30,
      risk: data.sessionRisk !== 'HIGH',
      rr: (data.score ?? 0) >= 70,
      vol: true,
      session: getSessionGMT().best
    };
    let passed = 0;
    cl.innerHTML = checklistItems.map((c) => {
      const ok = flags[c.id];
      if (ok) passed++;
      return '<li class="' + (ok ? 'pass' : 'fail') + '">' + c.label + '</li>';
    }).join('');
    cr.textContent = passed >= 6 ? 'Checklist complete' : 'Checklist incomplete';
    cr.style.color = passed >= 6 ? 'var(--bull)' : 'var(--bear)';
  }

  function renderFeeds(risk, news) {
    const calEl = $('calendarList');
    if (calEl && window.AURAFX_renderCalendarList) {
      window.AURAFX_renderCalendarList(calEl, 15);
    } else if (calEl) {
      const cal = (risk && risk.calendar) || [];
      calEl.innerHTML = cal.length === 0
        ? '<li>No calendar items available right now.</li>'
        : cal.slice(0, 12).map((e) =>
            '<li><span class="risk-tag">' + e.risk + '</span> <strong>' + e.title + '</strong><br><span class="muted">' +
            new Date(e.time).toLocaleString() + '</span></li>'
          ).join('');
    }
    const newsEl = $('newsList');
    if (!newsEl) return;
    const items = (news && (news.items || news.breakingNews)) || [];
    newsEl.innerHTML = items.length === 0
      ? '<li>No headlines available right now.</li>'
      : items.slice(0, 15).map((n) =>
          '<li><span class="risk-tag">' + (n.risk || '') + '</span> <strong>' + n.title + '</strong><br><span class="muted">' +
          (n.source || '') + ' · ' + new Date(n.time).toLocaleString() + '</span></li>'
        ).join('');
  }

  function renderKpis(pro, risk) {
    const sess = getSessionGMT();
    const kSession = $('kpiSession');
    const kMood = $('kpiMood');
    const kScore = $('kpiScore');
    const kEvent = $('kpiEvent');
    const kApi = $('kpiApi');
    const kApiCard = $('kpiApiCard');
    const kQuoteAge = $('kpiQuoteAge');
    if (!kSession) return;
    kSession.textContent = pro.session || sess.name;
    kMood.textContent = pro.mood || (risk && risk.mood) || '—';
    kScore.textContent = String(pro.score ?? '—');
    const ev = pro.nextEvent || (risk && risk.nextEvent);
    kEvent.textContent = ev ? ev.title + ' · ' + ev.minutesUntil + 'm' : 'None';
    const apiOk = (pro.apiStatus || (risk && risk.apiStatus)) === 'online';
    kApi.textContent = apiOk ? 'Online' : 'Degraded';
    if (kApiCard) kApiCard.className = 'kpi-card ' + (apiOk ? 'ok' : 'warn');
    const qa = quoteAgeSec();
    if (kQuoteAge) kQuoteAge.textContent = qa != null ? qa + 's' : '—';
  }

  function renderHealth(pro, risk) {
    const grid = $('healthGrid');
    if (!grid) return;
    const qa = quoteAgeSec();
    const checks = [
      ['Quotes API', qa != null && qa < 10, qa != null ? qa + 's old' : 'reference'],
      ['Pro summary', !!pro.updatedAt, pro.dataSource || 'ok'],
      ['Risk feed', !!(risk && risk.updatedAt), 'calendar'],
      ['News feed', true, 'RSS/cache'],
      ['MT5 bridge', false, 'Not connected'],
      ['Cloud journal', cloudConfigured() && !!(client && client.dashboardToken), cloudConfigured() ? (client ? 'Linked' : 'Guest') : 'Not configured']
    ];
    grid.innerHTML = checks.map(([name, ok, detail]) =>
      '<div class="health-item ' + (ok ? 'ok' : 'fail') + '"><span>' + name + '</span><span>' + detail + '</span></div>'
    ).join('');
  }

  function renderPulseRing(pro) {
    const score = pro.score ?? moodToNum(pro.mood);
    const ring = $('pulseRingFg');
    const label = $('pulseScore');
    const cap = $('pulseCaption');
    if (label) label.textContent = String(Math.round(score));
    if (ring) {
      const circ = 327;
      ring.setAttribute('stroke-dashoffset', String(circ - (circ * Math.min(100, score) / 100)));
    }
    if (cap) {
      cap.textContent = 'Mood: ' + (pro.mood || '—') + ' · Session risk: ' + (pro.sessionRisk || 'MEDIUM') +
        ' — educational context only.';
    }
  }

  function renderSessionOrbs() {
    const h = new Date().getUTCHours();
    let active = 'off';
    if (h >= 12 && h < 16) active = 'overlap';
    else if (h >= 7 && h < 16) active = 'london';
    else if (h >= 12 && h < 21) active = 'ny';
    else if (h >= 0 && h < 9) active = 'asian';
    document.querySelectorAll('.session-orb').forEach((el) => {
      el.classList.toggle('active', el.getAttribute('data-session') === active);
    });
  }

  function updateWelcomeRail() {
    const rail = $('welcomeRail');
    if (!rail) return;
    if (client && client.fullName) {
      rail.classList.add('hidden');
    }
  }

  function renderEvents(events) {
    const el = $('eventLog');
    if (!el) return;
    if (!events || !events.length) {
      el.innerHTML = '<li class="ev-info"><span class="ev-time">—</span><span class="ev-level">info</span><span class="ev-msg">No events yet — server will log activity when available.</span></li>';
      return;
    }
    el.innerHTML = events.map((ev) => {
      const t = new Date(ev.ts);
      const hm = t.getHours().toString().padStart(2, '0') + ':' + t.getMinutes().toString().padStart(2, '0');
      const cls = 'ev-' + (ev.level || 'info');
      return '<li class="' + cls + '"><span class="ev-time">' + hm + '</span><span class="ev-level">' +
        (ev.level || 'info') + '</span><span class="ev-msg">' + ev.message + '</span></li>';
    }).join('');
  }

  function moodToNum(m) {
    const map = { DANGEROUS: 20, CAUTION: 45, NEUTRAL: 50, BULLISH: 70, 'Risk-On': 75 };
    return map[m] || 50;
  }

  async function loadHistory() {
    if (typeof Chart === 'undefined') return;
    try {
      const r = await fetch(API + '/api/dashboard/history?range=' + encodeURIComponent(chartRange));
      const d = r.ok ? await r.json() : { points: [] };
      const points = d.points || [];
      const labels = points.map((p) => {
        const t = new Date(p.ts);
        return chartRange === '24h'
          ? t.getHours() + ':00'
          : t.getHours() + ':' + String(t.getMinutes()).padStart(2, '0');
      });
      const scores = points.map((p) => p.score);
      const moods = points.map((p) => moodToNum(p.mood));
      const bulls = points.map((p) => p.bullishProb);

      const moodCtx = $('moodChart');
      if (moodCtx) {
        if (moodChart) moodChart.destroy();
        moodChart = new Chart(moodCtx, {
          type: 'line',
          data: {
            labels,
            datasets: [
              { label: 'Setup score', data: scores, borderColor: '#d4af37', tension: 0.3, fill: false },
              { label: 'Mood index', data: moods, borderColor: '#5dade2', tension: 0.3, fill: false }
            ]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#8b90a5' } } },
            scales: {
              x: { ticks: { color: '#8b90a5', maxTicksLimit: 8 } },
              y: { min: 0, max: 100, ticks: { color: '#8b90a5' } }
            }
          }
        });
      }

      const bullCtx = $('bullChart');
      if (bullCtx) {
        if (bullChart) bullChart.destroy();
        bullChart = new Chart(bullCtx, {
          type: 'line',
          data: {
            labels,
            datasets: [{ label: 'Bullish weight %', data: bulls, borderColor: '#2ecc71', backgroundColor: 'rgba(46,204,113,.1)', fill: true, tension: 0.3 }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#8b90a5' } } },
            scales: { x: { ticks: { color: '#8b90a5', maxTicksLimit: 8 } }, y: { min: 0, max: 100, ticks: { color: '#8b90a5' } } }
          }
        });
      }
    } catch (_) { /* chart optional */ }
  }

  function loadHistoryWhenReady() {
    if (typeof Chart !== 'undefined') {
      loadHistory();
      return;
    }
    let tries = 0;
    const wait = () => {
      if (typeof Chart !== 'undefined') loadHistory();
      else if (++tries < 120) setTimeout(wait, 100);
    };
    wait();
  }

  function renderRiskGauge(sessionRisk) {
    if (typeof Chart === 'undefined') return;
    const val = sessionRisk === 'HIGH' ? 85 : sessionRisk === 'LOW' ? 25 : 55;
    const ctx = $('riskGauge');
    if (!ctx) return;
    try {
      if (riskGauge) riskGauge.destroy();
      riskGauge = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Risk level', ''],
          datasets: [{ data: [val, 100 - val], backgroundColor: ['#e67e22', '#1a2030'], borderWidth: 0 }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '70%',
          plugins: { legend: { display: false }, tooltip: { enabled: false } }
        }
      });
    } catch (_) { /* gauge optional */ }
  }

  function applyData(pro, risk) {
    const sess = getSessionGMT();
    const sn = $('sessionName');
    if (sn) sn.textContent = (pro.session || sess.name) + (sess.best ? ' ★' : '');
    const bull = pro.bullishProb ?? 55;
    const bear = pro.bearishProb ?? 100 - bull;
    const bullPct = $('bullPct');
    const bearPct = $('bearPct');
    const bullBar = $('bullBar');
    const bearBar = $('bearBar');
    if (bullPct) bullPct.textContent = Math.round(bull) + '%';
    if (bearPct) bearPct.textContent = Math.round(bear) + '%';
    if (bullBar) bullBar.style.width = bull + '%';
    if (bearBar) bearBar.style.width = bear + '%';
    const score = pro.score ?? Math.round(bull);
    const sg = $('scoreGrade');
    if (sg) {
      sg.textContent = 'Setup score: ' + score + ' — ' +
        (score >= 80 ? 'Strong alignment' : score >= 70 ? 'Marginal' : 'Poor alignment') + ' (educational)';
    }
    const sent = $('sentiment');
    if (sent) sent.textContent = 'Sentiment: ' + (pro.sentiment || 'Neutral');
    const nel = $('nextEventLine');
    if (nel) {
      if (pro.nextEvent || (risk && risk.nextEvent)) {
        const ev = pro.nextEvent || risk.nextEvent;
        nel.textContent = 'Next: ' + ev.title + ' in ' + ev.minutesUntil + ' min (' + (ev.risk || '') + ')';
      } else {
        nel.textContent = 'No major events in the next few hours.';
      }
    }
    const exp = $('exposure');
    const corr = $('corr');
    const pnl = $('dailyPnl');
    if (exp) exp.textContent = (pro.exposureLots ?? 0).toFixed(2);
    if (corr) corr.textContent = pro.correlated ?? 0;
    if (pnl) pnl.textContent = (pro.dailyPnlPct ?? 0).toFixed(2);
    const banner = $('crashBanner');
    if (banner) {
      if (pro.crashAlert || pro.mood === 'DANGEROUS' || (risk && risk.mood === 'DANGEROUS')) {
        banner.classList.remove('hidden');
      } else {
        banner.classList.add('hidden');
      }
    }
    renderChecklist({ ...pro, nextEvent: pro.nextEvent || (risk && risk.nextEvent) });
    renderKpis(pro, risk || {});
    renderHealth(pro, risk || {});
    renderPulseRing(pro);
    renderSessionOrbs();
    renderRiskGauge(pro.sessionRisk || (risk && risk.sessionRisk));
  }

  async function safeJson(url, fallback) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) return fallback;
      return await r.json();
    } catch {
      return fallback;
    }
  }

  function applyFallbackData() {
    const pro = buildFallbackPro();
    const risk = buildFallbackRisk();
    const q = buildFallbackQuotes();
    window.AURAFX_LIVE_QUOTES = Object.assign({}, window.AURAFX_LIVE_QUOTES || {}, q);
    document.dispatchEvent(new CustomEvent('aurafx-quotes-updated'));
    lastRefreshMs = Date.now();
    applyData(pro, risk);
    renderFeeds(risk, { items: [] });
    renderEvents([]);
    renderTicker();
    setStatus('demo', [
      '○ Reference mode',
      'Live feed temporarily unavailable. Showing demo/reference data.',
      'Updated: ' + formatUpdated(pro.updatedAt)
    ]);
  }

  async function refresh(opts) {
    const forceStatus = !!(opts && opts.forceStatus);
    if (refreshInFlight) return;
    refreshInFlight = true;
    if (!hasLoadedOnce || forceStatus) {
      setStatus('demo', ['○ Connecting…', 'Fetching market data…']);
    }
    try {
      const [pro, risk, news, evRes] = await Promise.all([
        safeJson(API + '/api/pro-summary', null),
        safeJson(API + '/api/risk-summary', null),
        safeJson(API + '/api/news', { items: [] }),
        safeJson(API + '/api/dashboard/events?limit=30', { events: [] })
      ]);

      if (!pro || !pro.updatedAt) {
        applyFallbackData();
        return;
      }

      lastRefreshMs = Date.now();
      hasLoadedOnce = true;
      applyData(pro, risk || {});
      renderFeeds(risk || {}, news || { items: [] });
      renderEvents((evRes && evRes.events) || []);
      loadHistoryWhenReady();

      if (window.AURAFX_refreshLiveQuotes) {
        await window.AURAFX_refreshLiveQuotes();
      }
      const q = window.AURAFX_LIVE_QUOTES || {};
      const hasPrices = (Object.keys(q.forex || {}).length + Object.keys(q.metals || {}).length) > 0;
      if (!hasPrices) {
        Object.assign(window.AURAFX_LIVE_QUOTES, buildFallbackQuotes());
        document.dispatchEvent(new CustomEvent('aurafx-quotes-updated'));
      }
      renderTicker();

      const liveQuotes = window.AURAFX_LIVE_QUOTES && window.AURAFX_LIVE_QUOTES.live;
      const mode = pro.dataMode || (liveQuotes ? 'live' : 'reference');
      if (liveQuotes && mode !== 'reference') {
        setStatus('live', [
          '● LIVE',
          'Source: ' + (pro.dataSource || 'API'),
          'Updated: ' + formatUpdated(pro.updatedAt)
        ]);
      } else {
        setStatus('demo', [
          '○ Reference mode',
          'Live feed temporarily unavailable. Showing demo/reference data.',
          'Updated: ' + formatUpdated(pro.updatedAt)
        ]);
      }
    } catch {
      applyFallbackData();
    } finally {
      refreshInFlight = false;
    }
  }

  /* Navigation */
  document.querySelectorAll('.dash-nav button[data-panel]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const panel = btn.getAttribute('data-panel');
      document.querySelectorAll('.dash-nav button').forEach((b) => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      document.querySelectorAll('.dash-panel').forEach((p) => {
        const on = p.id === 'panel-' + panel;
        p.classList.toggle('active', on);
        p.hidden = !on;
      });
      $('dashSidebar').classList.remove('open');
      if (panel === 'analytics') loadHistoryWhenReady();
    });
  });

  $('btnSidebar')?.addEventListener('click', () => $('dashSidebar').classList.toggle('open'));

  document.querySelectorAll('.range-toggle button[data-range]').forEach((btn) => {
    btn.addEventListener('click', () => {
      chartRange = btn.getAttribute('data-range');
      document.querySelectorAll('.range-toggle button').forEach((b) => b.classList.toggle('active', b === btn));
      loadHistoryWhenReady();
    });
  });

  $('btnRefresh')?.addEventListener('click', () => refresh({ forceStatus: true }));
  $('btnTheme')?.addEventListener('click', () => {
    document.body.classList.toggle('theme-light');
    localStorage.setItem(THEME_KEY, document.body.classList.contains('theme-light') ? 'light' : 'dark');
  });

  $('btnSignOut')?.addEventListener('click', () => {
    localStorage.removeItem(CLIENT_KEY);
    client = null;
    renderUser();
    const lm = $('linkMsg');
    if (lm) lm.textContent = 'Signed out — journal remains on this device.';
  });

  $('btnLinkAccount')?.addEventListener('click', async () => {
    const email = ($('linkEmail').value || '').trim().toLowerCase();
    const msg = $('linkMsg');
    if (!email) {
      if (msg) msg.textContent = 'Enter your registration email.';
      return;
    }
    if (!validEmail(email)) {
      if (msg) msg.textContent = 'Enter a valid email address (e.g. you@email.com).';
      return;
    }
    if (msg) msg.textContent = 'Linking…';
    try {
      const r = await fetch(API + '/api/dashboard/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      let d = {};
      try {
        d = await r.json();
      } catch {
        throw new Error('Server response unavailable — try again shortly.');
      }
      if (!r.ok) throw new Error(d.error || 'Link failed — check your registration email.');
      saveClient({
        id: d.id,
        email: d.email,
        fullName: d.fullName,
        dashboardToken: d.dashboardToken,
        emailVerified: d.emailVerified
      });
      updateWelcomeRail();
      if (msg) {
        msg.textContent = d.cloudSync
          ? 'Linked — cloud sync enabled.'
          : (cloudConfigured() ? 'Linked — local server storage.' : 'Linked — journal stays on this device (cloud sync not configured yet).');
      }
      await pullJournalCloud();
      renderJournal();
    } catch (e) {
      if (msg) msg.textContent = e.message || 'Could not link account.';
    }
  });

  $('journalForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ins = $('journalInsights');
    const symbol = ($('jSymbol').value || '').trim().toUpperCase();
    const dir = $('jDir').value || 'BUY';
    const entryRaw = $('jEntry').value;
    const entry = parseFloat(entryRaw);

    if (!symbol) {
      if (ins) {
        ins.dataset.pendingMsg = '1';
        ins.textContent = 'Please enter a symbol (e.g. XAUUSD).';
        ins.style.color = 'var(--bear)';
      }
      return;
    }
    if (entryRaw === '' || !isFinite(entry)) {
      if (ins) {
        ins.dataset.pendingMsg = '1';
        ins.textContent = 'Please enter a valid entry price.';
        ins.style.color = 'var(--bear)';
      }
      return;
    }

    const entries = loadJournalLocal();
    entries.push({
      time: Date.now(),
      symbol,
      dir,
      entry,
      exit: parseFloat($('jExit').value) || 0,
      emotion: parseInt($('jEmotion').value, 10) || 5,
      reason: ($('jReason').value || '').trim()
    });
    saveJournalLocal(entries);
    if (ins) {
      delete ins.dataset.pendingMsg;
      ins.textContent = 'Trade saved locally (' + dir + ' ' + symbol + ').';
      ins.style.color = 'var(--bull)';
    }
    renderJournal();
    if (client && client.dashboardToken && cloudConfigured()) {
      try { await pushJournalCloud(); } catch (_) { /* silent */ }
    }
    e.target.reset();
    const sym = $('jSymbol');
    if (sym) sym.value = 'XAUUSD';
    const emo = $('jEmotion');
    if (emo) emo.value = '5';
  });

  $('btnExportJournal')?.addEventListener('click', () => {
    const entries = loadJournalLocal();
    if (!entries.length) {
      const ins = $('journalInsights');
      if (ins) {
        ins.dataset.pendingMsg = '1';
        ins.textContent = 'No trades to export — save a trade first.';
        ins.style.color = 'var(--bear)';
      }
      return;
    }
    const csv = 'time,symbol,direction,entry,exit,emotion,reason\n' + entries.map((e) =>
      [new Date(e.time).toISOString(), e.symbol, e.dir, e.entry, e.exit, e.emotion, '"' + (e.reason || '').replace(/"/g, '""') + '"'].join(',')
    ).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'aurafx-journal.csv';
    a.click();
    const ins = $('journalInsights');
    if (ins) {
      delete ins.dataset.pendingMsg;
      ins.textContent = 'Exported ' + entries.length + ' trade(s) to CSV.';
      ins.style.color = 'var(--bull)';
    }
  });

  $('btnSyncJournal')?.addEventListener('click', () => pushJournalCloud().catch((e) => alert(e.message)));

  $('chartUpload')?.addEventListener('change', (ev) => {
    const file = ev.target.files[0];
    const out = $('screenshotAnalysis');
    const c = $('chartCanvas');
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type) && !IMAGE_EXT.test(file.name)) {
      if (out) out.textContent = 'Please upload a PNG, JPG, or WebP image.';
      ev.target.value = '';
      return;
    }
    const img = new Image();
    img.onload = () => {
      if (!c) return;
      const ctx = c.getContext('2d');
      c.width = Math.min(800, img.width);
      c.height = Math.min(450, img.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const w = c.width;
      const h = c.height;
      ctx.strokeStyle = '#2ecc71';
      ctx.strokeRect(w * 0.1, h * 0.7, w * 0.8, h * 0.05);
      ctx.strokeStyle = '#e74c3c';
      ctx.strokeRect(w * 0.1, h * 0.15, w * 0.8, h * 0.05);
      if (out) out.textContent = 'Preview loaded — illustrative zones drawn (not financial advice).';
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => {
      if (out) out.textContent = 'Could not read that image — try another PNG, JPG, or WebP file.';
      ev.target.value = '';
    };
    img.src = URL.createObjectURL(file);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') {
      if (!e.ctrlKey && !e.metaKey && document.activeElement.tagName !== 'INPUT') refresh({ forceStatus: true });
    }
  });

  if (localStorage.getItem(THEME_KEY) === 'light') document.body.classList.add('theme-light');

  loadClient();
  if (client && client.email) {
    const le = $('linkEmail');
    if (le) le.value = client.email;
  }
  renderUser();
  updateWelcomeRail();
  renderJournal();
  loadSiteConfig().then(() => {
    pullJournalCloud().then(renderJournal);
  });

  refresh();
  setInterval(refresh, REFRESH_MS);
  setInterval(updateQuoteAgeUi, QUOTE_UI_MS);
})();
