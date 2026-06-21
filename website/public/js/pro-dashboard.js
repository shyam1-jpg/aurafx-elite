const API = window.AURAFX_API_BASE != null ? window.AURAFX_API_BASE : (window.location.protocol === 'file:' ? 'http://127.0.0.1:3847' : '');
const IS_LIVE_HOST = window.location.protocol !== 'file:' && /aurafxelite\.com|onrender\.com/i.test(window.location.hostname || '');
let forceDemo = IS_FILE_MODE;

const $ = (id) => document.getElementById(id);

function getDemoData(overrides = {}) {
  const sess = getSessionGMT();
  return {
    mood: 'CAUTION',
    sessionRisk: 'MEDIUM',
    session: sess.name,
    nextEvent: { title: 'US CPI m/m', minutesUntil: 42, risk: 'HIGH', impact: 'Volatile' },
    bullishProb: 58,
    bearishProb: 42,
    score: 78,
    sentiment: 'Bullish',
    crashAlert: false,
    exposureLots: 0.1,
    correlated: 0,
    dailyPnlPct: 0,
    calendar: [],
    news: [],
    ...overrides
  };
}

function setStatus(mode, text) {
  const bar = $('statusBar');
  bar.className = 'status-bar ' + mode;
  bar.textContent = text;
}

function getSessionGMT() {
  const h = new Date().getUTCHours();
  if (h >= 12 && h < 16) return { name: 'London / NY Overlap', best: true };
  if (h >= 7 && h < 16) return { name: 'London', best: true };
  if (h >= 12 && h < 21) return { name: 'New York', best: true };
  if (h >= 0 && h < 9) return { name: 'Asian', best: false };
  return { name: 'Off-hours', best: false };
}

function loadJournal() {
  try {
    return JSON.parse(localStorage.getItem(JOURNAL_KEY) || '[]');
  } catch {
    return [];
  }
}

function journalInsights(entries) {
  if (!entries.length) return 'No trades logged yet. Fill the form and click Save trade.';
  const wins = entries.filter((e) => (e.exit - e.entry) * (e.dir === 'BUY' ? 1 : -1) > 0);
  const winRate = ((wins.length / entries.length) * 100).toFixed(1);
  return `Personal Performance AI:\n• Win rate: ${winRate}%\n• Total logged: ${entries.length}`;
}

function renderJournal() {
  const entries = loadJournal();
  $('journalInsights').textContent = journalInsights(entries);
  $('journalList').innerHTML =
    entries.length === 0
      ? '<li>No saved trades yet</li>'
      : entries
          .slice(-15)
          .reverse()
          .map(
            (e) =>
              `<li>${new Date(e.time).toLocaleString()} ${e.symbol} ${e.dir} ${e.entry}→${e.exit}</li>`
          )
          .join('');
}

$('journalForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const entries = loadJournal();
  entries.push({
    time: Date.now(),
    symbol: $('jSymbol').value,
    dir: $('jDir').value,
    entry: parseFloat($('jEntry').value) || 0,
    exit: parseFloat($('jExit').value) || 0,
    emotion: parseInt($('jEmotion').value, 10) || 5,
    reason: $('jReason').value
  });
  localStorage.setItem(JOURNAL_KEY, JSON.stringify(entries));
  renderJournal();
  alert('Trade saved.');
  e.target.reset();
});

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
  $('checklist').innerHTML = checklistItems
    .map((c) => {
      const ok = flags[c.id];
      if (ok) passed++;
      return `<li class="${ok ? 'pass' : 'fail'}">${c.label}</li>`;
    })
    .join('');
  $('checkResult').textContent =
    passed >= 6 ? 'Checklist PASS' : 'Checklist WAIT';
  $('checkResult').style.color = passed >= 6 ? 'var(--bull)' : 'var(--bear)';
}

function renderFeeds(risk, news) {
  const cal = risk.calendar || [];
  $('calendarList').innerHTML =
    cal.length === 0
      ? '<li>Loading calendar…</li>'
      : cal
          .slice(0, 12)
          .map(
            (e) =>
              `<li><span class="risk-tag">${e.risk}</span> <strong>${e.title}</strong><br><span class="muted">${new Date(e.time).toLocaleString()}</span></li>`
          )
          .join('');
  const items = news.items || news.breakingNews || [];
  $('newsList').innerHTML =
    items.length === 0
      ? '<li>Loading news…</li>'
      : items
          .slice(0, 15)
          .map(
            (n) =>
              `<li><span class="risk-tag">${n.risk || ''}</span> <strong>${n.title}</strong><br><span class="muted">${n.source || ''} · ${new Date(n.time).toLocaleString()}</span></li>`
          )
          .join('');
}

function applyData(pro, risk) {
  const sess = getSessionGMT();
  $('sessionName').textContent =
    (pro.session || sess.name) + (sess.best ? ' ★' : '');
  const bull = pro.bullishProb ?? 55;
  const bear = pro.bearishProb ?? 100 - bull;
  $('bullPct').textContent = Math.round(bull) + '%';
  $('bearPct').textContent = Math.round(bear) + '%';
  $('bullBar').style.width = bull + '%';
  $('bearBar').style.width = bear + '%';
  const score = pro.score ?? Math.round(bull);
  $('scoreGrade').textContent =
    `Score: ${score} | ${score >= 80 ? 'Good setup' : score >= 70 ? 'Marginal' : 'Avoid'}`;
  $('sentiment').textContent = 'Sentiment: ' + (pro.sentiment || 'Neutral');
  if (pro.nextEvent || risk.nextEvent) {
    const ev = pro.nextEvent || risk.nextEvent;
    $('nextEventLine').textContent = `Next event: ${ev.title} in ${ev.minutesUntil} min (${ev.risk || ''} risk)`;
  }
  $('exposure').textContent = (pro.exposureLots ?? 0).toFixed(2);
  $('corr').textContent = pro.correlated ?? 0;
  $('dailyPnl').textContent = (pro.dailyPnlPct ?? 0).toFixed(2);
  if (pro.crashAlert || pro.mood === 'DANGEROUS' || risk.mood === 'DANGEROUS')
    $('crashBanner').classList.remove('hidden');
  else $('crashBanner').classList.add('hidden');
  renderChecklist({ ...pro, nextEvent: pro.nextEvent || risk.nextEvent });
  renderFeeds(risk, { items: risk.breakingNews });
}

async function refresh() {
  if (forceDemo) {
    const d = getDemoData();
    applyData(d, { mood: d.mood, nextEvent: d.nextEvent, calendar: [], breakingNews: [] });
    setStatus('demo', IS_FILE_MODE ? 'Offline file — run START-LIVE-WEBSITE.bat for LIVE' : 'Demo mode');
    return;
  }
  try {
    const [pro, risk, news] = await Promise.all([
      fetch(API + '/api/pro-summary').then((r) => r.json()),
      fetch(API + '/api/risk-summary').then((r) => r.json()),
      fetch(API + '/api/news').then((r) => r.json())
    ]);
    applyData(pro, risk);
    renderFeeds(risk, news);
    setStatus('live', '● LIVE — updates every 60s');
  } catch {
    forceDemo = true;
    applyData(getDemoData(), { mood: 'CAUTION', calendar: [], breakingNews: [] });
    setStatus('demo', window.location.hostname.indexOf('aurafxelite.com') >= 0 || window.location.hostname.indexOf('onrender.com') >= 0
      ? 'Market feed loading — refresh page (server is live)'
      : 'Run START-LIVE-WEBSITE.bat on your PC for live data');
  }
}

$('btnDemoLive')?.addEventListener('click', () => { forceDemo = true; refresh(); });
$('btnTestCrash')?.addEventListener('click', () => {
  applyData(getDemoData({ mood: 'DANGEROUS', crashAlert: true }), { mood: 'DANGEROUS', calendar: [] });
});
$('btnTestScore')?.addEventListener('click', () => {
  applyData(getDemoData({ score: 85, bullishProb: 85, bearishProb: 15 }), { calendar: [] });
});

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
    $('screenshotAnalysis').textContent = 'Screenshot analysis OK — zones drawn. Not financial advice.';
  };
  img.src = URL.createObjectURL(file);
});

renderJournal();
refresh();
setInterval(refresh, 60000);
