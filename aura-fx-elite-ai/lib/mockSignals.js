// Demo signal generator — the trade IDEAS are still mock/educational,
// but entry/stop/target levels are anchored to LIVE prices when available.
// Replace with the real pipeline later:
// market data -> indicators (RSI/MACD/EMA/ATR/S&R) -> risk filter -> rules -> AI explanation.

import { BASELINE } from "./livePrices";

const CONDITIONS = ["Trending", "Range", "High volatility"];

const EXPLANATIONS = {
  BUY: (a) =>
    `${a} is trading above its 50-period EMA with RSI recovering from oversold territory and MACD showing a bullish crossover. Price is holding above a support zone tested twice this week. This is a demo educational setup — if this were a live signal, the invalidation level (stop loss) would sit below that support. Markets can move against any setup; manage risk accordingly.`,
  SELL: (a) =>
    `${a} rejected a well-defined resistance zone while RSI printed lower highs (bearish divergence) and momentum is fading on the MACD histogram. This demo setup illustrates a mean-reversion short back toward the range midpoint. AI analysis can be wrong — a break and hold above resistance invalidates the idea.`,
  WAIT: (a) =>
    `${a} is stuck between support and resistance with ATR contracting and no clear momentum on RSI or MACD. Conditions are unclear, so the engine outputs WAIT / NO TRADE. Not trading is a decision too — this is the risk filter doing its job.`
};

// Simple seeded PRNG so the demo signal DIRECTION is stable per day
function seeded(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function fmt(n, d) {
  return n.toFixed(d);
}

export function generateMockSignals(date = new Date(), livePrices = null) {
  const daySeed =
    date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
  const rand = seeded(daySeed);

  return Object.entries(BASELINE).map(([symbol, base], i) => {
    const lp = livePrices?.[symbol];
    const px = lp?.live ? lp.price : base.price * (1 + (rand() - 0.5) * 0.01);
    const d = base.decimals;

    const roll = rand();
    const status = roll < 0.35 ? "BUY" : roll < 0.65 ? "SELL" : "WAIT";
    const atr = px * (0.004 + rand() * 0.006); // 0.4–1% mock ATR
    const dir = status === "SELL" ? -1 : 1;

    const entryLow = px - atr * 0.25;
    const entryHigh = px + atr * 0.25;
    const stop = px - dir * atr * 1.2;
    const t1 = px + dir * atr * 1.5;
    const t2 = px + dir * atr * 2.8;

    return {
      id: `${daySeed}-${i}`,
      asset: symbol,
      status,
      marketCondition: CONDITIONS[Math.floor(rand() * CONDITIONS.length)],
      currentPrice: fmt(px, d),
      priceSource: lp?.live ? "live" : "demo",
      entryZone: status === "WAIT" ? "—" : `${fmt(entryLow, d)} – ${fmt(entryHigh, d)}`,
      stopLoss: status === "WAIT" ? "—" : fmt(stop, d),
      target1: status === "WAIT" ? "—" : fmt(t1, d),
      target2: status === "WAIT" ? "—" : fmt(t2, d),
      confidence: status === "WAIT" ? 0 : Math.round(55 + rand() * 25),
      generatedAt: date.toISOString().slice(0, 16).replace("T", " ") + " UTC",
      valid: true,
      approvalStatus: "pending",
      explanation: EXPLANATIONS[status](symbol),
      disclaimer:
        "Educational demo signal. Not financial advice. Trading involves high risk of loss."
    };
  });
}
