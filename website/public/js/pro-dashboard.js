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
  const REFRESH_MS = 60000;

  const $ = (id) => document.getElementById(id);
  let chartRange = '1h';
  let moodChart = null;
  let bullChart = null;
  let riskGauge = null;
  let lastRefreshMs = 0;
  let client = null;

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
    if (!nameEl) return;
    if (client && client.fullName) {
      nameEl.textContent = client.fullName.split(' ')[0];
      av.textContent = (client.fullName[0] || 'U').toUpperCase();
      if (out) out.hidden = false;
      const badge = $('journalSyncBadge');
      if (badge && client.dashboardToken) {
        badge.textContent = 'Cloud sync ready';
        badge.className = 'sync-badge';
        const syncBtn = $('btnSyncJournal');
        if (syncBtn) syncBtn.hidden = false;
      }
    } else {
      nameEl.textContent = 'Guest';
      av.textContent = '?';
      if (out) out.hidden = true;
    }
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
    return Math.round((Date.now() - new Date(q.updatedAt).getTime()) / 1000);
  }

  function renderTicker() {
    const el = $('priceTicker');
    if (!el) return;
    const q = window.AURAFX_LIVE_QUOTES || {};
    const xau = q.metals && q.metals.XAUUSD;
    const eur = q.forex && q.forex.EURUSD;
    const btc = q.crypto && q.crypto.BTCUSD;
    const items = [];
    if (xau) items.push('<span class="dash-ticker-item">XAUUSD <strong>$' + Number(xau).toFixed(2) + '</strong></span>');
    if (eur) items.push('<span class="dash-ticker-item">EURUSD <strong>' + Number(eur).toFixed(5) + '</strong></span>');
    if (btc) items.push('<span class="dash-ticker-item">BTC <strong>$' + Number(btc).toFixed(0) + '</strong></span>');
    items.push('<span class="dash-ticker-item muted"><span class="lbl">Feed:</span>' + (q.source || '—') + '</span>');
    el.innerHTML = items.length ? items.join('') : '<span class="dash-ticker-item">Quotes loading…</span>';
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
    if (!client || !client.dashboardToken) return;
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
    if (ins) {
      ins.textContent = entries.length
        ? 'Personal journal: ' + entries.length + ' trade(s) on this device.'
        : 'No trades logged yet.';
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
    $('checklist').innerHTML = checklistItems.map((c) => {
      const ok = flags[c.id];
      if (ok) passed++;
      return '<li class="' + (ok ? 'pass' : 'fail') + '">' + c.label + '</li>';
    }).join('');
    $('checkResult').textContent = passed >= 6 ? 'Checklist complete' : 'Checklist incomplete';
    $('checkResult').style.color = passed >= 6 ? 'var(--bull)' : 'var(--bear)';
  }

  function renderFeeds(risk, news) {
    const cal = risk.calendar || [];
    $('calendarList').innerHTML = cal.length === 0
      ? '<li>Loading calendar…</li>'
      : cal.slice(0, 12).map((e) =>
          '<li><span class="risk-tag">' + e.risk + '</span> <strong>' + e.title + '</strong><br><span class="muted">' +
          new Date(e.time).toLocaleString() + '</span></li>'
        ).join('');
    const items = news.items || news.breakingNews || [];
    $('newsList').innerHTML = items.length === 0
      ? '<li>Loading news…</li>'
      : items.slice(0, 15).map((n) =>
          '<li><span class="risk-tag">' + (n.risk || '') + '</span> <strong>' + n.title + '</strong><br><span class="muted">' +
          (n.source || '') + ' · ' + new Date(n.time).toLocaleString() + '</span></li>'
        ).join('');
  }

  function renderKpis(pro, risk) {
    const sess = getSessionGMT();
    $('kpiSession').textContent = pro.session || sess.name;
    $('kpiMood').textContent = pro.mood || risk.mood || '—';
    $('kpiScore').textContent = String(pro.score ?? '—');
    const ev = pro.nextEvent || risk.nextEvent;
    $('kpiEvent').textContent = ev ? ev.title + ' · ' + ev.minutesUntil + 'm' : 'None';
    const apiOk = (pro.apiStatus || risk.apiStatus) === 'online';
    $('kpiApi').textContent = apiOk ? 'Online' : 'Degraded';
    $('kpiApiCard').className = 'kpi-card ' + (apiOk ? 'ok' : 'warn');
    const qa = quoteAgeSec();
    $('kpiQuoteAge').textContent = qa != null ? qa + 's' : '—';
  }

  function renderHealth(pro, risk) {
    const grid = $('healthGrid');
    if (!grid) return;
    const qa = quoteAgeSec();
    const checks = [
      ['Quotes API', qa != null && qa < 120, qa != null ? qa + 's old' : 'offline'],
      ['Pro summary', !!pro.updatedAt, pro.dataSource || 'ok'],
      ['Risk feed', !!risk.updatedAt, 'calendar'],
      ['News feed', true, 'RSS/cache'],
      ['MT5 bridge', false, 'Not connected'],
      ['Cloud journal', !!(client && client.dashboardToken), client ? 'Linked' : 'Guest']
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
      el.innerHTML = '<li class="ev-info"><span class="ev-time">—</span><span class="ev-level">info</span><span class="ev-msg">No events yet</span></li>';
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
      const d = await r.json();
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

  function renderRiskGauge(sessionRisk) {
    if (typeof Chart === 'undefined') return;
    const val = sessionRisk === 'HIGH' ? 85 : sessionRisk === 'LOW' ? 25 : 55;
    const ctx = $('riskGauge');
    if (!ctx) return;
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
  }

  function applyData(pro, risk) {
    const sess = getSessionGMT();
    $('sessionName').textContent = (pro.session || sess.name) + (sess.best ? ' ★' : '');
    const bull = pro.bullishProb ?? 55;
    const bear = pro.bearishProb ?? 100 - bull;
    $('bullPct').textContent = Math.round(bull) + '%';
    $('bearPct').textContent = Math.round(bear) + '%';
    $('bullBar').style.width = bull + '%';
    $('bearBar').style.width = bear + '%';
    const score = pro.score ?? Math.round(bull);
    $('scoreGrade').textContent = 'Setup score: ' + score + ' — ' +
      (score >= 80 ? 'Strong alignment' : score >= 70 ? 'Marginal' : 'Poor alignment') + ' (educational)';
    $('sentiment').textContent = 'Sentiment: ' + (pro.sentiment || 'Neutral');
    if (pro.nextEvent || risk.nextEvent) {
      const ev = pro.nextEvent || risk.nextEvent;
      $('nextEventLine').textContent = 'Next: ' + ev.title + ' in ' + ev.minutesUntil + ' min (' + (ev.risk || '') + ')';
    }
    $('exposure').textContent = (pro.exposureLots ?? 0).toFixed(2);
    $('corr').textContent = pro.correlated ?? 0;
    $('dailyPnl').textContent = (pro.dailyPnlPct ?? 0).toFixed(2);
    if (pro.crashAlert || pro.mood === 'DANGEROUS' || risk.mood === 'DANGEROUS') {
      $('crashBanner').classList.remove('hidden');
    } else {
      $('crashBanner').classList.add('hidden');
    }
    renderChecklist({ ...pro, nextEvent: pro.nextEvent || risk.nextEvent });
    renderKpis(pro, risk);
    renderHealth(pro, risk);
    renderPulseRing(pro);
    renderSessionOrbs();
    renderRiskGauge(pro.sessionRisk || risk.sessionRisk);
  }

  async function refresh() {
    try {
      const [pro, risk, news, evRes] = await Promise.all([
        fetch(API + '/api/pro-summary').then((r) => r.json()),
        fetch(API + '/api/risk-summary').then((r) => r.json()),
        fetch(API + '/api/news').then((r) => r.json()),
        fetch(API + '/api/dashboard/events?limit=30').then((r) => r.json()).catch(() => ({ events: [] }))
      ]);
      lastRefreshMs = Date.now();
      applyData(pro, risk);
      renderFeeds(risk, news);
      renderEvents(evRes.events);
      await loadHistory();
      if (window.AURAFX_refreshLiveQuotes) await window.AURAFX_refreshLiveQuotes();
      renderTicker();
      const mode = pro.dataMode || 'live';
      setStatus('live', [
        mode === 'live' ? '● LIVE' : '● ' + String(mode).toUpperCase(),
        'Source: ' + (pro.dataSource || 'API'),
        'Updated: ' + formatUpdated(pro.updatedAt)
      ]);
    } catch {
      setStatus('demo', ['○ Offline', IS_LIVE_HOST ? 'Retry shortly' : 'Visit aurafxelite.com']);
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
      if (panel === 'analytics') loadHistory();
    });
  });

  $('btnSidebar')?.addEventListener('click', () => $('dashSidebar').classList.toggle('open'));

  document.querySelectorAll('.range-toggle button[data-range]').forEach((btn) => {
    btn.addEventListener('click', () => {
      chartRange = btn.getAttribute('data-range');
      document.querySelectorAll('.range-toggle button').forEach((b) => b.classList.toggle('active', b === btn));
      loadHistory();
    });
  });

  $('btnRefresh')?.addEventListener('click', refresh);
  $('btnTheme')?.addEventListener('click', () => {
    document.body.classList.toggle('theme-light');
    localStorage.setItem(THEME_KEY, document.body.classList.contains('theme-light') ? 'light' : 'dark');
  });

  $('btnSignOut')?.addEventListener('click', () => {
    localStorage.removeItem(CLIENT_KEY);
    client = null;
    renderUser();
    $('linkMsg').textContent = 'Signed out — journal remains on this device.';
  });

  $('btnLinkAccount')?.addEventListener('click', async () => {
    const email = ($('linkEmail').value || '').trim().toLowerCase();
    if (!email) return;
    $('linkMsg').textContent = 'Linking…';
    try {
      const r = await fetch(API + '/api/dashboard/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Link failed');
      saveClient({
        id: d.id,
        email: d.email,
        fullName: d.fullName,
        dashboardToken: d.dashboardToken,
        emailVerified: d.emailVerified
      });
      updateWelcomeRail();
      $('linkMsg').textContent = d.cloudSync ? 'Linked — cloud sync enabled.' : 'Linked — local server storage.';
      await pullJournalCloud();
      renderJournal();
    } catch (e) {
      $('linkMsg').textContent = e.message;
    }
  });

  $('journalForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const entries = loadJournalLocal();
    entries.push({
      time: Date.now(),
      symbol: $('jSymbol').value,
      dir: $('jDir').value,
      entry: parseFloat($('jEntry').value) || 0,
      exit: parseFloat($('jExit').value) || 0,
      emotion: parseInt($('jEmotion').value, 10) || 5,
      reason: $('jReason').value
    });
    saveJournalLocal(entries);
    renderJournal();
    if (client && client.dashboardToken) {
      try { await pushJournalCloud(); } catch (_) { /* silent */ }
    }
    e.target.reset();
  });

  $('btnExportJournal')?.addEventListener('click', () => {
    const entries = loadJournalLocal();
    if (!entries.length) return alert('No journal entries.');
    const csv = 'time,symbol,direction,entry,exit,emotion,reason\n' + entries.map((e) =>
      [new Date(e.time).toISOString(), e.symbol, e.dir, e.entry, e.exit, e.emotion, '"' + (e.reason || '').replace(/"/g, '""') + '"'].join(',')
    ).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'aurafx-journal.csv';
    a.click();
  });

  $('btnSyncJournal')?.addEventListener('click', () => pushJournalCloud().catch((e) => alert(e.message)));

  $('chartUpload')?.addEventListener('change', (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const c = $('chartCanvas');
      const ctx = c.getContext('2d');
      c.width = Math.min(800, img.width);
      c.height = Math.min(450, img.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const w = c.width, h = c.height;
      ctx.strokeStyle = '#2ecc71';
      ctx.strokeRect(w * 0.1, h * 0.7, w * 0.8, h * 0.05);
      ctx.strokeStyle = '#e74c3c';
      ctx.strokeRect(w * 0.1, h * 0.15, w * 0.8, h * 0.05);
      $('screenshotAnalysis').textContent = 'Illustrative zones drawn — not financial advice.';
    };
    img.src = URL.createObjectURL(file);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') {
      if (!e.ctrlKey && !e.metaKey && document.activeElement.tagName !== 'INPUT') refresh();
    }
  });

  if (localStorage.getItem(THEME_KEY) === 'light') document.body.classList.add('theme-light');

  loadClient();
  if (client && client.email) $('linkEmail').value = client.email;
  renderUser();
  updateWelcomeRail();
  renderJournal();
  pullJournalCloud().then(renderJournal);

  function waitChart() {
    if (typeof Chart !== 'undefined') refresh();
    else setTimeout(waitChart, 100);
  }
  waitChart();
  setInterval(refresh, REFRESH_MS);
})();
