/**
 * FX session detection and market context from UTC time + live quote changes.
 */
function getFxSessionsUTC() {
  const h = new Date().getUTCHours();
  const m = new Date().getUTCMinutes();
  const mins = h * 60 + m;

  const inRange = (startH, startM, endH, endM) => {
    const s = startH * 60 + startM;
    const e = endH * 60 + endM;
    if (s <= e) return mins >= s && mins < e;
    return mins >= s || mins < e;
  };

  return {
    sydney: inRange(21, 0, 6, 0),
    tokyo: inRange(0, 0, 9, 0),
    london: inRange(8, 0, 17, 0),
    newYork: inRange(13, 0, 22, 0),
    utcHour: h,
    utcLabel: new Date().toISOString().slice(11, 16) + ' UTC'
  };
}

function activeSessionLabel(sessions) {
  const active = [];
  if (sessions.sydney) active.push('Sydney');
  if (sessions.tokyo) active.push('Tokyo');
  if (sessions.london) active.push('London');
  if (sessions.newYork) active.push('New York');
  if (!active.length) return 'Off-hours';
  if (sessions.london && sessions.newYork) return 'London / New York overlap';
  return active.join(' · ');
}

function deriveMood(changes) {
  if (!changes || !Object.keys(changes).length) return 'CAUTION';
  const vals = Object.values(changes).filter((v) => typeof v === 'number' && isFinite(v));
  if (!vals.length) return 'CAUTION';
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const abs = vals.map(Math.abs);
  const vol = abs.reduce((a, b) => a + b, 0) / abs.length;
  if (vol > 1.2) return 'HIGH VOL';
  if (avg > 0.15) return 'RISK-ON';
  if (avg < -0.15) return 'RISK-OFF';
  return 'NEUTRAL';
}

function rankByChange(changes, limit) {
  const rows = Object.keys(changes || {})
    .filter((k) => typeof changes[k] === 'number' && isFinite(changes[k]))
    .map((k) => ({ symbol: k, pct: changes[k] }))
    .sort((a, b) => b.pct - a.pct);
  const gainers = rows.filter((r) => r.pct > 0).slice(0, 5).map((r) => ({
    n: r.symbol,
    v: (r.pct >= 0 ? '+' : '') + r.pct.toFixed(2) + '%'
  }));
  const losers = rows.filter((r) => r.pct < 0).sort((a, b) => a.pct - b.pct).slice(0, 5).map((r) => ({
    n: r.symbol,
    v: r.pct.toFixed(2) + '%'
  }));
  return { gainers, losers, top: rows.slice(0, limit || 8) };
}

function currencyStrengthFromForex(forex, changes) {
  const map = { USD: 50, EUR: 50, GBP: 50, JPY: 50, AUD: 50, CHF: 50, XAU: 50 };
  const apply = (sym, mult) => {
    const ch = changes && changes[sym];
    if (ch == null) return;
    const base = sym.slice(0, 3);
    const quote = sym.slice(3);
    if (map[base] != null) map[base] += ch * mult;
    if (map[quote] != null) map[quote] -= ch * mult * 0.5;
  };
  apply('EURUSD', 2);
  apply('GBPUSD', 2);
  apply('AUDUSD', 1.5);
  apply('USDJPY', -1.5);
  apply('USDCHF', -1);
  if (changes && changes.XAUUSD != null) map.XAU = 50 + changes.XAUUSD * 3;
  else if (forex && forex.XAUUSD) map.XAU = 62;

  return Object.keys(map)
    .map((c) => ({ c, s: Math.max(20, Math.min(95, Math.round(map[c]))) }))
    .sort((a, b) => b.s - a.s);
}

function sessionRiskLevel(sessions) {
  if (sessions.london && sessions.newYork) return 'HIGH';
  if (sessions.london || sessions.newYork) return 'MEDIUM';
  if (sessions.tokyo) return 'MEDIUM';
  return 'LOW';
}

module.exports = {
  getFxSessionsUTC,
  activeSessionLabel,
  deriveMood,
  rankByChange,
  currencyStrengthFromForex,
  sessionRiskLevel
};
