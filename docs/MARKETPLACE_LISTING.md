# MQL5 Market Listing — AuraFX Elite

Use this copy when publishing on [MQL5 Market](https://www.mql5.com/en/market).

## Product title

**AuraFX Elite — Forex & Gold Signals | Sell + Cover | 76% Target HUD**

## Short description (500 chars max)

AuraFX Elite delivers elegant BUY, SELL, and COVER signals for Forex majors and XAUUSD Gold. Gold-optimized and Forex-tuned confluence engine (EMA + MACD + RSI + ATR filter). Luxury on-chart panel with live win-rate tracking toward 75–78% target. Includes Expert Advisor with risk-based lots, SL/TP, and cover protection. Marketplace-ready, fully commented source.

## Full description

### Overview

AuraFX Elite is a professional-grade signal system built exclusively for **MetaTrader 5**. It combines institutional-style confluence logic with an elegant gold-on-obsidian chart panel—the perfect product for traders who want clarity, speed, and premium presentation.

### Features

- **Multi-asset:** Auto-detects Forex vs Gold (XAUUSD) and applies optimized parameters
- **Three signal modes:** BUY, SELL, and COVER (protect positions / cover shorts)
- **Elegant HUD:** Real-time panel with win rate, wins/losses, and signal status
- **Alerts:** Popup and mobile push notifications
- **Expert Advisor:** Optional automation with magic number, SL/TP, auto-lot sizing
- **Marketplace quality:** Clean MQL5 code, include library, full documentation

### Signal logic

Signals require alignment of:

1. EMA fast/slow crossover
2. MACD momentum confirmation
3. RSI filter (not overbought for buys, not oversold for sells)
4. ATR minimum range filter (reduces chop)

**COVER** signals fire when extended moves show momentum fade—helping traders exit or protect exposure.

### Recommended use

| Asset | Symbol | Timeframe |
|-------|--------|-----------|
| Gold | XAUUSD | M15, H1 |
| Forex | EURUSD, GBPUSD | H1 |

Always validate on demo and Strategy Tester before live deployment.

### What's included

1. `AuraFX_Elite_Signals.mq5` (indicator)
2. `AuraFX_Elite_EA.mq5` (expert advisor)
3. `AuraFX_Core.mqh` (shared library)
4. Installation PDF-style guide (README + INSTALLATION.md)

### Screenshots checklist

Capture these for your listing:

1. XAUUSD H1 with panel showing SELL signal
2. EURUSD with BUY arrow and panel
3. COVER signal on gold chart
4. Strategy Tester equity curve (fill `docs/templates/strategy-tester-report.html`)
5. Risk Guardian panel — DANGEROUS mood before news
6. Inputs dialog showing target win rate 76%

### Branded assets (included)

| Asset | Path |
|-------|------|
| Logo 200×200 | `marketplace/icons/aura-icon-200.png` |
| Logo 140×140 | `marketplace/icons/aura-icon-140.png` |
| Vector master | `marketplace/icons/aura-icon-master.svg` |
| Promo banner | `marketplace/banners/aura-market-banner.svg` |

See `marketplace/icons/README.md` for brand colors and resize notes.

### Suggested pricing tiers

| Tier | Price (USD) | Notes |
|------|-------------|-------|
| Indicator only | $49–79 | Entry product |
| Indicator + EA | $99–149 | Best seller bundle |
| Rent monthly | $15–25 | MQL5 rental option |

### Keywords

forex signals, gold signals, XAUUSD, MetaTrader 5, trading indicator, sell signal, cover signal, expert advisor, win rate, premium indicator

### Support blurb

Support via MQL5 comments. Updates include parameter presets and additional symbols on request.

---

**Compliance note for listing:** Do not promise guaranteed profits. State that results vary by broker, spread, and timeframe. Include risk disclaimer from `DISCLAIMER.md`.
