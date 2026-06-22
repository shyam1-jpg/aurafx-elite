/**
 * AuraFX Global Multi-Asset Terminal — additive expansion only.
 * Generates scalable demo data; ready for live API field mapping.
 */
(function () {
  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function seed(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) h = ((h << 5) - h) + str.charCodeAt(i) | 0;
    return Math.abs(h);
  }

  function rnd(s, min, max, dec) {
    var x = (seed(s) % 10000) / 10000;
    var v = min + x * (max - min);
    return dec != null ? v.toFixed(dec) : v;
  }

  function pct(s, scale) {
    var v = (seed(s + 'p') % 200 - 100) / 100 * (scale || 1);
    return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
  }

  function getBase(cat, sym) {
    var live = window.AURAFX_LIVE_QUOTES || {};
    var bases = window.AURAFX_PRICE_BASES || {};
    if (cat === 'forex' && live.forex && live.forex[sym]) return live.forex[sym];
    if (cat === 'crypto' && live.crypto && live.crypto[sym]) return live.crypto[sym];
    if (cat === 'metals' && live.metals && live.metals[sym]) return live.metals[sym];
    if (cat === 'energy' && bases.energy && bases.energy[sym]) return bases.energy[sym];
    if (cat === 'indices' && bases.indices && bases.indices[sym]) return bases.indices[sym];
    if (cat === 'ag' && bases.ag && bases.ag[sym]) return bases.ag[sym];
    if (bases[cat] && bases[cat][sym]) return bases[cat][sym];
    return null;
  }

  function fxDecimals(sym) {
    if (sym.indexOf('JPY') >= 0) return 3;
    if (sym.indexOf('XAU') >= 0) return 2;
    if (sym.slice(0, 3) === 'USD' && sym.length === 6) return sym.slice(3) === 'JPY' ? 3 : 5;
    return 5;
  }

  function spreadLabel(sym) {
    var ex = /TRY|ZAR|MXN|PLN|CNH/.test(sym);
    var jpy = sym.indexOf('JPY') >= 0;
    var p = ex ? rnd(sym + 'sp', 6, 28, 1) : jpy ? rnd(sym + 'sp', 0.6, 2.2, 1) : rnd(sym + 'sp', 0.1, 1.4, 1);
    return p + ' pips';
  }

  function priceSourceNote() {
    var q = window.AURAFX_LIVE_QUOTES || {};
    var t = q.updatedAt ? new Date(q.updatedAt).toLocaleTimeString() : '—';
    var live = q.live ? 'LIVE' : 'OFFLINE';
    var refresh = q.refreshSeconds || 30;
    return '<p class="muted" style="font-size:.72rem;margin-bottom:.5rem">' +
      '<span id="gmPriceLiveBadge" class="live-tick-badge">● ' + live + '</span> ' +
      'Prices: <strong>' + esc(q.source || 'Reference') + '</strong> · last update ' + t +
      ' · auto-refresh every ' + refresh + 's · gold/FX from market feeds</p>';
  }

  function realChangePct(sym, fallbackScale) {
    var ch = (window.AURAFX_LIVE_QUOTES || {}).changes;
    if (ch && ch[sym] != null && isFinite(ch[sym])) {
      return (ch[sym] >= 0 ? '+' : '') + Number(ch[sym]).toFixed(2) + '%';
    }
    return pct(sym + 'd', fallbackScale || 0.35);
  }

  function dataHonestyBanner() {
    var q = window.AURAFX_LIVE_QUOTES || {};
    var liveN = Object.keys(q.forex || {}).length + Object.keys(q.metals || {}).length + Object.keys(q.crypto || {}).length;
    return '<div class="inst-data-honesty" role="note">' +
      '<strong>Data transparency</strong> — ' +
      '<span class="inst-tag-live">LIVE</span> prices: forex, gold, silver' +
      (Object.keys(q.crypto || {}).length ? ', major crypto' : ' (crypto feed loading)') +
      ' from <strong>' + esc(q.source || 'market APIs') + '</strong>. ' +
      '<span class="inst-tag-context">CONTEXT</span> columns (market cap, sentiment, AI %, whale activity, generic news, COT) are ' +
      '<strong>educational placeholders</strong> — not live institutional data. Not financial advice.' +
      (liveN ? ' · ' + liveN + ' live instruments' : '') +
      '</div>';
  }

  function trendFrom(s) {
    var t = seed(s + 't') % 3;
    return t === 0 ? 'Bullish' : t === 1 ? 'Bearish' : 'Neutral';
  }

  function genForex(sym) {
    var base = getBase('forex', sym) || (0.5 + (seed(sym) % 500) / 100);
    var dec = fxDecimals(sym);
    return {
      symbol: sym,
      price: Number(base).toFixed(dec),
      spread: spreadLabel(sym),
      dailyChange: realChangePct(sym, 0.35),
      weeklyChange: pct(sym + 'w', 0.8),
      monthlyChange: pct(sym + 'm', 1.5),
      trend: trendFrom(sym),
      volume: rnd(sym + 'v', 68, 98, 0) + '% avg',
      volatility: rnd(sym + 'vo', 8, 42, 1) + '%',
      support: (base * 0.998).toFixed(dec),
      resistance: (base * 1.002).toFixed(dec),
      sentiment: seed(sym + 'se') % 2 ? 'Risk-on' : 'Cautious',
      institutionalBias: seed(sym + 'ib') % 3 === 0 ? 'Net long' : seed(sym + 'ib') % 3 === 1 ? 'Net short' : 'Neutral',
      aiAnalysis: 'Structure ' + trendFrom(sym).toLowerCase() + '; watch ' + (base * 1.002).toFixed(dec) + ' resistance.'
    };
  }

  function genCrypto(sym) {
    var base = getBase('crypto', sym) || rnd(sym, 0.01, 100, 4);
    var ch24 = realChangePct(sym, 0.8);
    return {
      symbol: sym,
      price: Number(base).toFixed(base < 1 ? 6 : 2),
      change24h: ch24,
      marketCap: '~$' + rnd(sym + 'mc', 1, 980, 0) + 'B',
      volume24h: '~$' + rnd(sym + 'vol', 10, 890, 0) + 'M',
      supply: rnd(sym + 'sup', 1, 99, 1) + 'B circ.',
      trend: trendFrom(sym),
      volatility: rnd(sym + 'cv', 12, 85, 0) + '%',
      aiForecast: trendFrom(sym) + ' bias (edu.)',
      whaleActivity: seed(sym + 'wh') % 2 ? 'Accumulation (edu.)' : 'Distribution (edu.)',
      institutionalActivity: seed(sym + 'in') % 3 === 0 ? 'ETF context (edu.)' : 'Neutral',
      riskRating: seed(sym + 'rk') % 3 === 0 ? 'High' : seed(sym + 'rk') % 3 === 1 ? 'Medium' : 'Low',
      newsImpact: seed(sym + 'ni') % 2 ? 'Moderate' : 'Low'
    };
  }

  function genMetal(sym) {
    var base = getBase('metals', sym) || 100;
    return {
      symbol: sym,
      spotPrice: base.toFixed(sym === 'COPPER' ? 2 : 2),
      trend: trendFrom(sym),
      support: (base * 0.99).toFixed(2),
      resistance: (base * 1.01).toFixed(2),
      inflationImpact: seed(sym) % 2 ? 'Supportive' : 'Neutral',
      usdCorrelation: (seed(sym) % 2 ? '-' : '') + '0.' + (60 + seed(sym) % 30),
      safeHaven: sym === 'XAUUSD' || sym === 'XAGUSD' ? 'Elevated' : 'Moderate',
      centralBankBuying: sym === 'XAUUSD' ? 'Strong' : 'Stable',
      institutionalSentiment: trendFrom(sym) + ' accumulation'
    };
  }

  function genEnergy(sym) {
    var base = getBase('energy', sym) || 50;
    return {
      symbol: sym,
      price: base.toFixed(2),
      supplyAnalysis: seed(sym) % 2 ? 'Balanced' : 'Tight',
      demandAnalysis: seed(sym + 'd') % 2 ? 'Rising' : 'Stable',
      opecNews: 'Monitoring output guidance',
      geopoliticalRisk: seed(sym + 'g') % 3 === 0 ? 'Elevated' : 'Moderate',
      inventory: pct(sym + 'inv', 0.5),
      priceForecast: trendFrom(sym) + ' near-term'
    };
  }

  function genIndex(sym) {
    var base = getBase('indices', sym) || 10000;
    return {
      symbol: sym,
      value: base.toFixed(0),
      dailyChange: pct(sym + 'd', 0.6),
      sectorBreakdown: 'Tech ' + rnd(sym + 't', 22, 38, 0) + '% · Fin ' + rnd(sym + 'f', 12, 22, 0) + '%',
      institutionalPositioning: seed(sym) % 2 ? 'Long bias' : 'Neutral',
      marketBreadth: rnd(sym + 'br', 42, 68, 0) + '% advancers',
      heatScore: (seed(sym) % 200 - 100) / 100,
      volumeAnalysis: rnd(sym + 'va', 70, 98, 0) + '% vs avg',
      riskRating: seed(sym + 'r') % 3 === 0 ? 'High' : 'Medium'
    };
  }

  function genAg(sym) {
    var base = getBase('ag', sym) || rnd(sym, 120, 980, 0);
    return {
      symbol: sym,
      price: Number(base).toFixed(0),
      supplyConditions: seed(sym) % 2 ? 'Adequate' : 'Tight',
      harvestReports: 'On schedule',
      weatherImpact: seed(sym + 'w') % 3 === 0 ? 'Adverse' : 'Favorable',
      demandAnalysis: seed(sym + 'de') % 2 ? 'Strong' : 'Stable',
      priceTrend: trendFrom(sym)
    };
  }

  function buildMarketsData(extra) {
    var u = window.AURAFX_UNIVERSE || {};
    var fx = u.forex || {};
    var data = {
      forex: {
        majors: (fx.majors || []).map(genForex),
        minors: (fx.minors || []).map(genForex),
        exotics: (fx.exotics || []).map(genForex)
      },
      crypto: (u.crypto || []).map(genCrypto),
      metals: (u.metals || []).map(genMetal),
      energy: (u.energy || []).map(genEnergy),
      indices: (u.indices || []).map(genIndex),
      ag: (u.ag || []).map(genAg),
      technical: {},
      smc: {},
      ai: {},
      news: {},
      institutional: {},
      warnings: (extra && extra.warnings) || [],
      updatedAt: new Date().toISOString()
    };
    var ref = 'XAUUSD';
    (u.technical || []).forEach(function (name) {
      data.technical[name] = {
        value: rnd(ref + name, 20, 80, 1),
        signal: trendFrom(ref + name),
        note: name + ' — ' + trendFrom(ref + name) + ' on ' + ref
      };
    });
    (u.smc || []).forEach(function (name) {
      data.smc[name] = {
        status: seed(name) % 2 ? 'Active zone' : 'Mitigated',
        location: ref + ' H4',
        bias: trendFrom(name)
      };
    });
    (u.aiModules || []).forEach(function (name) {
      data.ai[name] = {
        output: name + ': ' + trendFrom(name) + ' context on majors; risk-adjusted sizing recommended.',
        confidence: rnd(name, 62, 94, 0) + '%'
      };
    });
    (u.newsCats || []).forEach(function (cat) {
      data.news[cat] = [
        cat + ' headline — markets digesting macro data',
        cat + ' update — institutional desks active'
      ];
    });
    data.institutional = {
      cot: 'Specs net long gold; net short JPY',
      openInterest: 'FX OI +2.1% · Crypto OI +4.8%',
      optionsPositioning: 'Put skew elevated indices',
      whaleTracking: 'BTC whale wallets +12 transfers',
      etfFlows: 'Gold ETF inflows 3 sessions',
      centralBank: 'Fed data-dependent; ECB cautious',
      smartMoney: 'USD buy dips; XAU accumulation',
      sentiment: 'Moderate risk-on'
    };
    return data;
  }

  function fxTableRows(rows) {
    return rows.map(function (r) {
      return '<tr data-sym="' + esc(r.symbol) + '"><td><strong>' + esc(r.symbol) + '</strong></td>' +
        '<td class="live-price-cell" data-live-price="' + esc(r.symbol) + '" data-live-cat="forex">' + r.price + '</td><td>' + r.spread + '</td><td class="' + (r.dailyChange[0] === '+' ? 'up' : 'down') + '">' + r.dailyChange + '</td>' +
        '<td>' + r.weeklyChange + '</td><td>' + r.monthlyChange + '</td><td>' + r.trend + '</td>' +
        '<td>' + r.volume + '</td><td>' + r.volatility + '</td><td>' + r.support + '</td><td>' + r.resistance + '</td>' +
        '<td>' + r.sentiment + '</td><td>' + r.institutionalBias + '</td><td title="' + esc(r.aiAnalysis) + '">' + esc(r.aiAnalysis.slice(0, 28)) + '…</td></tr>';
    }).join('');
  }

  function fxTable(rows) {
    return '<div class="inst-scroll"><table class="inst-table inst-table-compact"><tr>' +
      '<th>Pair</th><th>Price</th><th>Spread</th><th>D%</th><th>W%</th><th>M%</th><th>Trend</th>' +
      '<th>Volume</th><th>Vol</th><th>Support</th><th>Resist</th><th>Sentiment</th><th>Inst</th><th>AI</th></tr>' +
      fxTableRows(rows) + '</table></div>';
  }

  function renderForexGlobal(d) {
    var fx = d.forex || {};
    return '<section class="card inst-wide" id="gm-forex"><h2>Global forex — majors, minors &amp; exotics</h2>' +
      priceSourceNote() +
      '<input type="search" class="inst-search" placeholder="Search pair…" data-filter="gm-forex-table" />' +
      '<div class="inst-tabs" data-tabs="fx-global">' +
      '<button type="button" class="inst-tab active" data-panel="fx-maj">Majors (7)</button>' +
      '<button type="button" class="inst-tab" data-panel="fx-min">Minors (12)</button>' +
      '<button type="button" class="inst-tab" data-panel="fx-exo">Exotics (10)</button></div>' +
      '<div class="inst-tab-panel active" id="fx-maj" data-table="gm-forex-table">' + fxTable(fx.majors || []) + '</div>' +
      '<div class="inst-tab-panel" id="fx-min" data-table="gm-forex-table">' + fxTable(fx.minors || []) + '</div>' +
      '<div class="inst-tab-panel" id="fx-exo" data-table="gm-forex-table">' + fxTable(fx.exotics || []) + '</div></section>';
  }

  function renderCrypto(d) {
    var rows = (d.crypto || []).map(function (r) {
      return '<tr data-sym="' + esc(r.symbol) + '"><td><strong>' + esc(r.symbol) + '</strong></td>' +
        '<td class="live-price-cell" data-live-price="' + esc(r.symbol) + '" data-live-cat="crypto">' + r.price + '</td>' +
        '<td>' + (r.change24h || '—') + '</td>' +
        '<td>' + r.marketCap + '</td><td>' + r.volume24h + '</td><td>' + r.supply + '</td><td>' + r.trend + '</td>' +
        '<td>' + r.volatility + '</td><td>' + r.aiForecast + '</td><td>' + r.whaleActivity + '</td>' +
        '<td>' + r.institutionalActivity + '</td><td>' + r.riskRating + '</td><td>' + r.newsImpact + '</td></tr>';
    }).join('');
    return '<section class="card inst-wide" id="gm-crypto"><h2>Cryptocurrency markets</h2>' +
      priceSourceNote() +
      '<input type="search" class="inst-search" placeholder="Search crypto…" data-filter="gm-crypto-table" />' +
      '<div class="inst-scroll"><table class="inst-table inst-table-compact" id="gm-crypto-table"><tr>' +
      '<th>Asset</th><th>Price</th><th>24h %</th><th>Mkt Cap (edu.)</th><th>Vol (edu.)</th><th>Supply</th><th>Trend</th>' +
      '<th>Volatility</th><th>Forecast</th><th>Whales</th><th>Inst.</th><th>Risk</th><th>News</th></tr>' +
      rows + '</table></div></section>';
  }

  function renderMetals(d) {
    var rows = (d.metals || []).map(function (r) {
      return '<tr data-sym="' + esc(r.symbol) + '"><td><strong>' + esc(r.symbol) + '</strong></td>' +
        '<td class="live-price-cell" data-live-price="' + esc(r.symbol) + '" data-live-cat="metals">' + r.spotPrice + '</td><td>' + r.trend + '</td>' +
        '<td>' + r.support + '</td><td>' + r.resistance + '</td><td>' + r.inflationImpact + '</td>' +
        '<td>' + r.usdCorrelation + '</td><td>' + r.safeHaven + '</td><td>' + r.centralBankBuying + '</td><td>' + r.institutionalSentiment + '</td></tr>';
    }).join('');
    return '<section class="card inst-wide"><h2>Precious metals &amp; industrial</h2>' +
      priceSourceNote() +
      '<div class="inst-scroll"><table class="inst-table inst-table-compact"><tr>' +
      '<th>Metal</th><th>Spot</th><th>Trend</th><th>Support</th><th>Resist</th><th>Inflation</th>' +
      '<th>USD corr</th><th>Safe haven</th><th>CB buying</th><th>Inst sentiment</th></tr>' + rows + '</table></div></section>';
  }

  function renderEnergy(d) {
    var rows = (d.energy || []).map(function (r) {
      return '<tr data-sym="' + esc(r.symbol) + '"><td><strong>' + esc(r.symbol) + '</strong></td>' +
        '<td class="live-price-cell" data-live-price="' + esc(r.symbol) + '" data-live-cat="energy">' + r.price + '</td><td>' + r.supplyAnalysis + '</td>' +
        '<td>' + r.demandAnalysis + '</td><td>' + r.opecNews + '</td><td>' + r.geopoliticalRisk + '</td>' +
        '<td>' + r.inventory + '</td><td>' + r.priceForecast + '</td></tr>';
    }).join('');
    return '<section class="card inst-wide"><h2>Energy markets</h2>' +
      '<p class="muted" style="font-size:.72rem;margin-bottom:.5rem">Reference prices — not live exchange feeds. Educational context only.</p>' +
      '<div class="inst-scroll"><table class="inst-table inst-table-compact"><tr>' +
      '<th>Energy</th><th>Price</th><th>Supply</th><th>Demand</th><th>OPEC</th><th>Geo risk</th><th>Inventory</th><th>Forecast</th></tr>' +
      rows + '</table></div></section>';
  }

  function renderIndices(d) {
    var heat = (d.indices || []).map(function (r) {
      var style = 'background:rgba(46,204,113,' + (0.15 + Math.max(0, r.heatScore) * 0.4) + ')';
      if (r.heatScore < 0) style = 'background:rgba(231,76,60,' + (0.15 + Math.abs(r.heatScore) * 0.4) + ')';
      return '<div class="inst-heat-cell" style="' + style + '">' + esc(r.symbol) + '<br>' + r.dailyChange + '</div>';
    }).join('');
    var rows = (d.indices || []).map(function (r) {
      return '<tr data-sym="' + esc(r.symbol) + '"><td><strong>' + esc(r.symbol) + '</strong></td>' +
        '<td class="live-price-cell" data-live-price="' + esc(r.symbol) + '" data-live-cat="indices">' + r.value + '</td><td>' + r.dailyChange + '</td>' +
        '<td>' + r.sectorBreakdown + '</td><td>' + r.institutionalPositioning + '</td><td>' + r.marketBreadth + '</td>' +
        '<td>' + r.volumeAnalysis + '</td><td>' + r.riskRating + '</td></tr>';
    }).join('');
    return '<section class="card inst-wide"><h2>Global indices</h2>' +
      '<p class="muted" style="font-size:.72rem;margin-bottom:.5rem">Reference index levels — not live exchange feeds. Educational context only.</p>' +
      '<h3 style="font-size:.8rem;color:var(--gold)">Index heat map</h3><div class="inst-heatmap">' + heat + '</div>' +
      '<div class="inst-scroll" style="margin-top:.75rem"><table class="inst-table inst-table-compact"><tr>' +
      '<th>Index</th><th>Value</th><th>Change</th><th>Sectors</th><th>Institutional</th><th>Breadth</th><th>Volume</th><th>Risk</th></tr>' +
      rows + '</table></div></section>';
  }

  function renderAg(d) {
    var rows = (d.ag || []).map(function (r) {
      return '<tr data-sym="' + esc(r.symbol) + '"><td><strong>' + esc(r.symbol) + '</strong></td>' +
        '<td class="live-price-cell" data-live-price="' + esc(r.symbol) + '" data-live-cat="ag">' + r.price + '</td><td>' + r.supplyConditions + '</td>' +
        '<td>' + r.harvestReports + '</td><td>' + r.weatherImpact + '</td><td>' + r.demandAnalysis + '</td><td>' + r.priceTrend + '</td></tr>';
    }).join('');
    return '<section class="card inst-wide"><h2>Agricultural commodities</h2>' +
      '<div class="inst-scroll"><table class="inst-table inst-table-compact"><tr>' +
      '<th>Commodity</th><th>Price</th><th>Supply</th><th>Harvest</th><th>Weather</th><th>Demand</th><th>Trend</th></tr>' +
      rows + '</table></div></section>';
  }

  function renderTechnical(d) {
    var items = Object.keys(d.technical || {}).map(function (k) {
      var t = d.technical[k];
      return '<li><strong>' + esc(k) + '</strong> — ' + t.value + ' · ' + esc(t.signal) + ' · <span class="muted">' + esc(t.note) + '</span></li>';
    }).join('');
    return '<section class="card inst-wide"><h2>Advanced technical analysis suite</h2>' +
      '<div class="inst-chart-box" aria-hidden="true">' +
      [40, 55, 48, 62, 58, 70, 65, 72, 68, 75, 80, 78].map(function (h) {
        return '<div class="inst-chart-bar" style="height:' + h + '%"></div>';
      }).join('') +
      '</div><p class="muted">TradingView-style chart placeholder — connect live feed via API</p>' +
      '<ul class="checklist" style="margin-top:.75rem;max-height:320px;overflow-y:auto">' + items + '</ul></section>';
  }

  function renderSMC(d) {
    var items = Object.keys(d.smc || {}).map(function (k) {
      var s = d.smc[k];
      return '<li><strong>' + esc(k) + '</strong> — ' + esc(s.status) + ' · ' + esc(s.location) + ' · ' + esc(s.bias) + '</li>';
    }).join('');
    return '<section class="card"><h2>Smart money concepts (SMC)</h2><ul class="checklist">' + items + '</ul></section>';
  }

  function renderAIHub(d) {
    var items = Object.keys(d.ai || {}).map(function (k) {
      var a = d.ai[k];
      return '<div class="inst-bloomberg-panel"><h4>' + esc(k) + '</h4><p>' + esc(a.output) + '</p><p class="muted">Confidence: ' + a.confidence + '</p></div>';
    }).join('');
    return '<section class="card inst-wide"><h2>AI trading intelligence hub</h2><div class="inst-panel-row">' + items + '</div></section>';
  }

  function renderNews(d) {
    var warn = (d.warnings || []).map(function (w) {
      return '<div class="inst-warning">⚠ ' + esc(w) + '</div>';
    }).join('');
    var blocks = Object.keys(d.news || {}).map(function (cat) {
      var li = (d.news[cat] || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
      return '<div><h3 style="font-size:.72rem;color:var(--gold)">' + esc(cat) + '</h3><ul class="feed-list">' + li + '</ul></div>';
    }).join('');
    return '<section class="card inst-wide"><h2>Multi-asset news &amp; event intelligence</h2>' + warn +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.75rem">' + blocks + '</div></section>';
  }

  function renderCalcs() {
    return '<section class="card inst-wide" id="gm-calcs"><h2>Professional trading calculators</h2>' +
      '<div class="inst-calc-grid">' +
      '<div><label>Balance ($)</label><input type="number" id="gmBal" value="10000" /></div>' +
      '<div><label>Risk %</label><input type="number" id="gmRisk" value="1" step="0.1" /></div>' +
      '<div><label>Stop (pips)</label><input type="number" id="gmStop" value="25" /></div>' +
      '<div><label>Pip value ($)</label><input type="number" id="gmPip" value="10" /></div>' +
      '<div><label>Leverage</label><input type="number" id="gmLev" value="100" /></div>' +
      '<div><label>Entry</label><input type="number" id="gmEntry" value="2340" step="0.01" /></div>' +
      '<div><label>Exit</label><input type="number" id="gmExit" value="2355" step="0.01" /></div>' +
      '<div><label>Lots</label><input type="number" id="gmLots" value="0.1" step="0.01" /></div>' +
      '<div><label>Funding rate %</label><input type="number" id="gmFund" value="0.01" step="0.001" /></div>' +
      '</div><div class="inst-calc-out" id="gmCalcOut">—</div></section>';
  }

  function renderJournalPro() {
    return '<section class="card inst-wide"><h2>Trading journal — professional suite</h2>' +
      '<p class="muted">Screenshot upload &amp; trade notes use the card above. Extended tracking:</p>' +
      '<ul class="stats">' +
      '<li>Emotion tracking <strong>Linked to journal</strong></li>' +
      '<li>Win rate <strong id="gmWinRate">76.2%</strong></li>' +
      '<li>Strategy tracking <strong>Multi-strategy</strong></li>' +
      '<li>Performance review <strong>Weekly auto</strong></li>' +
      '<li>Monthly reports <strong>PDF-ready export (API)</strong></li></ul></section>';
  }

  function renderLivePreviewBanner(d) {
    if (!d._livePreview) return '';
    var src = (d.institutional && d.institutional.dataSource) || 'live APIs';
    var at = (d.institutional && d.institutional.quotesUpdatedAt) || d.updatedAt || '';
    return '<div class="inst-live-preview-banner" role="status">' +
      '<strong>OWNER LIVE PREVIEW</strong> — not public · ' + esc(src) +
      ' · updated ' + esc(String(at).slice(0, 19)) +
      ' · <a href="owner-preview.html">Preview settings</a></div>';
  }

  function renderInstitutional(d) {
    var i = d.institutional || {};
    var tag = d._livePreview ? ' <span class="inst-live-tag">LIVE</span>' : '';
    return '<section class="card inst-wide"><h2>Institutional &amp; smart money data' + tag + '</h2>' +
      '<div class="inst-panel-row">' +
      '<div class="inst-bloomberg-panel"><h4>COT</h4><p>' + esc(i.cot) + '</p></div>' +
      '<div class="inst-bloomberg-panel"><h4>Open interest</h4><p>' + esc(i.openInterest) + '</p></div>' +
      '<div class="inst-bloomberg-panel"><h4>Options</h4><p>' + esc(i.optionsPositioning) + '</p></div>' +
      '<div class="inst-bloomberg-panel"><h4>Whale tracking</h4><p>' + esc(i.whaleTracking) + '</p></div>' +
      '<div class="inst-bloomberg-panel"><h4>ETF flows</h4><p>' + esc(i.etfFlows) + '</p></div>' +
      '<div class="inst-bloomberg-panel"><h4>Central banks</h4><p>' + esc(i.centralBank) + '</p></div>' +
      '<div class="inst-bloomberg-panel"><h4>Smart money</h4><p>' + esc(i.smartMoney) + '</p></div>' +
      '<div class="inst-bloomberg-panel"><h4>Sentiment</h4><p>' + esc(i.sentiment) + '</p></div>' +
      '</div></section>';
  }

  function renderTerminalPanels(d) {
    var watchItems = d._liveWatchlist || (d.forex.majors || []).slice(0, 5).concat((d.crypto || []).slice(0, 5));
    var watch = watchItems.map(function (r) {
      var ch = r.dailyChange || '+0.1%';
      var sym = r.symbol;
      var cls = String(ch).indexOf('+') === 0 ? 'up' : 'down';
      var cat = r.cat || (sym.length <= 5 && sym.indexOf('USD') >= 0 ? 'forex' : 'crypto');
      var price = r.price || r.value || r.spotPrice;
      var liveAttr = d._livePreview
        ? ' data-live-price="' + esc(sym) + '" data-live-cat="' + esc(cat) + '"'
        : '';
      return '<span class="inst-watch-pill ' + cls + '"' + liveAttr + '>' + esc(sym) + ' ' + price + '</span>';
    }).join('');
    var scannerRows = d._liveScanner || [
      { name: 'XAUUSD', type: 'Breakout', score: 88 },
      { name: 'EURUSD', type: 'Trend', score: 81 },
      { name: 'BTC', type: 'Momentum', score: 79 },
      { name: 'US500', type: 'Reversal watch', score: 72 }
    ];
    var scannerHtml = scannerRows.map(function (row) {
      return '<tr><td>' + esc(row.name) + '</td><td>' + esc(row.type) + '</td><td>' + row.score + '</td></tr>';
    }).join('');
    var scanTag = d._livePreview ? ' <span class="inst-live-tag">LIVE</span>' : '';
    return '<section class="card inst-wide"><h2>Professional terminal — watchlists &amp; scanners' + scanTag + '</h2>' +
      '<h3 style="font-size:.8rem;color:var(--gold)">Advanced watchlist</h3><div class="inst-watchlist">' + watch + '</div>' +
      '<h3 style="margin-top:.75rem;font-size:.8rem;color:var(--gold)">Multi-asset scanner</h3>' +
      '<table class="inst-table"><tr><th>Asset</th><th>Signal</th><th>Score</th></tr>' + scannerHtml + '</table>' +
      '<h3 style="margin-top:.75rem;font-size:.8rem;color:var(--gold)">Custom dashboard layout</h3>' +
      '<p class="muted">Bloomberg-style panels · Economic calendar integrated · Interactive analytics — API keys slot into /api/markets</p>' +
      '<div class="inst-panel-row">' +
      '<div class="inst-bloomberg-panel"><h4>Forex desk</h4><p>29 pairs live-mode</p></div>' +
      '<div class="inst-bloomberg-panel"><h4>Crypto desk</h4><p>32 assets</p></div>' +
      '<div class="inst-bloomberg-panel"><h4>Macro desk</h4><p>Metals · Energy · Indices · Ag</p></div>' +
      '</div></section>';
  }

  function renderAll(d) {
    return dataHonestyBanner() + renderLivePreviewBanner(d) + renderForexGlobal(d) + renderCrypto(d) + renderMetals(d) + renderEnergy(d) +
      renderIndices(d) + renderAg(d) + renderTechnical(d) + renderSMC(d) + renderAIHub(d) +
      renderNews(d) + renderCalcs() + renderJournalPro() + renderInstitutional(d) + renderTerminalPanels(d);
  }

  function renderHomeSummary(d) {
    var fxCount = (d.forex.majors || []).length + (d.forex.minors || []).length + (d.forex.exotics || []).length;
    return '<section class="section inst-home-block"><h2>Global multi-asset coverage</h2><div class="grid-3">' +
      '<div class="card"><h3>Forex</h3><p><strong>' + fxCount + '</strong> pairs — majors, minors, exotics with live-style analytics.</p></div>' +
      '<div class="card"><h3>Crypto &amp; macro</h3><p><strong>' + (d.crypto || []).length + '</strong> cryptocurrencies · metals · energy · <strong>' + (d.indices || []).length + '</strong> indices.</p></div>' +
      '<div class="card"><h3>Full terminal</h3><p>Technical suite, SMC, AI hub, institutional data, calculators, scanners.</p></div>' +
      '</div><p style="text-align:center;margin-top:1rem"><a href="dashboard.html" class="btn btn-gold">Open complete terminal</a></p></section>';
  }

  function bindTabs(root) {
    if (!root) return;
    root.querySelectorAll('[data-tabs]').forEach(function (wrap) {
      wrap.querySelectorAll('.inst-tab').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var panelId = btn.getAttribute('data-panel');
          wrap.querySelectorAll('.inst-tab').forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          var section = wrap.closest('section');
          if (!section) return;
          section.querySelectorAll('.inst-tab-panel').forEach(function (p) {
            p.classList.toggle('active', p.id === panelId);
          });
        });
      });
    });
  }

  function bindSearch(root) {
    if (!root) return;
    root.querySelectorAll('.inst-search').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var q = inp.value.toUpperCase();
        var section = inp.closest('section');
        if (!section) return;
        section.querySelectorAll('table tr[data-sym]').forEach(function (tr) {
          var sym = tr.getAttribute('data-sym') || '';
          tr.style.display = !q || sym.indexOf(q) >= 0 ? '' : 'none';
        });
      });
    });
  }

  function bindCalcs() {
    var ids = ['gmBal', 'gmRisk', 'gmStop', 'gmPip', 'gmLev', 'gmEntry', 'gmExit', 'gmLots', 'gmFund'];
    function run() {
      var b = parseFloat(document.getElementById('gmBal').value) || 0;
      var risk = parseFloat(document.getElementById('gmRisk').value) || 1;
      var stop = parseFloat(document.getElementById('gmStop').value) || 1;
      var pip = parseFloat(document.getElementById('gmPip').value) || 10;
      var lev = parseFloat(document.getElementById('gmLev').value) || 100;
      var entry = parseFloat(document.getElementById('gmEntry').value) || 0;
      var exit = parseFloat(document.getElementById('gmExit').value) || 0;
      var lots = parseFloat(document.getElementById('gmLots').value) || 0.1;
      var fund = parseFloat(document.getElementById('gmFund').value) || 0;
      var riskAmt = b * risk / 100;
      var posLots = stop > 0 && pip > 0 ? (riskAmt / (stop * pip)).toFixed(2) : '—';
      var margin = (lots * 100000 / lev).toFixed(0);
      var pips = Math.abs(exit - entry) * (entry > 50 ? 1 : 10000);
      var profit = (pips * pip * lots).toFixed(2);
      var dd = (risk * 5).toFixed(1);
      var compound = ((Math.pow(1 + risk / 100, 12) - 1) * 100).toFixed(1);
      var funding = (lots * fund * 100).toFixed(2);
      var out = document.getElementById('gmCalcOut');
      if (out) {
        out.innerHTML = '<strong>Position size:</strong> ' + posLots + ' lots · <strong>Risk $:</strong> ' + riskAmt.toFixed(2) +
          ' · <strong>Margin:</strong> $' + margin + ' · <strong>Pip value:</strong> $' + (pip * lots).toFixed(2) +
          ' · <strong>Profit est:</strong> $' + profit + ' · <strong>Drawdown cap:</strong> ' + dd + '% · <strong>Compound 12mo:</strong> ' + compound + '% · <strong>Funding:</strong> $' + funding;
      }
    }
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', run);
    });
    run();
  }

  async function fetchExtra() {
    try {
      var base = window.AURAFX_API_BASE || '';
      var r = await fetch(base + '/api/markets');
      if (r.ok) return await r.json();
    } catch (e) { /* client gen */ }
    return {};
  }

  function mergeServerQuotes(quotes) {
    if (!quotes) return;
    var live = window.AURAFX_LIVE_QUOTES;
    Object.keys(quotes.forex || {}).forEach(function (sym) {
      live.forex[sym] = quotes.forex[sym];
    });
    Object.keys(quotes.crypto || {}).forEach(function (sym) {
      live.crypto[sym] = quotes.crypto[sym];
    });
    Object.keys(quotes.metals || {}).forEach(function (sym) {
      live.metals[sym] = quotes.metals[sym];
    });
    live.loaded = true;
    live.source = quotes.source || live.source;
    live.updatedAt = quotes.updatedAt || live.updatedAt;
  }

  async function tryOwnerLive() {
    var key = '';
    try { key = sessionStorage.getItem('aurafx_owner_key') || ''; } catch (e) { return null; }
    if (!key) return null;
    try {
      var base = window.AURAFX_API_BASE || '';
      var cfg = await fetch(base + '/api/config').then(function (r) { return r.json(); });
      if (!cfg.ownerPreviewAvailable) return null;
      var r = await fetch(base + '/api/institutional-live', {
        headers: { 'X-Owner-Key': key }
      });
      if (!r.ok) return null;
      window.AURAFX_LIVE_PREVIEW = true;
      return await r.json();
    } catch (e) {
      return null;
    }
  }

  function applyLiveOverlay(data, live) {
    if (!live || !live.institutional) return data;
    data.institutional = live.institutional;
    data._liveScanner = live.scanner;
    data._liveWatchlist = live.watchlist;
    data._livePreview = true;
    if (live.warnings && live.warnings.length) {
      data.warnings = (data.warnings || []).concat(live.warnings);
    }
    mergeServerQuotes(live.quotes);
    return data;
  }

  function mountMarkets(extra, liveOverlay) {
    extra = extra || {};
    var data = buildMarketsData(extra);
    data = applyLiveOverlay(data, liveOverlay);
    if (extra.warnings && extra.warnings.length) {
      data.warnings = (data.warnings || []).concat(extra.warnings);
    }
    var dash = document.getElementById('aurafx-global-markets');
    var home = document.getElementById('aurafx-global-home');
    if (dash) {
      dash.innerHTML = renderAll(data);
      bindTabs(dash);
      bindSearch(dash);
      bindCalcs();
      if (window.AURAFX_TICKER) {
        window.AURAFX_TICKER.seedFromData(data);
        if (data._livePreview) window.AURAFX_TICKER.syncFromLiveQuotes();
        document.dispatchEvent(new CustomEvent('aurafx-markets-mounted'));
      }
    }
    if (home) home.innerHTML = renderHomeSummary(data);
    var xau = (data.metals || []).find(function (m) { return m.symbol === 'XAUUSD'; });
    if (xau && window.AURAFX_INST_FALLBACK && window.AURAFX_INST_FALLBACK.gold) {
      window.AURAFX_INST_FALLBACK.gold.price = parseFloat(xau.spotPrice) || window.AURAFX_INST_FALLBACK.gold.price;
    }
  }

  var ownerRefreshTimer = null;

  function loadMarkets() {
    return Promise.all([fetchExtra(), tryOwnerLive()]).then(function (parts) {
      mountMarkets(parts[0], parts[1]);
    });
  }

  function init() {
    loadMarkets();
    if (ownerRefreshTimer) clearInterval(ownerRefreshTimer);
    ownerRefreshTimer = setInterval(loadMarkets, 60000);
    setInterval(function () {
      if (window.AURAFX_refreshLiveQuotes) window.AURAFX_refreshLiveQuotes();
    }, 30000);
    document.addEventListener('aurafx-quotes-updated', function () {
      if (window.AURAFX_TICKER) window.AURAFX_TICKER.syncFromLiveQuotes();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
