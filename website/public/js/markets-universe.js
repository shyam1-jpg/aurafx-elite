/** Complete AuraFX multi-asset universe — API-ready symbol registry */
window.AURAFX_UNIVERSE = {
  forex: {
    majors: ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'NZDUSD', 'USDCAD'],
    minors: [
      'EURGBP', 'EURJPY', 'EURAUD', 'EURNZD', 'EURCAD', 'GBPJPY', 'GBPAUD', 'GBPCAD',
      'AUDJPY', 'AUDNZD', 'AUDCAD', 'NZDJPY'
    ],
    exotics: [
      'USDTRY', 'USDZAR', 'USDMXN', 'USDSGD', 'USDHKD', 'USDSEK', 'USDNOK',
      'USDDKK', 'USDPLN', 'USDCNH'
    ]
  },
  crypto: [
    'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'TRX', 'AVAX', 'LINK',
    'DOT', 'LTC', 'BCH', 'SHIB', 'PEPE', 'ARB', 'OP', 'MATIC', 'UNI', 'AAVE',
    'RNDR', 'INJ', 'NEAR', 'APT', 'SUI', 'KAS', 'HBAR', 'TON', 'ATOM', 'ALGO',
    'VET', 'FIL'
  ],
  metals: ['XAUUSD', 'XAGUSD', 'XPTUSD', 'XPDUSD', 'COPPER'],
  energy: ['WTI', 'BRENT', 'NATGAS', 'HEATOIL', 'GASOLINE'],
  indices: [
    'US30', 'US500', 'NAS100', 'RUT2000', 'DAX40', 'FTSE100', 'CAC40', 'NIK225',
    'HSI', 'ASX200', 'STOXX50', 'IBEX35', 'SMI'
  ],
  ag: ['CORN', 'WHEAT', 'SOYBEANS', 'COFFEE', 'SUGAR', 'COTTON', 'COCOA', 'OJ', 'RICE', 'LUMBER'],
  technical: [
    'EMA', 'SMA', 'VWAP', 'RSI', 'MACD', 'Stochastic', 'ATR', 'ADX', 'CCI', 'OBV', 'MFI',
    'Ichimoku', 'Bollinger Bands', 'Keltner Channels', 'Pivot Points', 'Volume Profile',
    'Fibonacci Levels', 'Market Structure', 'Order Blocks', 'Liquidity Zones', 'Fair Value Gaps',
    'Break Of Structure', 'Change Of Character'
  ],
  smc: [
    'Order Blocks', 'Liquidity Pools', 'Institutional Footprints', 'Mitigation Blocks',
    'Breaker Blocks', 'Fair Value Gaps', 'Premium Discount Zones', 'Market Structure Shifts'
  ],
  aiModules: [
    'AI Trade Assistant', 'AI Risk Analysis', 'AI Entry Suggestions', 'AI Exit Suggestions',
    'AI Stop Loss Suggestions', 'AI Take Profit Suggestions', 'AI Sentiment Engine',
    'AI News Interpretation', 'AI Pattern Recognition', 'AI Probability Engine'
  ],
  newsCats: [
    'Forex News', 'Crypto News', 'Commodity News', 'Metal News', 'Index News',
    'Central Bank News', 'Breaking News', 'Economic Releases', 'Geopolitical Events'
  ],
  calculators: [
    'Position Size', 'Risk', 'Margin', 'Lot Size', 'Pip', 'Compound',
    'Drawdown', 'Profit', 'Funding'
  ]
};
