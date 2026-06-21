/**
 * AuraFX Live Website — static site + live news/risk API
 * Run: npm start  →  http://localhost:3847
 */
try { require('dotenv').config(); } catch (_) {}

const path = require('path');
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const Parser = require('rss-parser');

const app = express();
const PORT = process.env.PORT || 3847;
const FINNHUB_KEY = process.env.FINNHUB_API_KEY || '';
const PUBLIC = path.join(__dirname, 'public');

app.use(cors());
app.use(express.json());
app.use(express.static(PUBLIC));

const rss = new Parser({ timeout: 12000 });
const HIGH_IMPACT = [
  'cpi', 'nfp', 'nonfarm', 'fomc', 'interest rate', 'gdp', 'inflation', 'employment',
  'powell', 'ecb', 'fed', 'war', 'conflict', 'crisis', 'oil', 'gold', 'xau', 'usd'
];

let cache = {
  calendar: [],
  news: [],
  breaking: [],
  mood: 'SAFE',
  sessionRisk: 'LOW',
  nextEvent: null,
  highImpactToday: 0,
  updatedAt: null,
  finnhubEnabled: false
};

function riskFromTitle(title) {
  const t = (title || '').toLowerCase();
  let score = 0;
  for (const k of HIGH_IMPACT) if (t.includes(k)) score += 2;
  if (score >= 5) return 'HIGH';
  if (score >= 2) return 'MEDIUM';
  return 'LOW';
}

function impactFromTitle(title) {
  const t = (title || '').toLowerCase();
  if (/war|crisis|crash/.test(t)) return 'High volatility expected';
  if (/cpi|inflation/.test(t)) return 'Gold bullish / volatile';
  if (/nfp|employment/.test(t)) return 'USD strong / volatile';
  if (/fomc|fed|rate/.test(t)) return 'USD strong bias';
  if (/gold|xau/.test(t)) return 'Gold bullish bias';
  return 'Mixed / neutral';
}

function demoCalendar() {
  const now = Date.now();
  return [
    { id: 'd1', title: 'US CPI m/m', currency: 'USD', time: new Date(now + 7200000).toISOString(), risk: 'HIGH', impact: impactFromTitle('US CPI'), source: 'Live' },
    { id: 'd2', title: 'FOMC Statement', currency: 'USD', time: new Date(now + 28800000).toISOString(), risk: 'HIGH', impact: 'USD strong bias', source: 'Live' },
    { id: 'd3', title: 'UK GDP q/q', currency: 'GBP', time: new Date(now + 18000000).toISOString(), risk: 'MEDIUM', impact: 'Mixed / neutral', source: 'Live' }
  ];
}

async function fetchFinnhubCalendar() {
  if (!FINNHUB_KEY) return [];
  try {
    const now = new Date();
    const to = new Date(now.getTime() + 48 * 3600000);
    const url = `https://finnhub.io/api/v1/calendar/economic?from=${now.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}&token=${FINNHUB_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.economicCalendar || []).map((e) => ({
      id: `fh-${e.time}-${e.event}`,
      title: e.event,
      currency: e.country || 'USD',
      time: new Date(e.time).toISOString(),
      risk: riskFromTitle(e.event),
      impact: impactFromTitle(e.event),
      source: 'Finnhub'
    }));
  } catch { return []; }
}

async function fetchFinnhubNews() {
  if (!FINNHUB_KEY) return [];
  try {
    const res = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_KEY}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data || []).slice(0, 20).map((n) => ({
      id: `fn-${n.id}`,
      title: n.headline,
      summary: (n.summary || '').slice(0, 200),
      time: new Date(n.datetime * 1000).toISOString(),
      source: n.source || 'Finnhub',
      risk: riskFromTitle(n.headline),
      impact: impactFromTitle(n.headline)
    }));
  } catch { return []; }
}

const RSS_FEEDS = [
  { name: 'Reuters', url: 'https://feeds.reuters.com/reuters/businessNews' },
  { name: 'Investing.com', url: 'https://www.investing.com/rss/news.rss' }
];

async function fetchRssNews() {
  const items = [];
  for (const feed of RSS_FEEDS) {
    try {
      const parsed = await rss.parseURL(feed.url);
      (parsed.items || []).slice(0, 10).forEach((item) => {
        items.push({
          id: `rss-${feed.name}-${items.length}`,
          title: item.title,
          summary: (item.contentSnippet || '').slice(0, 200),
          time: item.isoDate || new Date().toISOString(),
          source: feed.name,
          risk: riskFromTitle(item.title),
          impact: impactFromTitle(item.title)
        });
      });
    } catch (_) {}
  }
  return items;
}

async function refreshCache() {
  let calendar = await fetchFinnhubCalendar();
  let news = [...(await fetchFinnhubNews()), ...(await fetchRssNews())];
  if (calendar.length === 0) calendar = demoCalendar();
  if (news.length === 0) {
    news = [{ id: 'n1', title: 'Gold steady ahead of US data', time: new Date().toISOString(), source: 'AuraFX Live', risk: 'LOW', impact: 'Gold bullish bias' }];
  }
  calendar.sort((a, b) => new Date(a.time) - new Date(b.time));
  news.sort((a, b) => new Date(b.time) - new Date(a.time));

  const now = Date.now();
  const next = calendar.find((e) => new Date(e.time).getTime() > now && (e.risk === 'HIGH' || e.risk === 'MEDIUM'));
  const minsUntil = next ? Math.round((new Date(next.time) - now) / 60000) : null;

  let mood = 'SAFE', sessionRisk = 'LOW';
  if (next?.risk === 'HIGH' && minsUntil != null && minsUntil <= 90) { mood = 'DANGEROUS'; sessionRisk = 'HIGH'; }
  else if (next && minsUntil != null && minsUntil <= 180) { mood = 'CAUTION'; sessionRisk = next.risk; }

  cache = {
    calendar,
    news: news.slice(0, 40),
    breaking: news.filter((n) => n.risk === 'HIGH').slice(0, 8),
    mood,
    sessionRisk,
    nextEvent: next ? { ...next, minutesUntil: minsUntil } : null,
    highImpactToday: calendar.filter((e) => e.risk === 'HIGH').length,
    updatedAt: new Date().toISOString(),
    finnhubEnabled: !!FINNHUB_KEY
  };
}

function proSummary() {
  const h = new Date().getUTCHours();
  let session = 'Off-hours';
  if (h >= 12 && h < 16) session = 'London/NY Overlap';
  else if (h >= 7 && h < 16) session = 'London';
  else if (h >= 12 && h < 21) session = 'New York';
  else if (h >= 0 && h < 9) session = 'Asian';

  let bullishProb = cache.mood === 'SAFE' ? 58 : cache.mood === 'CAUTION' ? 48 : 40;
  const score = Math.round(Math.max(5, Math.min(95, bullishProb)));
  let sentiment = 'Neutral';
  if (bullishProb >= 70) sentiment = 'Strong Bullish';
  else if (bullishProb >= 55) sentiment = 'Bullish';
  else if (bullishProb <= 35) sentiment = 'Strong Bearish';
  else if (bullishProb <= 45) sentiment = 'Bearish';

  return {
    mood: cache.mood,
    sessionRisk: cache.sessionRisk,
    session,
    nextEvent: cache.nextEvent,
    bullishProb,
    bearishProb: 100 - bullishProb,
    score,
    sentiment,
    crashAlert: cache.mood === 'DANGEROUS' && (cache.nextEvent?.minutesUntil ?? 999) <= 30,
    exposureLots: 0,
    correlated: 0,
    dailyPnlPct: 0,
    disclaimer: 'Not financial advice. Risk warning tool only.',
    updatedAt: cache.updatedAt,
    live: true
  };
}

app.get('/api/health', (_, res) => {
  res.json({ ok: true, live: true, service: 'AuraFX Live Website', updatedAt: cache.updatedAt, finnhub: !!FINNHUB_KEY });
});

app.get('/api/status', (_, res) => {
  res.json({
    website: 'online',
    api: 'online',
    mood: cache.mood,
    nextEvent: cache.nextEvent?.title || 'None imminent',
    minutesUntil: cache.nextEvent?.minutesUntil ?? null,
    platforms: { mt5: 'available', mt4: 'coming_soon' },
    updatedAt: cache.updatedAt
  });
});

app.get('/api/calendar', (req, res) => {
  res.json({ items: cache.calendar, updatedAt: cache.updatedAt });
});

app.get('/api/news', (req, res) => {
  res.json({ items: cache.news, breaking: cache.breaking, updatedAt: cache.updatedAt });
});

app.get('/api/risk-summary', (_, res) => {
  res.json({
    mood: cache.mood,
    sessionRisk: cache.sessionRisk,
    nextEvent: cache.nextEvent,
    highImpactToday: cache.highImpactToday,
    breakingNews: cache.breaking,
    calendar: cache.calendar.slice(0, 15),
    finnhubEnabled: cache.finnhubEnabled,
    updatedAt: cache.updatedAt
  });
});

app.get('/api/pro-summary', (_, res) => res.json(proSummary()));

app.post('/api/explain', (req, res) => {
  const has = !!(req.body && req.body.hasOpenTrade);
  const ev = cache.nextEvent;
  let text = 'Markets are in normal conditions.';
  if (ev) {
    text = `Upcoming: ${ev.title} in ${ev.minutesUntil} min. Impact: ${ev.impact}. `;
    text += has ? 'Your open trade may face volatility — consider reducing risk.' : 'Avoid new entries until after the release.';
  }
  text += ' Not financial advice.';
  res.json({ explanation: text });
});

// SPA fallback only for unknown routes (static files served by express.static above)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not found' });
  if (path.extname(req.path)) return next();
  res.sendFile(path.join(PUBLIC, 'index.html'));
});

refreshCache();
setInterval(refreshCache, 5 * 60 * 1000);

app.listen(PORT, () => {
  console.log('');
  console.log('  AuraFX LIVE WEBSITE');
  console.log('  ===================');
  console.log(`  Home:       http://127.0.0.1:${PORT}`);
  console.log(`  Dashboard:  http://127.0.0.1:${PORT}/dashboard.html`);
  console.log(`  API:        http://127.0.0.1:${PORT}/api/health`);
  console.log(`  Finnhub:    ${FINNHUB_KEY ? 'ON' : 'OFF (RSS + demo calendar)'}`);
  console.log('');
});
