/**
 * AuraFX Institutional expansion — additive content only.
 * Does not modify existing cards; injects new sections after mount points.
 */
(function () {
  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function heatStyle(v) {
    const n = Math.max(-1, Math.min(1, Number(v) || 0));
    if (n >= 0) return 'background:rgba(46,204,113,' + (0.15 + n * 0.45) + ')';
    return 'background:rgba(231,76,60,' + (0.15 + Math.abs(n) * 0.45) + ')';
  }

  function calRows(rows, tag) {
    if (!rows || !rows.length) return '<p class="muted">No events in window.</p>';
    return '<table class="inst-table"><tr><th>Event</th><th>Cur</th><th>Time</th><th>Type</th></tr>' +
      rows.map(function (r) {
        return '<tr><td>' + esc(r.t) + '</td><td>' + esc(r.cur) + '</td><td>' + esc(r.time) +
          '</td><td><span class="inst-tag inst-tag-' + tag + '">' + esc(r.impact || tag) + '</span></td></tr>';
      }).join('') + '</table>';
  }

  function renderMarketOverview(d) {
    const m = d.marketOverview || {};
    const cs = (m.currencyStrength || []).map(function (x) {
      return '<div class="inst-metric"><span>' + esc(x.c) + ' strength</span><strong>' + x.s + '</strong></div>';
    }).join('');
    const heat = (d.heatmap || []).map(function (h) {
      return '<div class="inst-heat-cell" style="' + heatStyle(h.v) + '">' + esc(h.s) + '<br>' + (h.v > 0 ? '+' : '') + h.v + '</div>';
    }).join('');
    const gain = (m.gainers || []).map(function (g) { return '<li>' + esc(g.n) + ' <strong class="up">' + esc(g.v) + '</strong></li>'; }).join('');
    const lose = (m.losers || []).map(function (g) { return '<li>' + esc(g.n) + ' <strong class="down">' + esc(g.v) + '</strong></li>'; }).join('');
    return '<section class="card inst-wide"><h2>Market overview dashboard</h2>' +
      '<div class="inst-metric-row">' +
      '<div class="inst-metric"><span>Global sentiment</span><strong>' + esc(m.sentiment) + '</strong></div>' +
      '<div class="inst-metric"><span>Risk mode</span><strong>' + esc(m.riskMode) + '</strong></div>' +
      '<div class="inst-metric"><span>Fear &amp; Greed</span><strong>' + (m.fearGreed != null ? m.fearGreed : '—') + '</strong></div>' +
      '<div class="inst-metric"><span>Volatility index</span><strong>' + (m.vix != null ? m.vix : '—') + '</strong></div>' +
      '</div><p class="muted">' + esc(m.globalStatus) + ' · ' + esc(m.volumeNote) + '</p>' +
      '<h3 style="margin-top:.75rem;font-size:.85rem;color:var(--gold)">Currency strength meter</h3><div class="inst-metric-row">' + cs + '</div>' +
      '<div class="grid-3" style="margin-top:.75rem;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.75rem">' +
      '<div><h3 style="font-size:.8rem">Daily gainers</h3><ul class="feed-list">' + gain + '</ul></div>' +
      '<div><h3 style="font-size:.8rem">Daily losers</h3><ul class="feed-list">' + lose + '</ul></div>' +
      '<div><h3 style="font-size:.8rem">Market heat map</h3><div class="inst-heatmap">' + heat + '</div></div></div></section>';
  }

  function renderCalendar(d) {
    const c = d.calendar || {};
    return '<section class="card inst-wide"><h2>Economic calendar — institutional</h2>' +
      '<h3 style="font-size:.8rem;color:var(--bear)">High impact</h3>' + calRows(c.high, 'hi') +
      '<h3 style="font-size:.8rem;color:#e67e22;margin-top:.75rem">Medium impact</h3>' + calRows(c.medium, 'med') +
      '<h3 style="font-size:.8rem;color:var(--bull);margin-top:.75rem">Low impact</h3>' + calRows(c.low, 'lo') +
      '<p class="muted" style="margin-top:.5rem">Covers central bank, inflation, employment, GDP, rates, retail, manufacturing, trade balance.</p></section>';
  }

  function renderNewsWire(d) {
    const n = d.newsCategories || {};
    const keys = [
      ['forex', 'Forex'], ['gold', 'Gold'], ['stocks', 'Stocks'], ['crypto', 'Crypto'],
      ['geo', 'Geopolitical'], ['energy', 'Energy'], ['commodity', 'Commodity'],
      ['breaking', 'Breaking'], ['centralBank', 'Central bank'], ['institutions', 'Institutions']
    ];
    const blocks = keys.map(function (k) {
      const items = (n[k[0]] || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
      return '<div><h3 style="font-size:.75rem;color:var(--gold)">' + k[1] + '</h3><ul class="feed-list">' + items + '</ul></div>';
    }).join('');
    return '<section class="card inst-wide"><h2>Live news wire — multi-asset</h2>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:.75rem">' + blocks + '</div></section>';
  }

  function renderGold(d) {
    const g = d.gold || {};
    return '<section class="card inst-wide"><h2>Gold (XAUUSD) intelligence center</h2>' +
      '<div class="inst-metric-row">' +
      '<div class="inst-metric"><span>Live price</span><strong class="up live-price-cell" data-live-price="XAUUSD" data-live-cat="metals">' + (g.price != null ? g.price : '—') + '</strong></div>' +
      '<div class="inst-metric"><span>Daily</span><strong>' + esc(g.daily) + '</strong></div>' +
      '<div class="inst-metric"><span>Weekly</span><strong>' + esc(g.weekly) + '</strong></div>' +
      '<div class="inst-metric"><span>Monthly</span><strong>' + esc(g.monthly) + '</strong></div>' +
      '</div><ul class="stats">' +
      '<li>Support <strong>' + (g.support || []).join(' / ') + '</strong></li>' +
      '<li>Resistance <strong>' + (g.resistance || []).join(' / ') + '</strong></li>' +
      '<li>Volume <strong>' + esc(g.volume) + '</strong></li>' +
      '<li>Institutional sentiment <strong>' + esc(g.instSentiment) + '</strong></li>' +
      '<li>Safe-haven demand <strong>' + esc(g.safeHaven) + '</strong></li>' +
      '<li>USD correlation <strong>' + (g.usdCorr != null ? g.usdCorr : '—') + '</strong></li>' +
      '<li>Rates context <strong>' + esc(g.ratesNote) + '</strong></li></ul></section>';
  }

  function renderForex(d) {
    const f = d.forex || {};
    const sess = f.sessions || {};
    return '<section class="card inst-wide"><h2>Forex analytics</h2>' +
      '<div class="inst-metric-row">' +
      '<div class="inst-metric"><span>Strength rank</span><strong style="font-size:.75rem">' + (f.strengthRank || []).join(' › ') + '</strong></div>' +
      '<div class="inst-metric"><span>Volatility rank</span><strong style="font-size:.75rem">' + (f.volRank || []).join(', ') + '</strong></div>' +
      '</div><p><strong>Trending:</strong> ' + (f.trending || []).join(' · ') + '</p>' +
      '<p class="muted">Sessions — Asian: ' + esc(sess.asian) + ' · London: ' + esc(sess.london) + ' · NY: ' + esc(sess.ny) + '</p>' +
      '<p><strong>Smart money flow:</strong> ' + esc(f.smartMoney) + '</p>' +
      '<p class="muted">Correlation matrix, heat map, momentum &amp; liquidity analysis available in Pro terminal view.</p></section>';
  }

  function renderTechnical(d) {
    const t = d.technical || {};
    return '<section class="card"><h2>Advanced technical analysis</h2>' +
      '<ul class="checklist">' +
      '<li>EMA — ' + esc(t.ema) + '</li><li>SMA — ' + esc(t.sma) + '</li>' +
      '<li>RSI — ' + esc(t.rsi) + '</li><li>MACD — ' + esc(t.macd) + '</li>' +
      '<li>Bollinger — ' + esc(t.bb) + '</li><li>Fibonacci — ' + esc(t.fib) + '</li>' +
      '<li>Trend strength — <strong>' + (t.trendStrength != null ? t.trendStrength + '/100' : '—') + '</strong></li>' +
      '<li>Breakout — ' + esc(t.breakout) + '</li><li>Reversal — ' + esc(t.reversal) + '</li>' +
      '<li>Pattern — ' + esc(t.pattern) + '</li></ul></section>';
  }

  function renderAI(d) {
    const a = d.aiAssistant || {};
    return '<section class="card inst-wide"><h2>AI trading assistant — institutional</h2>' +
      '<div class="inst-ai-box">' +
      'Setup: ' + esc(a.setup) + '\nRisk: ' + esc(a.risk) + '\nStop loss: ' + esc(a.sl) + '\nTake profit: ' + esc(a.tp) +
      '\nMarket condition: ' + esc(a.condition) + '\nStructure: ' + esc(a.structure) +
      '\nS/R: ' + esc(a.sr) + '\nCandles: ' + esc(a.candles) + '\nRisk/Reward: ' + esc(a.rr) +
      '</div></section>';
  }

  function renderRiskCenter() {
    return '<section class="card inst-wide"><h2>Risk management center</h2>' +
      '<div class="inst-calc-grid" id="instRiskCalcs">' +
      '<div><label>Account balance</label><input type="number" id="rcBal" value="10000" /></div>' +
      '<div><label>Risk %</label><input type="number" id="rcRisk" value="1" step="0.1" /></div>' +
      '<div><label>Stop (pips)</label><input type="number" id="rcStop" value="20" /></div>' +
      '<div><label>Pip value ($)</label><input type="number" id="rcPip" value="10" /></div>' +
      '<div class="inst-calc-out" id="rcOut">Position size, margin, pip &amp; lot calculators — enter values above.</div>' +
      '</div><ul class="stats" style="margin-top:.75rem">' +
      '<li>Drawdown monitor <strong id="rcDD">—</strong></li>' +
      '<li>Compound growth (est.) <strong id="rcCompound">—</strong></li>' +
      '<li>Account protection <strong>Active</strong></li></ul></section>';
  }

  function renderLearning() {
    const topics = [
      ['Beginner guide', 'Pips, lots, sessions, platform basics'],
      ['Intermediate guide', 'Trend, S/R, risk per trade'],
      ['Advanced guide', 'Institutional order flow, liquidity'],
      ['Trading psychology', 'Discipline, revenge trading, journaling'],
      ['Risk management', 'Position sizing, max daily loss'],
      ['Market structure', 'BOS, CHOCH, premium/discount'],
      ['Institutional concepts', 'Interbank, fixings, sweeps'],
      ['Smart money concepts', 'Liquidity grabs, inducement'],
      ['Supply & demand', 'Fresh zones, mitigation'],
      ['Liquidity concepts', 'Equal highs/lows, stop hunts']
    ];
    const li = topics.map(function (t) {
      return '<li><strong>' + esc(t[0]) + '</strong> — ' + esc(t[1]) + '</li>';
    }).join('');
    return '<section class="card inst-wide"><h2>Professional learning center</h2><ul class="inst-learn-list">' + li + '</ul></section>';
  }

  function renderJournalExt(d) {
    const p = d.performance || {};
    return '<section class="card"><h2>Trading journal — performance metrics</h2>' +
      '<p class="muted">Use the journal above for entries; metrics aggregate here.</p>' +
      '<div class="inst-metric-row">' +
      '<div class="inst-metric"><span>Win rate</span><strong>' + p.winRate + '%</strong></div>' +
      '<div class="inst-metric"><span>R:R avg</span><strong>' + p.rr + '</strong></div>' +
      '<div class="inst-metric"><span>Profit factor</span><strong>' + p.profitFactor + '</strong></div>' +
      '<div class="inst-metric"><span>Max drawdown</span><strong class="down">' + p.maxDD + '%</strong></div>' +
      '</div><p class="muted">Track entry/exit reason, emotion, screenshots in journal form. Monthly stats &amp; strategy review sync on save.</p></section>';
  }

  function renderPortfolio() {
    return '<section class="card"><h2>Portfolio analytics</h2>' +
      '<div class="inst-spark" title="Equity curve visualization"></div>' +
      '<ul class="stats"><li>P/L tracking <strong>Live</strong></li>' +
      '<li>Monthly performance <strong>+4.2%</strong></li>' +
      '<li>Weekly performance <strong>+1.1%</strong></li>' +
      '<li>Diversification <strong>Moderate</strong></li>' +
      '<li>Risk exposure <strong>Controlled</strong></li></ul></section>';
  }

  function renderScanner(d) {
    const rows = (d.scanner || []).map(function (s) {
      return '<tr><td>' + esc(s.name) + '</td><td>' + esc(s.type) + '</td><td><strong>' + s.score + '</strong></td></tr>';
    }).join('');
    return '<section class="card inst-wide"><h2>Market scanner</h2>' +
      '<p class="muted">Breakout · Trend · Reversal · Volume · Volatility · Momentum · S/R</p>' +
      '<table class="inst-table"><tr><th>Symbol</th><th>Signal</th><th>Score</th></tr>' + rows + '</table></section>';
  }

  function renderInstitutional(d) {
    const i = d.institutional || {};
    return '<section class="card"><h2>Institutional data</h2><ul class="checklist">' +
      '<li>COT — ' + esc(i.cot) + '</li><li>Positioning — ' + esc(i.positioning) + '</li>' +
      '<li>Hedge funds — ' + esc(i.hedge) + '</li><li>Open interest — ' + esc(i.oi) + '</li>' +
      '<li>Liquidity — ' + esc(i.liquidity) + '</li></ul></section>';
  }

  function renderToolkit() {
    return '<section class="card"><h2>Professional trader toolkit</h2>' +
      '<ul class="checklist">' +
      '<li>☐ Trading calculators (risk center)</li>' +
      '<li>☐ Daily preparation checklist</li>' +
      '<li>☐ Session planner (London / NY)</li>' +
      '<li>☐ Economic event planner</li>' +
      '<li>☐ Risk checklist before entry</li>' +
      '<li>☐ Strategy checklist — trend + news aligned</li></ul></section>';
  }

  function renderPerformance(d) {
    const p = d.performance || {};
    return '<section class="card inst-wide"><h2>Performance dashboard</h2>' +
      '<div class="inst-metric-row">' +
      '<div class="inst-metric"><span>Win rate</span><strong>' + p.winRate + '%</strong></div>' +
      '<div class="inst-metric"><span>Risk/Reward</span><strong>' + p.rr + '</strong></div>' +
      '<div class="inst-metric"><span>Avg win</span><strong class="up">$' + p.avgWin + '</strong></div>' +
      '<div class="inst-metric"><span>Avg loss</span><strong class="down">$' + p.avgLoss + '</strong></div>' +
      '<div class="inst-metric"><span>Profit factor</span><strong>' + p.profitFactor + '</strong></div>' +
      '<div class="inst-metric"><span>Max DD</span><strong class="down">' + p.maxDD + '%</strong></div>' +
      '<div class="inst-metric"><span>Consec. wins</span><strong>' + p.consecWins + '</strong></div>' +
      '<div class="inst-metric"><span>Consec. losses</span><strong>' + p.consecLoss + '</strong></div>' +
      '<div class="inst-metric"><span>Sharpe</span><strong>' + p.sharpe + '</strong></div>' +
      '<div class="inst-metric"><span>Monthly growth</span><strong class="up">' + p.monthlyGrowth + '%</strong></div>' +
      '</div></section>';
  }

  function renderAlerts(d) {
    const items = (d.alerts || []).map(function (a) {
      return '<div class="inst-alert-item"><span class="inst-tag inst-tag-hi">' + esc(a.t) + '</span> ' + esc(a.m) + '</div>';
    }).join('');
    return '<section class="card"><h2>Alert system</h2>' + items +
      '<p class="muted" style="margin-top:.5rem">News · Volatility · Price · Trend · Risk · Economic event alerts.</p></section>';
  }

  function renderAISummary(d) {
    return '<section class="card inst-wide"><h2>AI market summary</h2>' +
      '<div class="inst-ai-box">' + esc(d.aiSummary) + '</div>' +
      '<p class="muted">Auto-generated: Forex · Gold · Stocks · Crypto · Commodities · Events · Sentiment</p></section>';
  }

  function renderDashboard(data) {
    return renderMarketOverview(data) + renderCalendar(data) + renderNewsWire(data) +
      renderGold(data) + renderForex(data) + renderTechnical(data) + renderAI(data) +
      renderRiskCenter() + renderLearning() + renderJournalExt(data) + renderPortfolio() +
      renderScanner(data) + renderInstitutional(data) + renderToolkit() +
      renderPerformance(data) + renderAlerts(data) + renderAISummary(data);
  }

  function renderHomeBlock(title, inner) {
    return '<section class="section inst-home-block"><h2>' + esc(title) + '</h2><div class="grid-3">' + inner + '</div></section>';
  }

  function renderHome(data) {
    const m = data.marketOverview || {};
    const g = data.gold || {};
    return renderHomeBlock('Institutional market intelligence', '' +
      '<div class="card"><h3>Market overview</h3><p>Sentiment: <strong>' + esc(m.sentiment) + '</strong> · Fear/Greed: ' + m.fearGreed + ' · VIX: ' + m.vix + '</p></div>' +
      '<div class="card"><h3>Gold intelligence</h3><p>XAUUSD ' + g.price + ' · ' + esc(g.daily) + ' daily · Safe-haven: ' + esc(g.safeHaven) + '</p></div>' +
      '<div class="card"><h3>AI summary</h3><p style="font-size:.85rem">' + esc((data.aiSummary || '').slice(0, 120)) + '…</p></div>') +
      renderHomeBlock('Professional platform modules', '' +
      '<div class="card"><h3>Economic calendar</h3><p>High/medium/low impact, central banks, CPI, NFP, GDP, rates.</p></div>' +
      '<div class="card"><h3>Forex &amp; technical analytics</h3><p>Strength ranks, EMA/RSI/MACD, patterns, scanners.</p></div>' +
      '<div class="card"><h3>Risk &amp; performance</h3><p>Calculators, journal metrics, portfolio P/L, alerts.</p></div>') +
      '<section class="section inst-home-block"><h2>Full institutional terminal</h2>' +
      '<p style="text-align:center;color:var(--muted);margin-bottom:1rem">Bloomberg-grade modules — calendar, news wire, COT, scanners, AI assistant, learning center.</p>' +
      '<p style="text-align:center"><a href="dashboard.html" class="btn btn-gold">Open AuraFX Pro Dashboard</a></p></section>';
  }

  function bindCalcs() {
    var bal = document.getElementById('rcBal');
    if (!bal) return;
    function run() {
      var b = parseFloat(bal.value) || 0;
      var risk = parseFloat(document.getElementById('rcRisk').value) || 1;
      var stop = parseFloat(document.getElementById('rcStop').value) || 20;
      var pip = parseFloat(document.getElementById('rcPip').value) || 10;
      var riskAmt = b * (risk / 100);
      var lots = stop > 0 && pip > 0 ? (riskAmt / (stop * pip)).toFixed(2) : '—';
      var out = document.getElementById('rcOut');
      if (out) out.textContent = 'Risk $' + riskAmt.toFixed(2) + ' · Suggested lots: ' + lots + ' · Margin est. (100:1): $' + (lots !== '—' ? (parseFloat(lots) * 100000 / 100).toFixed(0) : '—');
      var dd = document.getElementById('rcDD');
      if (dd) dd.textContent = (risk * 3).toFixed(1) + '% daily cap suggested';
      var cg = document.getElementById('rcCompound');
      if (cg) cg.textContent = ((1 + risk / 100) ** 20 * 100 - 100).toFixed(1) + '% (20 trades est.)';
    }
    ['rcBal', 'rcRisk', 'rcStop', 'rcPip'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', run);
    });
    run();
  }

  async function fetchData() {
    try {
      var base = window.AURAFX_API_BASE || '';
      var r = await fetch(base + '/api/institutional');
      if (r.ok) return await r.json();
    } catch (e) { /* fallback */ }
    return window.AURAFX_INST_FALLBACK || {};
  }

  function paint(data) {
    var dash = document.getElementById('aurafx-inst-dash');
    var home = document.getElementById('aurafx-inst-home');
    if (window.AURAFX_LIVE_QUOTES && window.AURAFX_LIVE_QUOTES.metals && window.AURAFX_LIVE_QUOTES.metals.XAUUSD && data.gold) {
      data.gold.price = window.AURAFX_LIVE_QUOTES.metals.XAUUSD;
    }
    if (dash) dash.innerHTML = renderDashboard(data);
    if (home) home.innerHTML = renderHome(data);
    bindCalcs();
  }

  function init() {
    fetchData().then(paint);
    document.addEventListener('aurafx-quotes-updated', function () {
      var q = window.AURAFX_LIVE_QUOTES || {};
      if (q.metals && q.metals.XAUUSD) {
        document.querySelectorAll('[data-live-price="XAUUSD"][data-live-cat="metals"]').forEach(function (el) {
          el.textContent = Number(q.metals.XAUUSD).toFixed(2);
        });
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
