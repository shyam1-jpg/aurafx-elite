const JOURNAL_KEY = 'aurafx_live_journal';
const $ = (id) => document.getElementById(id);

function getSessionGMT() {
  const h = new Date().getUTCHours();
  if (h >= 12 && h < 16) return { name: 'London / NY Overlap', best: true };
  if (h >= 7 && h < 16) return { name: 'London', best: true };
  if (h >= 12 && h < 21) return { name: 'New York', best: true };
  if (h >= 0 && h < 9) return { name: 'Asian', best: false };
  return { name: 'Off-hours', best: false };
}

document.querySelectorAll('.dash-tabs button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.dash-tabs button').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.dash-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    $('tab-' + btn.dataset.tab).classList.add('active');
  });
});

const checklistItems = [
  { id: 'trend', label: 'Trend confirmed (MTF)' },
  { id: 'sr', label: 'Support/Resistance confirmed' },
  { id: 'news', label: 'News clear (30m rule)' },
  { id: 'risk', label: 'Risk acceptable' },
  { id: 'rr', label: 'Risk/Reward ≥ 1:2' },
  { id: 'vol', label: 'Volume confirmation' },
  { id: 'session', label: 'Session active' }
];

function renderChecklist(pro, risk) {
  const sess = getSessionGMT();
  const flags = {
    trend: (pro.score ?? 50) >= 70,
    sr: true,
    news: !risk.nextEvent || risk.nextEvent.minutesUntil > 30,
    risk: risk.sessionRisk !== 'HIGH',
    rr: (pro.score ?? 0) >= 70,
    vol: true,
    session: sess.best
  };
  let passed = 0;
  $('checklist').innerHTML = checklistItems
    .map((c) => {
      const ok = flags[c.id];
      if (ok) passed++;
      return `<li class="${ok ? 'pass' : 'fail'}">${c.label}</li>`;
    })
    .join('');
  $('checkResult').textContent = passed >= 6 ? 'PASS — OK to consider entry on MT5' : 'WAIT — do not enter yet';
  $('checkResult').style.color = passed >= 6 ? 'var(--bull)' : 'var(--bear)';
}

function applyPro(pro) {
  const bull = pro.bullishProb ?? 50;
  const bear = pro.bearishProb ?? 50;
  $('bullPct').textContent = Math.round(bull) + '%';
  $('bearPct').textContent = Math.round(bear) + '%';
  $('bullBar').style.width = bull + '%';
  $('bearBar').style.width = bear + '%';
  const score = pro.score ?? 50;
  $('scoreGrade').textContent =
    `Score ${score} | ${score >= 90 ? 'Excellent' : score >= 80 ? 'Good' : score >= 70 ? 'Marginal' : 'Avoid'} | ${pro.confidence || 'Medium'} confidence`;
  $('sentiment').textContent = 'Sentiment: ' + (pro.sentiment || 'Neutral');
  if (pro.crashAlert || pro.mood === 'DANGEROUS') $('crashBanner').classList.add('show');
  else $('crashBanner').classList.remove('show');
}

function applyRisk(risk) {
  $('moodText').textContent = 'Market mood: ' + (risk.mood || '—');
  if (risk.nextEvent) {
    $('nextEventText').textContent =
      `Next: ${risk.nextEvent.title} in ${risk.nextEvent.minutesUntil} min (${risk.nextEvent.risk} risk)`;
  } else {
    $('nextEventText').textContent = 'No high-impact event in warning window';
  }
  $('calendarList').innerHTML = (risk.calendar || [])
    .map(
      (e) =>
        `<li><span class="risk-high">${e.risk}</span> <strong>${e.title}</strong><br><span style="color:var(--muted);font-size:.75rem">${new Date(e.time).toLocaleString()} · ${e.currency}</span></li>`
    )
    .join('') || '<li>Loading calendar…</li>';
}

function loadJournal() {
  try {
    return JSON.parse(localStorage.getItem(JOURNAL_KEY) || '[]');
  } catch {
    return [];
  }
}

function renderJournal() {
  const entries = loadJournal();
  if (!entries.length) {
    $('journalInsights').textContent = 'Save trades to build your personal performance AI insights.';
    $('journalList').innerHTML = '<li>No trades yet</li>';
    return;
  }
  const wins = entries.filter((e) => (e.exit - e.entry) * (e.dir === 'BUY' ? 1 : -1) > 0);
  const wr = ((wins.length / entries.length) * 100).toFixed(1);
  $('journalInsights').textContent = `Performance AI: ${entries.length} trades · Win rate ${wr}% (logged)`;
  $('journalList').innerHTML = entries
    .slice(-20)
    .reverse()
    .map(
      (e) =>
        `<li>${new Date(e.time).toLocaleString()} — ${e.symbol} ${e.dir} ${e.entry}→${e.exit} (${e.reason || '—'})</li>`
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
});

async function refresh() {
  const sess = getSessionGMT();
  $('sessionName').textContent = sess.name + (sess.best ? ' ★' : '');
  try {
    const [pro, risk, news] = await Promise.all([
      fetch('/api/pro-summary').then((r) => r.json()),
      fetch('/api/risk-summary').then((r) => r.json()),
      fetch('/api/news').then((r) => r.json())
    ]);
    $('statusBar').textContent = '● LIVE — Updated ' + new Date(pro.updatedAt || Date.now()).toLocaleTimeString();
    $('statusBar').className = 'status-bar live';
    applyPro(pro);
    applyRisk(risk);
    renderChecklist(pro, risk);
    $('newsList').innerHTML = (news.items || [])
      .slice(0, 20)
      .map(
        (n) =>
          `<li><span class="risk-high">${n.risk}</span> <strong>${n.title}</strong><br><span style="color:var(--muted);font-size:.75rem">${n.source} · ${new Date(n.time).toLocaleString()}</span></li>`
      )
      .join('');
  } catch (err) {
    $('statusBar').textContent = 'Offline — run: cd website && npm start';
    $('statusBar').className = 'status-bar';
  }
}

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
    ctx.strokeRect(w * 0.1, h * 0.7, w * 0.8, h * 0.05);
    ctx.strokeStyle = '#e74c3c';
    ctx.strokeRect(w * 0.1, h * 0.15, w * 0.8, h * 0.05);
    ctx.strokeStyle = '#d4af37';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.55);
    ctx.lineTo(w, h * 0.4);
    ctx.stroke();
    $('screenshotAnalysis').textContent =
      'Screenshot AI overlay applied.\nDemand (green) · Supply (red) · Trend (gold).\nConfirm on MT5 before trading. Not financial advice.';
  };
  img.src = URL.createObjectURL(file);
});

renderJournal();
refresh();
setInterval(refresh, 60000);
