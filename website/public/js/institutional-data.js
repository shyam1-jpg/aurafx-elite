/* AuraFX institutional data — fallback when API unavailable */
window.AURAFX_INST_FALLBACK = {
  marketOverview: {
    sentiment: 'Risk-On',
    riskMode: 'Moderate Risk-On',
    fearGreed: 62,
    vix: 18.4,
    currencyStrength: [
      { c: 'USD', s: 88 }, { c: 'EUR', s: 72 }, { c: 'GBP', s: 65 },
      { c: 'JPY', s: 41 }, { c: 'AUD', s: 58 }, { c: 'XAU', s: 76 }
    ],
    gainers: [{ n: 'XAUUSD', v: '+0.42%' }, { n: 'EURUSD', v: '+0.18%' }, { n: 'GBPUSD', v: '+0.12%' }],
    losers: [{ n: 'USDJPY', v: '-0.21%' }, { n: 'USDCAD', v: '-0.09%' }],
    volumeNote: 'Forex cash session volume +8% vs 20d avg',
    globalStatus: 'US open · Europe active · Asia closed'
  },
  calendar: {
    high: [
      { t: 'US CPI m/m', cur: 'USD', time: '14:30 UTC', impact: 'Inflation' },
      { t: 'FOMC Rate Decision', cur: 'USD', time: '19:00 UTC', impact: 'Interest rate' },
      { t: 'ECB Press Conference', cur: 'EUR', time: '13:45 UTC', impact: 'Central bank' }
    ],
    medium: [
      { t: 'UK GDP q/q', cur: 'GBP', time: '07:00 UTC', impact: 'GDP' },
      { t: 'US Retail Sales', cur: 'USD', time: '13:30 UTC', impact: 'Retail sales' }
    ],
    low: [
      { t: 'AU Employment Change', cur: 'AUD', time: '00:30 UTC', impact: 'Employment' },
      { t: 'JP Trade Balance', cur: 'JPY', time: '23:50 UTC', impact: 'Trade balance' }
    ]
  },
  newsCategories: {
    forex: ['Dollar firms ahead of CPI', 'EUR range-bound pre-ECB'],
    gold: ['Gold holds bid on haven flows', 'XAU tests weekly resistance'],
    stocks: ['US futures flat into data', 'Tech sector leads pre-market'],
    crypto: ['BTC consolidates under key MA'],
    geo: ['Middle East headlines monitored'],
    energy: ['Oil steady on supply outlook'],
    commodity: ['Copper tracks China demand'],
    breaking: ['High-impact US data in 45 min'],
    centralBank: ['Fed speakers emphasize data-dependence'],
    institutions: ['Major bank raises gold targets']
  },
  gold: {
    price: null,
    daily: 'Bullish',
    weekly: 'Bullish',
    monthly: 'Neutral-Bullish',
    support: ['2328', '2315', '2298'],
    resistance: ['2355', '2372', '2390'],
    volume: 'Above 10d average',
    instSentiment: 'Net long bias',
    safeHaven: 'Elevated demand',
    usdCorr: -0.72,
    ratesNote: 'Real yields weighing on extremes'
  },
  forex: {
    strengthRank: ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY'],
    volRank: ['GBPJPY', 'XAUUSD', 'EURUSD', 'USDJPY'],
    trending: ['XAUUSD up', 'EURUSD up', 'USDJPY down'],
    sessions: { asian: 'Range', london: 'Trend', ny: 'Volatile' },
    smartMoney: 'USD accumulation on dips'
  },
  technical: {
    ema: 'EMA 9 > 21 bullish H1',
    sma: 'Price above SMA 200 D1',
    rsi: 'RSI 58 neutral-bull',
    macd: 'MACD histogram rising',
    bb: 'Mid-band ride',
    fib: '61.8% support held',
    trendStrength: 72,
    breakout: 'Watching 2355 gold',
    reversal: 'No reversal signal',
    pattern: 'Ascending triangle forming'
  },
  aiAssistant: {
    setup: 'Gold long bias into CPI with reduced size.',
    risk: 'Event risk may widen spreads 2-5x.',
    sl: 'Below 2328 swing / 1.8x ATR',
    tp: '2355 first target, 2372 extended',
    condition: 'News-driven regime',
    structure: 'Higher lows, BOS pending',
    sr: 'Demand 2328-2332',
    candles: 'Bullish engulfing H4',
    rr: '1:2.4 on primary setup'
  },
  performance: {
    winRate: 76.2,
    rr: 2.1,
    avgWin: 142,
    avgLoss: 68,
    profitFactor: 1.48,
    maxDD: 11.2,
    consecWins: 5,
    consecLoss: 2,
    sharpe: 1.12,
    monthlyGrowth: 4.2
  },
  institutional: {
    cot: 'Gold specs net long increased',
    positioning: 'USD longs elevated',
    hedge: 'Macro funds adding gold hedges',
    oi: 'XAU OI +3% WoW',
    liquidity: 'Deep liquidity NY session'
  },
  aiSummary: 'Forex: USD bid pre-CPI. Gold: haven support firm. Stocks: cautious. Crypto: neutral. Commodities: energy stable. Events: volatility spike expected. Sentiment: risk-on fading into data.',
  alerts: [
    { t: 'NEWS', m: 'US CPI in 45 minutes — HIGH impact' },
    { t: 'VOL', m: 'XAU implied vol elevated' },
    { t: 'TREND', m: 'EURUSD H1 trend intact' },
    { t: 'RISK', m: 'Reduce size 50% before red news' }
  ],
  scanner: [
    { name: 'XAUUSD', type: 'Breakout', score: 84 },
    { name: 'EURUSD', type: 'Trend', score: 78 },
    { name: 'GBPJPY', type: 'Volatility', score: 81 }
  ],
  heatmap: [
    { s: 'XAU', v: 0.8 }, { s: 'EUR', v: 0.4 }, { s: 'GBP', v: 0.3 },
    { s: 'USD', v: 0.6 }, { s: 'JPY', v: -0.5 }, { s: 'OIL', v: 0.1 },
    { s: 'BTC', v: -0.2 }, { s: 'SPX', v: 0.2 }
  ]
};
