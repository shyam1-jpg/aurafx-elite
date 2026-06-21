/**
 * Minimal test server — no npm install required (Node.js only)
 * Run: node test-server.js
 */
const http = require('http');

const PORT = 3847;
const demo = {
  mood: 'CAUTION',
  sessionRisk: 'MEDIUM',
  session: 'London',
  nextEvent: { title: 'US CPI m/m', minutesUntil: 45, risk: 'HIGH', impact: 'High volatility expected' },
  bullishProb: 52,
  bearishProb: 48,
  score: 52,
  sentiment: 'Neutral',
  crashAlert: false,
  highImpactToday: 3,
  disclaimer: 'Test mode — not financial advice.',
  updatedAt: new Date().toISOString()
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  const url = req.url.split('?')[0];
  if (url === '/api/health') {
    res.end(JSON.stringify({ ok: true, mode: 'test-server' }));
    return;
  }
  if (url === '/api/risk-summary' || url === '/api/pro-summary') {
    res.end(JSON.stringify({ ...demo, calendar: [], breakingNews: [] }));
    return;
  }
  if (url === '/api/news') {
    res.end(JSON.stringify({ items: [{ title: 'Test news feed OK', risk: 'LOW', time: demo.updatedAt }], updatedAt: demo.updatedAt }));
    return;
  }
  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, () => {
  console.log('AuraFX TEST server running at http://127.0.0.1:' + PORT);
  console.log('Open pro-dashboard/index.html or risk-dashboard/index.html in your browser.');
});
