const API_BASE = localStorage.getItem('aurafx_api') || 'http://127.0.0.1:3847';
const POLL_MS = 45000;
const IGNORE_KEY = 'aurafx_ignore_until';

let soundOn = true;
let lastAlertKey = '';
let ignoreUntil = parseInt(localStorage.getItem(IGNORE_KEY) || '0', 10);

const $ = (id) => document.getElementById(id);

function playAlertSound() {
  if (!soundOn) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch (_) {
    $('alertSound')?.play?.().catch(() => {});
  }
}

async function pushNotify(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body, requireInteraction: true, tag: 'aurafx-risk' });
    n.onclick = () => { window.focus(); n.close(); };
  } catch (_) {}
}

function showOverlay(title, body) {
  $('alertTitle').textContent = title;
  $('alertBody').textContent = body;
  $('alertOverlay').classList.remove('hidden');
  playAlertSound();
  pushNotify(title, body);
  document.title = '⚠ ' + title;
}

function hideOverlay() {
  $('alertOverlay').classList.add('hidden');
  document.title = 'AuraFX Risk Guardian';
}

function getTradeState() {
  const has = $('hasTrade').checked;
  const entry = parseFloat($('tradeEntry').value) || 0;
  const current = parseFloat($('tradeCurrent').value) || 0;
  const dir = $('tradeDir').value;
  const lots = parseFloat($('tradeLots').value) || 0;
  let adverse = false;
  if (has && entry > 0 && current > 0) {
    adverse = dir === 'BUY' ? current < entry : current > entry;
  }
  return { has, entry, current, dir, lots, adverse, symbol: $('tradeSymbol').value.trim() };
}

function updateExposureUI(trade) {
  if (!trade.has) {
    $('exposureSummary').textContent = 'No open trade logged — enter details if you have a position.';
    $('lossRisk').textContent = '';
    return;
  }
  const pips = trade.entry && trade.current
    ? Math.abs((trade.current - trade.entry) * (trade.symbol.includes('JPY') ? 100 : 10000))
    : 0;
  $('exposureSummary').textContent =
    `${trade.symbol} ${trade.dir} ${trade.lots} lots @ ${trade.entry || '—'} | Now ${trade.current || '—'}`;
  if (trade.adverse) {
    $('lossRisk').textContent =
      'Trade risk increasing. Possible fund loss. Check position now.';
  } else {
    $('lossRisk').textContent = '';
  }
}

function setMood(mood) {
  const badge = $('moodBadge');
  badge.textContent = mood;
  badge.className = 'mood-badge ' + mood.toLowerCase();
  document.querySelectorAll('.mood-seg').forEach((el) => {
    el.classList.toggle('active', el.dataset.mood === mood);
  });
  const hero = $('riskHero');
  hero.classList.remove('dangerous', 'caution', 'safe');
  hero.classList.add(mood.toLowerCase());
}

function formatCountdown(mins) {
  if (mins == null) return 'No imminent event';
  if (mins < 60) return `${mins}m until event`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m until event`;
}

function renderCalendar(items) {
  const ul = $('calendarList');
  if (!items?.length) {
    ul.innerHTML = '<li>No calendar data — start news-risk-server</li>';
    return;
  }
  ul.innerHTML = items
    .slice(0, 20)
    .map((e) => {
      const t = new Date(e.time).toLocaleString();
      const rc = e.risk === 'HIGH' ? 'risk-high' : e.risk === 'MEDIUM' ? 'risk-medium' : '';
      return `<li><span class="${rc}">${e.risk} RISK</span> <strong>${e.title}</strong><br>
        <span class="time">${t} · ${e.currency} · ${e.impact}</span></li>`;
    })
    .join('');
}

function renderNews(items) {
  const ul = $('newsList');
  if (!items?.length) {
    ul.innerHTML = '<li>Waiting for news feed...</li>';
    return;
  }
  ul.innerHTML = items
    .slice(0, 15)
    .map((n) => {
      const rc = n.risk === 'HIGH' ? 'risk-high' : n.risk === 'MEDIUM' ? 'risk-medium' : '';
      return `<li><span class="${rc}">${n.risk}</span> <strong>${n.title}</strong><br>
        <span class="time">${n.source} · ${new Date(n.time).toLocaleString()}</span></li>`;
    })
    .join('');
}

async function fetchSummary() {
  try {
    const res = await fetch(`${API_BASE}/api/risk-summary`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (err) {
    $('serverStatus').textContent = 'Offline';
    return null;
  }
}

async function fetchExplanation() {
  const trade = getTradeState();
  try {
    const res = await fetch(`${API_BASE}/api/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hasOpenTrade: trade.has })
    });
    if (!res.ok) throw new Error('explain failed');
    const data = await res.json();
    $('aiExplanation').textContent = data.explanation || data.disclaimer;
  } catch (_) {
    $('aiExplanation').textContent =
      'Start news-risk-server (npm start) for live AI-style explanations.\n' +
      'This is not financial advice. Final decision is yours.';
  }
}

function checkAlerts(data) {
  if (Date.now() < ignoreUntil) return;
  const trade = getTradeState();
  const next = data.nextEvent;
  const key = next ? `${next.id}-${next.minutesUntil}` : 'none';

  if (next && next.risk === 'HIGH' && next.minutesUntil != null && next.minutesUntil <= 90) {
    if (trade.has && key !== lastAlertKey) {
      lastAlertKey = key;
      showOverlay(
        'HIGH RISK — NEWS INCOMING',
        `High-impact news in ${next.minutesUntil} minutes: ${next.title}.\n` +
          `Market may become volatile. Consider closing, reducing lot size, or moving stop loss.\n` +
          `Expected impact: ${next.impact}`
      );
    }
  }

  if (trade.has && trade.adverse) {
    const ak = `adverse-${trade.symbol}-${trade.current}`;
    if (ak !== lastAlertKey) {
      lastAlertKey = ak;
      showOverlay(
        'TRADE RISK INCREASING',
        'Price is moving against your position. Possible fund loss. Check position now.\n' +
          'Choose an action below — the app will NOT auto-close your trade.'
      );
    }
  }

  const breaking = data.breakingNews?.[0];
  if (breaking?.risk === 'HIGH' && !trade.has) {
    const bk = 'news-' + breaking.id;
    if (bk !== lastAlertKey) {
      lastAlertKey = bk;
      pushNotify('Breaking: ' + breaking.title, breaking.impact || '');
      playAlertSound();
    }
  }
}

async function refresh() {
  const data = await fetchSummary();
  if (!data) return;

  $('serverStatus').textContent = data.finnhubEnabled ? 'Live + Finnhub' : 'Live (RSS)';
  $('hiToday').textContent = data.highImpactToday ?? 0;

  setMood(data.mood || 'SAFE');
  const risk = data.sessionRisk || 'LOW';
  const rl = $('sessionRisk');
  rl.textContent = risk + ' RISK';
  rl.className = 'risk-level ' + risk.toLowerCase();

  if (data.nextEvent) {
    $('nextEventText').textContent = `Next: ${data.nextEvent.title} (${data.nextEvent.currency})`;
    $('impactText').textContent = `Expected impact: ${data.nextEvent.impact}`;
    $('countdown').textContent = formatCountdown(data.nextEvent.minutesUntil);
  } else {
    $('nextEventText').textContent = 'No high-impact event in warning window';
    $('impactText').textContent = '';
    $('countdown').textContent = '—';
  }

  renderCalendar(data.calendar || []);
  let newsItems = data.breakingNews || [];
  try {
    const nr = await fetch(`${API_BASE}/api/news`);
    if (nr.ok) {
      const nd = await nr.json();
      newsItems = [...(nd.items || []), ...newsItems];
    }
  } catch (_) {}
  renderNews(newsItems);

  const trade = getTradeState();
  updateExposureUI(trade);
  checkAlerts(data);
}

document.querySelectorAll('.btn-action').forEach((btn) => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action;
    let msg = '';
    if (action === 'close') msg = 'You chose CLOSE TRADE — execute manually in MT5 or your broker app.';
    if (action === 'reduce') msg = 'You chose REDUCE LOT — modify position size manually.';
    if (action === 'sl') msg = 'You chose MOVE STOP LOSS — adjust SL in MT5.';
    if (action === 'ignore') {
      ignoreUntil = Date.now() + 30 * 60 * 1000;
      localStorage.setItem(IGNORE_KEY, String(ignoreUntil));
      msg = 'Warnings snoozed for 30 minutes.';
    }
    alert(msg + '\n\nNot financial advice. Final decision is yours.');
    hideOverlay();
  });
});

$('btnNotify').addEventListener('click', async () => {
  if (!('Notification' in window)) return alert('Notifications not supported');
  const p = await Notification.requestPermission();
  alert(p === 'granted' ? 'Notifications enabled' : 'Notifications denied');
});

$('btnSound').addEventListener('click', () => {
  soundOn = !soundOn;
  $('btnSound').classList.toggle('on', soundOn);
  $('btnSound').textContent = soundOn ? '🔊' : '🔇';
});

['tradeSymbol', 'tradeDir', 'tradeLots', 'tradeEntry', 'tradeCurrent', 'hasTrade'].forEach((id) => {
  $(id).addEventListener('input', () => {
    updateExposureUI(getTradeState());
    fetchExplanation();
  });
});

$('btnRefreshAi').addEventListener('click', fetchExplanation);

refresh();
fetchExplanation();
setInterval(refresh, POLL_MS);

// Keep dashboard alive in background (visibility)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refresh();
});
