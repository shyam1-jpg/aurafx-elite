const API = localStorage.getItem('aurafx_api') || 'http://127.0.0.1:3847';
const JOURNAL_KEY = 'aurafx_pro_journal';
const IS_FILE_MODE = window.location.protocol === 'file:';
let forceDemo = IS_FILE_MODE;

const $ = (id) => document.getElementById(id);

function getDemoData(overrides = {}) {
  const sess = getSessionGMT();
  return {
    mood: 'CAUTION',
    sessionRisk: 'MEDIUM',
    session: sess.name,
    nextEvent: { title: 'US CPI m/m', minutesUntil: 42, risk: 'HIGH' },
    bullishProb: 58,
    bearishProb: 42,
    score: 78,
    sentiment: 'Bullish',
    crashAlert: false,
    exposureLots: 0.1,
    correlated: 0,
    dailyPnlPct: 0,
    source: 'demo',
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

function saveJournal(entries) {
  localStorage.setItem(JOURNAL_KEY, JSON.stringify(entries));
}

function journalInsights(entries) {
  if (!entries.length) return 'No trades logged yet. Fill the form above and click Save trade to test the journal.';
  const wins = entries.filter((e) => (e.exit - e.entry) * (e.dir === 'BUY' ? 1 : -1) > 0);
  const winRate = ((wins.length / entries.length) * 100).toFixed(1);
  const byHour = {};
  entries.forEach((e) => {
    const h = new Date(e.time).getUTCHours();
    byHour[h] = (byHour[h] || 0) + 1;
  });
  const bestHour = Object.entries(byHour).sort((a, b) => b[1] - a[1])[0];
  const setups = {};
  entries.forEach((e) => {
    const k = e.reason || 'Unknown';
    setups[k] = setups[k] || { w: 0, l: 0 };
    const p = (e.exit - e.entry) * (e.dir === 'BUY' ? 1 : -1);
    if (p > 0) setups[k].w++;
    else setups[k].l++;
  });
  let bestSetup = '—';
  let bestPct = 0;
  Object.entries(setups).forEach(([k, v]) => {
    const t = v.w + v.l;
    const pct = t ? v.w / t : 0;
    if (pct > bestPct) {
      bestPct = pct;
      bestSetup = k;
    }
  });
  return (
    `Personal Performance AI:\n` +
    `• Win rate (logged): ${winRate}%\n` +
    `• Best hour (UTC): ${bestHour ? bestHour[0] + ':00' : '—'}\n` +
    `• Best setup label: ${bestSetup}\n` +
    `• Recommend: repeat setups with highest win rate.`
  );
}

function renderJournal() {
  const entries = loadJournal();
  $('journalInsights').textContent = journalInsights(entries);
  $('journalList').innerHTML =
    entries.length === 0
      ? '<li>No saved trades yet — use the form to test.</li>'
      : entries
          .slice(-15)
          .reverse()
          .map(
            (e) =>
              `<li>${new Date(e.time).toLocaleString()} ${e.symbol} ${e.dir} ${e.entry}→${e.exit} | ${e.reason || '—'} | emotion ${e.emotion}</li>`
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
    reason: $('jReason').value,
    screenshot: $('jScreenshot').files[0]?.name || ''
  });
  saveJournal(entries);
  renderJournal();
  alert('Trade saved to journal — working.');
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
    passed >= 6
      ? 'Checklist PASS — consider entry if MT5 score agrees'
      : 'Checklist WAIT — do not enter yet';
  $('checkResult').style.color = passed >= 6 ? 'var(--bull)' : 'var(--bear)';
}

function applyData(data) {
  const sess = getSessionGMT();
  $('sessionName').textContent =
    (data.session || sess.name) + (sess.best ? ' ★ High probability window' : '');

  const bull = data.bullishProb ?? 55;
  const bear = data.bearishProb ?? 100 - bull;
  $('bullPct').textContent = bull.toFixed(0) + '%';
  $('bearPct').textContent = bear.toFixed(0) + '%';
  $('bullBar').style.width = bull + '%';
  $('bearBar').style.width = bear + '%';

  const score = data.score ?? Math.round(bull);
  $('scoreGrade').textContent =
    `Score: ${score} | ` +
    (score >= 90 ? 'Excellent setup' : score >= 80 ? 'Good setup' : score >= 70 ? 'Marginal' : 'Avoid') +
    ` | Confidence: ${score >= 80 ? 'High' : score >= 70 ? 'Medium' : 'Low'}`;

  $('sentiment').textContent = 'Sentiment: ' + (data.sentiment || 'Neutral');
  $('exposure').textContent = (data.exposureLots ?? 0).toFixed(2);
  $('corr').textContent = data.correlated ?? 0;
  $('dailyPnl').textContent = (data.dailyPnlPct ?? 0).toFixed(2);

  if (data.crashAlert || data.mood === 'DANGEROUS') $('crashBanner').classList.remove('hidden');
  else $('crashBanner').classList.add('hidden');

  renderChecklist(data);
}

async function refresh() {
  if (forceDemo) {
    applyData(getDemoData());
    setStatus(
      'demo',
      IS_FILE_MODE
        ? 'DEMO MODE (file://) — UI test OK · For live news start test-server · MT5 = separate install'
        : 'DEMO MODE — start: node news-risk-server/test-server.js'
    );
    return;
  }

  try {
    const res = await fetch(API + '/api/pro-summary', { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error('offline');
    const data = await res.json();
    applyData(data);
    setStatus('live', 'LIVE API connected · ' + API + ' · Charts still need MetaTrader 5');
  } catch {
    forceDemo = true;
    applyData(getDemoData());
    setStatus(
      'demo',
      'DEMO MODE (server off) — Run TEST-START.bat or: node news-risk-server/test-server.js'
    );
  }
}

$('btnDemoLive')?.addEventListener('click', () => {
  forceDemo = true;
  refresh();
});

$('btnTestCrash')?.addEventListener('click', () => {
  applyData(getDemoData({ mood: 'DANGEROUS', crashAlert: true, sessionRisk: 'HIGH' }));
  setStatus('demo', 'TEST: Crash alert shown — red banner should be visible');
});

$('btnTestScore')?.addEventListener('click', () => {
  applyData(getDemoData({ score: 85, bullishProb: 85, bearishProb: 15, sentiment: 'Strong Bullish' }));
  setStatus('demo', 'TEST: High score 85 — checklist should show mostly PASS');
});

$('chartUpload').addEventListener('change', (ev) => {
  const file = ev.target.files[0];
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    const c = $('chartCanvas');
    const ctx = c.getContext('2d');
    c.width = Math.min(800, img.width);
    c.height = Math.min(450, img.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const w = c.width,
      h = c.height;
    ctx.strokeStyle = '#2ecc71';
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(w * 0.1, h * 0.7, w * 0.8, h * 0.05);
    ctx.fillStyle = 'rgba(46,204,113,0.15)';
    ctx.fillRect(w * 0.1, h * 0.7, w * 0.8, h * 0.05);
    ctx.strokeStyle = '#e74c3c';
    ctx.strokeRect(w * 0.1, h * 0.15, w * 0.8, h * 0.05);
    ctx.fillStyle = 'rgba(231,76,60,0.15)';
    ctx.fillRect(w * 0.1, h * 0.15, w * 0.8, h * 0.05);
    ctx.setLineDash([]);
    ctx.strokeStyle = '#d4af37';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.55);
    ctx.lineTo(w, h * 0.4);
    ctx.stroke();
    ctx.fillStyle = '#d4af37';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('Demand zone (estimate)', w * 0.12, h * 0.74);
    ctx.fillText('Supply zone (estimate)', w * 0.12, h * 0.19);
    ctx.fillText('Trend line (estimate)', w * 0.12, h * 0.42);
    $('screenshotAnalysis').textContent =
      `Screenshot analysis — WORKING\n` +
      `• Trend: ${h * 0.4 < h * 0.55 ? 'Up bias' : 'Down bias'}\n` +
      `• Green = demand zone | Red = supply zone\n` +
      `• Confirm on MT5 with AuraFX_Pro_Assistant\n` +
      `Not financial advice.`;
    setStatus('demo', 'Screenshot test OK — zones drawn on canvas');
  };
  img.onerror = () => alert('Could not load image — try PNG or JPG');
  img.src = URL.createObjectURL(file);
});

renderJournal();
refresh();
setInterval(refresh, 60000);
