// Live spot prices from free, keyless public APIs.
// Coinbase (BTC/ETH), gold-api.com (XAU), Frankfurter/ECB (EUR, GBP).
// Any feed that fails falls back to a demo baseline price — the app never breaks.

export const BASELINE = {
  "BTC/USD": { price: 100000, decimals: 0 },
  "ETH/USD": { price: 3500, decimals: 0 },
  "XAU/USD": { price: 2400, decimals: 1 },
  "EUR/USD": { price: 1.085, decimals: 4 },
  "GBP/USD": { price: 1.275, decimals: 4 }
};

async function getJson(url) {
  const res = await fetch(url, { next: { revalidate: 300 } }); // cache 5 min
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

export async function getLivePrices() {
  const prices = {};
  for (const [sym, v] of Object.entries(BASELINE)) {
    prices[sym] = { price: v.price, decimals: v.decimals, live: false };
  }

  const [btc, eth, xau, fx] = await Promise.allSettled([
    getJson("https://api.coinbase.com/v2/prices/BTC-USD/spot"),
    getJson("https://api.coinbase.com/v2/prices/ETH-USD/spot"),
    getJson("https://api.gold-api.com/price/XAU"),
    getJson("https://api.frankfurter.dev/v1/latest?from=USD&to=EUR,GBP")
  ]);

  if (btc.status === "fulfilled") {
    const p = parseFloat(btc.value?.data?.amount);
    if (p > 0) prices["BTC/USD"] = { ...prices["BTC/USD"], price: p, live: true };
  }
  if (eth.status === "fulfilled") {
    const p = parseFloat(eth.value?.data?.amount);
    if (p > 0) prices["ETH/USD"] = { ...prices["ETH/USD"], price: p, live: true };
  }
  if (xau.status === "fulfilled") {
    const p = parseFloat(xau.value?.price);
    if (p > 0) prices["XAU/USD"] = { ...prices["XAU/USD"], price: p, live: true };
  }
  if (fx.status === "fulfilled") {
    const eur = parseFloat(fx.value?.rates?.EUR); // USD->EUR, so EUR/USD = 1/rate
    const gbp = parseFloat(fx.value?.rates?.GBP);
    if (eur > 0) prices["EUR/USD"] = { ...prices["EUR/USD"], price: 1 / eur, live: true };
    if (gbp > 0) prices["GBP/USD"] = { ...prices["GBP/USD"], price: 1 / gbp, live: true };
  }

  const liveCount = Object.values(prices).filter((p) => p.live).length;
  const dataMode =
    liveCount === Object.keys(prices).length ? "live" : liveCount > 0 ? "partial" : "demo";

  return { prices, dataMode, fetchedAt: new Date().toISOString() };
}
