/**
 * AuraFX News & Risk Server
 * Aggregates economic calendar + financial RSS + Finnhub (optional API key)
 * Serves risk dashboard and MT5 WebRequest clients
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const Parser = require('rss-parser');

const app = express();
const PORT = process.env.PORT || 3847;
const FINNHUB_KEY = process.env.FINNHUB_API_KEY || '';

app.use(cors());
app.use(express.json());

const rss = new Parser({ timeout: 12000 });
const HIGH_IMPACT = [
  'cpi', 'nfp', 'nonfarm', 'fomc', 'interest rate', 'rate decision', 'gdp', 'pce',
  'inflation', 'employment', 'powell', 'lagarde', 'ecb', 'boe', 'fed', 'war',
  'conflict', 'crisis', 'sanction', 'oil', 'gold', 'xau', 'usd', 'treasury'
];

let cache = {
  calendar: [],
  news: [],
  mood: 'SAFE',
  sessionRisk: 'LOW',
  nextEvent: null,
  updatedAt: null
};

function riskFromTitle(title, impactHint) {
  const t = (title || '').toLowerCase();
  let score = 0;
  for (const k of HIGH_IMPACT) if (t.includes(k)) score += 2;
  if (impactHint === 'high' || impactHint === 3) score += 3;
  if (impactHint === 'medium' || impactHint === 2) score += 1;
  if (score >= 5) return 'HIGH';
  if (score >= 2) return 'MEDIUM';
  return 'LOW';
}

function impactFromTitle(title) {
  const t = (title || '').toLowerCase();
  if (/war|conflict|crisis|bank|default/.test(t)) return 'High volatility expected';
  if (/cpi|inflation|pce|hot/.test(t)) return 'Gold bullish bias / volatile';
  if (/nfp|employment|jobless|payroll/.test(t)) return 'USD strong bias / volatile';
  if (/fomc|fed|rate decision|powell/.test(t)) return 'USD strong bias';
  if (/gold|xau/.test(t)) return 'Gold bullish bias';
  if (/oil|opec/.test(t)) return 'High volatility expected';
  return 'Mixed / neutral';
}

function buildAiExplanation(event, hasTrade) {
  const lines = [];
  if (event) {
    lines.push(`What happened: Upcoming "${event.title}" (${event.currency || 'Global'}).`);
    lines.push(`Why market may move: ${event.risk} RISK category — liquidity can drop and spreads widen.`);
    lines.push(`Expected impact: ${event.impact}.`);
  }
  if (hasTrade) {
    lines.push('How it affects your trade: Open exposure is vulnerable to slippage and gap risk.');
    lines.push('Consider: close partially, reduce lot, or move stop loss before the event.');
  } else {
    lines.push('No trade logged on dashboard — wait for clarity after the release.');
  }
  lines.push('This is not financial advice. This is a risk warning tool. Final decision is always yours.');
  return lines.join('\n');
}

async function fetchFinnhubCalendar() {
  if (!FINNHUB_KEY) return [];
  const now = new Date();
  const to = new Date(now.getTime() + 48 * 3600 * 1000);
  const fromStr = now.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);
  const url = `https://finnhub.io/api/v1/calendar/economic?from=${fromStr}&to=${toStr}&token=${FINNHUB_KEY}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.economicCalendar || []).map((e) => ({
      id: `fh-${e.time}-${e.event}`,
      title: e.event,
      currency: e.country || e.currency || 'USD',
      time: new Date(e.time).toISOString(),
      actual: e.actual,
      forecast: e.estimate,
      previous: e.prev,
      risk: riskFromTitle(e.event, e.impact),
      impact: impactFromTitle(e.event),
      source: 'Finnhub'
    }));
  } catch (err) {
    console.warn('Finnhub calendar:', err.message);
    return [];
  }
}

async function fetchFinnhubNews() {
  if (!FINNHUB_KEY) return [];
  try {
    const res = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_KEY}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data || []).slice(0, 25).map((n) => ({
      id: `fn-${n.id}`,
      title: n.headline,
      summary: n.summary,
      time: new Date(n.datetime * 1000).toISOString(),
      source: n.source || 'Finnhub',
      url: n.url,
      risk: riskFromTitle(n.headline),
      impact: impactFromTitle(n.headline)
    }));
  } catch (err) {
    console.warn('Finnhub news:', err.message);
    return [];
  }
}

const RSS_FEEDS = [
  { name: 'Reuters Business', url: 'https://feeds.reuters.com/reuters/businessNews' },
  { name: 'Investing.com', url: 'https://www.investing.com/rss/news.rss' },
  { name: 'Fed Press', url: 'https://www.federalreserve.gov/feeds/press_all.xml' }
];

async function fetchRssNews() {
  const items = [];
  for (const feed of RSS_FEEDS) {
    try {
      const parsed = await rss.parseURL(feed.url);
      (parsed.items || []).slice(0, 12).forEach((item) => {
        items.push({
          id: `rss-${Buffer.from(item.link || item.title).toString('base64').slice(0, 16)}`,
          title: item.title,
          summary: (item.contentSnippet || item.summary || '').slice(0, 280),
          time: item.isoDate || item.pubDate || new Date().toISOString(),
          source: feed.name,
          url: item.link,
          risk: riskFromTitle(item.title),
          impact: impactFromTitle(item.title)
        });
      });
    } catch (err) {
      console.warn(`RSS ${feed.name}:`, err.message);
    }
  }
  return items;
}

function demoCalendar() {
  const now = Date.now();
  return [
    { id: 'demo-1', title: 'US CPI m/m', currency: 'USD', time: new Date(now + 3600000 * 2).toISOString(), risk: 'HIGH', impact: 'Gold bullish bias / volatile', source: 'Demo' },
    { id: 'demo-2', title: 'FOMC Statement', currency: 'USD', time: new Date(now + 3600000 * 8).toISOString(), risk: 'HIGH', impact: 'USD strong bias', source: 'Demo' },
    { id: 'demo-3', title: 'UK GDP q/q', currency: 'GBP', time: new Date(now + 3600000 * 5).toISOString(), risk: 'MEDIUM', impact: 'Mixed / neutral', source: 'Demo' }
  ];
}

function demoNews() {
  return [
    { id: 'dn-1', title: 'Gold rises as inflation expectations climb', time: new Date().toISOString(), source: 'Demo', risk: 'MEDIUM', impact: 'Gold bullish bias', summary: 'Safe-haven demand increases ahead of data.' },
    { id: 'dn-2', title: 'Oil volatile on supply headlines', time: new Date().toISOString(), source: 'Demo', risk: 'MEDIUM', impact: 'High volatility expected', summary: 'Energy markets sensitive to geopolitical news.' }
  ];
}

async function refreshCache() {
  let calendar = await fetchFinnhubCalendar();
  let news = await fetchFinnhubNews();
  const rssNews = await fetchRssNews();
  news = [...news, ...rssNews];

  if (calendar.length === 0) calendar = demoCalendar();
  if (news.length === 0) news = [...demoNews(), ...rssNews];

  calendar.sort((a, b) => new Date(a.time) - new Date(b.time));
  news.sort((a, b) => new Date(b.time) - new Date(a.time));

  const now = Date.now();
  const next = calendar.find((e) => new Date(e.time).getTime() > now && (e.risk === 'HIGH' || e.risk === 'MEDIUM'));
  const minsUntil = next ? Math.round((new Date(next.time) - now) / 60000) : null;

  let mood = 'SAFE';
  let sessionRisk = 'LOW';
  if (next && next.risk === 'HIGH' && minsUntil !== null && minsUntil <= 90) {
    mood = 'DANGEROUS';
    sessionRisk = 'HIGH';
  } else if (next && minsUntil !== null && minsUntil <= 180) {
    mood = 'CAUTION';
    sessionRisk = next.risk;
  }

  const breaking = news.filter((n) => n.risk === 'HIGH').slice(0, 5);

  cache = {
    calendar,
    news: news.slice(0, 40),
    breaking,
    mood,
    sessionRisk,
    nextEvent: next ? { ...next, minutesUntil: minsUntil } : null,
    highImpactToday: calendar.filter((e) => e.risk === 'HIGH').length,
    updatedAt: new Date().toISOString(),
    disclaimer: 'This is not financial advice. This is a risk warning tool. Final decision is always yours.',
    finnhubEnabled: !!FINNHUB_KEY
  };
}

app.get('/api/health', (_, res) => res.json({ ok: true, port: PORT }));

app.get('/api/calendar', (req, res) => {
  const hours = parseInt(req.query.hours || '48', 10);
  const cutoff = Date.now() + hours * 3600 * 1000;
  const items = cache.calendar.filter((e) => new Date(e.time).getTime() <= cutoff);
  res.json({ items, updatedAt: cache.updatedAt });
});

app.get('/api/news', (req, res) => {
  res.json({ items: cache.news, breaking: cache.breaking, updatedAt: cache.updatedAt });
});

app.get('/api/risk-summary', (req, res) => {
  res.json({
    mood: cache.mood,
    sessionRisk: cache.sessionRisk,
    nextEvent: cache.nextEvent,
    highImpactToday: cache.highImpactToday,
    breakingNews: cache.breaking,
    calendar: cache.calendar.slice(0, 15),
    disclaimer: cache.disclaimer,
    finnhubEnabled: cache.finnhubEnabled,
    updatedAt: cache.updatedAt
  });
});

app.post('/api/explain', (req, res) => {
  const { hasOpenTrade } = req.body || {};
  res.json({
    explanation: buildAiExplanation(cache.nextEvent, !!hasOpenTrade),
    disclaimer: cache.disclaimer
  });
});

app.get('/api/pro-summary', (req, res) => {
  const h = new Date().getUTCHours();
  let session = 'Off-hours';
  if (h >= 12 && h < 16) session = 'London/NY Overlap';
  else if (h >= 7 && h < 16) session = 'London';
  else if (h >= 12 && h < 21) session = 'New York';
  else if (h >= 0 && h < 9) session = 'Asian';

  let bullishProb = 50;
  if (cache.mood === 'SAFE') bullishProb = 58;
  if (cache.mood === 'CAUTION') bullishProb = 48;
  if (cache.mood === 'DANGEROUS') bullishProb = 42;
  const breaking = cache.breaking?.[0];
  if (breaking?.title?.toLowerCase().includes('gold')) bullishProb += 8;
  if (breaking?.title?.toLowerCase().match(/war|crisis|crash/)) bullishProb -= 15;
  bullishProb = Math.max(5, Math.min(95, bullishProb));
  const score = Math.round(bullishProb);

  let sentiment = 'Neutral';
  if (bullishProb >= 70) sentiment = 'Strong Bullish';
  else if (bullishProb >= 55) sentiment = 'Bullish';
  else if (bullishProb <= 30) sentiment = 'Strong Bearish';
  else if (bullishProb <= 45) sentiment = 'Bearish';

  res.json({
    mood: cache.mood,
    sessionRisk: cache.sessionRisk,
    session,
    nextEvent: cache.nextEvent,
    bullishProb,
    bearishProb: 100 - bullishProb,
    score,
    sentiment,
    crashAlert: cache.mood === 'DANGEROUS' && cache.nextEvent?.minutesUntil <= 30,
    exposureLots: 0,
    correlated: 0,
    dailyPnlPct: 0,
    structure: { fvg: true, bos: true, ob: true },
    disclaimer: cache.disclaimer,
    updatedAt: cache.updatedAt
  });
});

refreshCache();
setInterval(refreshCache, 5 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`AuraFX News Risk Server http://127.0.0.1:${PORT}`);
  console.log(`Finnhub API: ${FINNHUB_KEY ? 'enabled' : 'disabled (using RSS + demo)'}`);
});
