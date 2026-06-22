/**
 * Economic calendar service — Finnhub (when keyed) + scheduled reference fallback.
 * Powers /api/calendar, risk-summary, and dashboard calendar panels.
 */
const https = require('https');

const FINNHUB_KEY = String(process.env.FINNHUB_API_KEY || '').trim();
const CACHE_TTL_MS = Number(process.env.CALENDAR_CACHE_MS) || 300000; // 5 min

const HIGH_KEYWORDS = [
  'cpi', 'nfp', 'nonfarm', 'non-farm', 'fomc', 'interest rate', 'rate decision',
  'gdp', 'pce', 'inflation', 'employment', 'payroll', 'powell', 'lagarde', 'ecb',
  'boe', 'fed ', 'boj', 'rba', 'boc', 'retail sales', 'pmi', 'ism '
];

let cache = {
  at: 0,
  calendar: [],
  news: [],
  nextEvent: null,
  mood: 'CAUTION',
  sessionRisk: 'MEDIUM',
  highImpactToday: 0,
  source: 'reference',
  finnhubEnabled: false,
  updatedAt: null
};

function httpsJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'AuraFX-Elite/1.0', Accept: 'application/json' } }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch (e) { reject(new Error('Bad JSON')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(12000, () => { req.destroy(new Error('Timeout')); });
  });
}

function riskFromTitle(title, impactHint) {
  const t = String(title || '').toLowerCase();
  let score = 0;
  HIGH_KEYWORDS.forEach((k) => { if (t.includes(k)) score += 2; });
  if (impactHint === 'high' || impactHint === 3) score += 3;
  if (impactHint === 'medium' || impactHint === 2) score += 1;
  if (score >= 5) return 'HIGH';
  if (score >= 2) return 'MEDIUM';
  return 'LOW';
}

function impactNote(title) {
  const t = String(title || '').toLowerCase();
  if (/cpi|inflation|pce/.test(t)) return 'Inflation — gold & USD volatile';
  if (/nfp|employment|payroll|jobless/.test(t)) return 'Labour — USD pairs volatile';
  if (/fomc|fed|rate decision|powell|ecb|boe|boj/.test(t)) return 'Central bank — rates & FX';
  if (/gdp|retail|pmi|ism/.test(t)) return 'Growth data — risk sentiment';
  if (/trade balance|current account/.test(t)) return 'Trade flows — currency bias';
  return 'Monitor spreads and volatility';
}

function utcAt(dayOffset, hour, minute) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(hour, minute || 0, 0, 0);
  return d.toISOString();
}

/** Reference schedule when Finnhub key is not set — typical weekly macro rhythm */
function referenceCalendar(daysAhead) {
  const events = [];
  const now = new Date();
  const dow = now.getUTCDay(); // 0 Sun

  const templates = [
    { title: 'AU Employment Change', currency: 'AUD', risk: 'MEDIUM', h: 0, m: 30, dow: 4 },
    { title: 'CN GDP y/y', currency: 'CNY', risk: 'HIGH', h: 2, m: 0, dow: 2 },
    { title: 'UK CPI y/y', currency: 'GBP', risk: 'HIGH', h: 7, m: 0, dow: 3 },
    { title: 'EZ CPI y/y', currency: 'EUR', risk: 'HIGH', h: 10, m: 0, dow: 3 },
    { title: 'US Initial Jobless Claims', currency: 'USD', risk: 'MEDIUM', h: 13, m: 30, dow: 4 },
    { title: 'US Retail Sales m/m', currency: 'USD', risk: 'HIGH', h: 13, m: 30, dow: 2 },
    { title: 'US Core CPI m/m', currency: 'USD', risk: 'HIGH', h: 13, m: 30, dow: 3 },
    { title: 'US Non-Farm Payrolls', currency: 'USD', risk: 'HIGH', h: 13, m: 30, dow: 5 },
    { title: 'US ISM Manufacturing PMI', currency: 'USD', risk: 'MEDIUM', h: 15, m: 0, dow: 1 },
    { title: 'US FOMC Rate Decision', currency: 'USD', risk: 'HIGH', h: 19, m: 0, dow: 3 },
    { title: 'FOMC Press Conference', currency: 'USD', risk: 'HIGH', h: 19, m: 30, dow: 3 },
    { title: 'BOJ Policy Rate', currency: 'JPY', risk: 'HIGH', h: 3, m: 0, dow: 2 },
    { title: 'BOE Official Bank Rate', currency: 'GBP', risk: 'HIGH', h: 12, m: 0, dow: 4 },
    { title: 'ECB Main Refinancing Rate', currency: 'EUR', risk: 'HIGH', h: 12, m: 15, dow: 4 },
    { title: 'DE ZEW Economic Sentiment', currency: 'EUR', risk: 'LOW', h: 10, m: 0, dow: 2 },
    { title: 'JP Tankan Large Manufacturers', currency: 'JPY', risk: 'MEDIUM', h: 23, m: 50, dow: 0 },
    { title: 'US Prelim GDP q/q', currency: 'USD', risk: 'HIGH', h: 13, m: 30, dow: 4 },
    { title: 'US Core PCE Price Index', currency: 'USD', risk: 'HIGH', h: 13, m: 30, dow: 5 },
    { title: 'CA Employment Change', currency: 'CAD', risk: 'MEDIUM', h: 13, m: 30, dow: 5 },
    { title: 'NZ Official Cash Rate', currency: 'NZD', risk: 'HIGH', h: 2, m: 0, dow: 3 }
  ];

  for (let d = 0; d <= daysAhead; d++) {
    const day = new Date(now.getTime() + d * 86400000);
    const dayDow = day.getUTCDay();
    templates.forEach((tpl, i) => {
      if (tpl.dow != null && tpl.dow !== dayDow) return;
      const t = new Date(day);
      t.setUTCHours(tpl.h, tpl.m, 0, 0);
      if (t.getTime() < now.getTime() - 3600000) return;
      events.push({
        id: 'ref-' + d + '-' + i,
        title: tpl.title,
        currency: tpl.currency,
        time: t.toISOString(),
        risk: tpl.risk,
        impact: impactNote(tpl.title),
        category: categoryFromTitle(tpl.title),
        forecast: null,
        previous: null,
        actual: null,
        source: 'AuraFX reference schedule'
      });
    });
  }

  // Always add a near-term high-impact placeholder if list is thin
  if (events.filter((e) => e.risk === 'HIGH').length < 2) {
    events.push({
      id: 'ref-near',
      title: 'US Economic Data Release',
      currency: 'USD',
      time: utcAt(0, now.getUTCHours() < 13 ? 13 : 1, 30),
      risk: 'HIGH',
      impact: impactNote('CPI'),
      category: 'Inflation',
      source: 'AuraFX reference schedule'
    });
  }

  return events.sort((a, b) => new Date(a.time) - new Date(b.time));
}

function categoryFromTitle(title) {
  const t = String(title || '').toLowerCase();
  if (/cpi|inflation|pce/.test(t)) return 'Inflation';
  if (/nfp|employment|payroll|jobless/.test(t)) return 'Employment';
  if (/fomc|fed|ecb|boe|boj|rate/.test(t)) return 'Central bank';
  if (/gdp|retail|pmi|ism/.test(t)) return 'Growth';
  if (/trade/.test(t)) return 'Trade';
  return 'Economic';
}

async function fetchFinnhubCalendar(daysAhead) {
  if (!FINNHUB_KEY) return [];
  const now = new Date();
  const to = new Date(now.getTime() + daysAhead * 86400000);
  const url = 'https://finnhub.io/api/v1/calendar/economic?from=' +
    now.toISOString().slice(0, 10) + '&to=' + to.toISOString().slice(0, 10) +
    '&token=' + encodeURIComponent(FINNHUB_KEY);
  try {
    const res = await httpsJson(url);
    if (res.status !== 200 || !res.body) return [];
    return (res.body.economicCalendar || []).map((e, i) => ({
      id: 'fh-' + i + '-' + (e.time || ''),
      title: e.event,
      currency: e.country || e.currency || 'USD',
      time: new Date(e.time).toISOString(),
      actual: e.actual != null ? String(e.actual) : null,
      forecast: e.estimate != null ? String(e.estimate) : null,
      previous: e.prev != null ? String(e.prev) : null,
      risk: riskFromTitle(e.event, e.impact),
      impact: impactNote(e.event),
      category: categoryFromTitle(e.event),
      source: 'Finnhub'
    }));
  } catch (err) {
    console.warn('[AuraFX] Finnhub calendar:', err.message);
    return [];
  }
}

async function fetchFinnhubNews() {
  if (!FINNHUB_KEY) return [];
  const url = 'https://finnhub.io/api/v1/news?category=general&token=' + encodeURIComponent(FINNHUB_KEY);
  try {
    const res = await httpsJson(url);
    if (res.status !== 200 || !Array.isArray(res.body)) return [];
    return res.body.slice(0, 20).map((n) => ({
      id: 'fn-' + n.id,
      title: n.headline,
      summary: (n.summary || '').slice(0, 280),
      time: new Date(n.datetime * 1000).toISOString(),
      source: n.source || 'Finnhub',
      url: n.url,
      risk: riskFromTitle(n.headline)
    }));
  } catch (_) {
    return [];
  }
}

function buildSummary(calendar) {
  const now = Date.now();
  const upcoming = calendar.filter((e) => new Date(e.time).getTime() > now);
  const next = upcoming.find((e) => e.risk === 'HIGH') || upcoming.find((e) => e.risk === 'MEDIUM') || upcoming[0];
  const minsUntil = next ? Math.max(0, Math.round((new Date(next.time) - now) / 60000)) : null;

  let mood = 'SAFE';
  let sessionRisk = 'LOW';
  if (next && next.risk === 'HIGH' && minsUntil != null && minsUntil <= 90) {
    mood = 'DANGEROUS';
    sessionRisk = 'HIGH';
  } else if (next && minsUntil != null && minsUntil <= 180) {
    mood = 'CAUTION';
    sessionRisk = next.risk === 'HIGH' ? 'HIGH' : 'MEDIUM';
  } else if (upcoming.some((e) => e.risk === 'HIGH')) {
    mood = 'CAUTION';
    sessionRisk = 'MEDIUM';
  }

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = todayStart.getTime() + 86400000;
  const highImpactToday = calendar.filter((e) => {
    const t = new Date(e.time).getTime();
    return t >= todayStart.getTime() && t < todayEnd && e.risk === 'HIGH';
  }).length;

  return {
    nextEvent: next ? {
      title: next.title,
      currency: next.currency,
      time: next.time,
      risk: next.risk,
      minutesUntil: minsUntil
    } : null,
    mood,
    sessionRisk,
    highImpactToday
  };
}

async function refresh(force) {
  if (!force && cache.at && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache;
  }

  const daysAhead = 7;
  let calendar = await fetchFinnhubCalendar(daysAhead);
  let source = 'Finnhub';
  let finnhubEnabled = !!FINNHUB_KEY && calendar.length > 0;

  if (!calendar.length) {
    calendar = referenceCalendar(daysAhead);
    source = FINNHUB_KEY
      ? 'AuraFX reference (Finnhub empty — check API tier)'
      : 'AuraFX reference schedule — add FINNHUB_API_KEY for live calendar';
    finnhubEnabled = false;
  }

  const news = await fetchFinnhubNews();
  const summary = buildSummary(calendar);

  cache = {
    at: Date.now(),
    calendar,
    news,
    nextEvent: summary.nextEvent,
    mood: summary.mood,
    sessionRisk: summary.sessionRisk,
    highImpactToday: summary.highImpactToday,
    source,
    finnhubEnabled,
    updatedAt: new Date().toISOString()
  };
  return cache;
}

function filterCalendar(opts) {
  const o = opts || {};
  const hours = Number(o.hours) || 168;
  const risk = String(o.risk || '').toUpperCase();
  const currency = String(o.currency || '').toUpperCase();
  const end = Date.now() + hours * 3600000;

  return cache.calendar.filter((e) => {
    const t = new Date(e.time).getTime();
    if (t > end) return false;
    if (risk && e.risk !== risk) return false;
    if (currency && String(e.currency || '').toUpperCase() !== currency) return false;
    return true;
  });
}

function getPayload() {
  return {
    items: cache.calendar,
    calendar: cache.calendar,
    news: cache.news,
    nextEvent: cache.nextEvent,
    mood: cache.mood,
    sessionRisk: cache.sessionRisk,
    highImpactToday: cache.highImpactToday,
    source: cache.source,
    finnhubEnabled: cache.finnhubEnabled,
    updatedAt: cache.updatedAt,
    disclaimer: 'Educational calendar only — verify times with your broker. Not financial advice.'
  };
}

module.exports = {
  refresh,
  getPayload,
  filterCalendar,
  get cache() { return cache; }
};
