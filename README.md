# AuraFX Elite + Pro — Live Website + MetaTrader 5

## 🌐 Live website (marketing)

```powershell
cd website
npm install
npm start
```

Or double-click **`START-LIVE-WEBSITE.bat`**

- **Home:** http://127.0.0.1:3847  
- **Live dashboard:** http://127.0.0.1:3847/dashboard.html  
- Deploy online: **`website/DEPLOY.md`**
- **Paid hosting + domain:** **`website/PAID-HOSTING-SETUP.md`** or **`BUY-HOSTING-NOW.txt`**

---

# AuraFX Elite + Pro — Forex & Gold Trading Assistant for MetaTrader 5

Premium trading signals and **Pro assistant** for **MetaTrader 5** and the **MQL5 Market**: MTF confirmation, AI scoring, SMC structure, news protection, risk limits, gold module, probability dashboard, and trade journal.

## Package contents

| File | Purpose |
|------|---------|
| `MQL5/Indicators/AuraFX_Elite_Signals.mq5` | Main signal indicator with HUD |
| `MQL5/Indicators/AuraFX_Risk_Guardian.mq5` | **Live news & risk warnings** |
| `MQL5/Indicators/AuraFX_Pro_Assistant.mq5` | **Pro assistant** (score, checklist, MTF) |
| `MQL5/Experts/AuraFX_Elite_EA.mq5` | Auto-trading EA + risk warnings |
| `MQL5/Experts/AuraFX_Pro_EA.mq5` | Pro EA (MTF, score, R:R, loss limits) |
| `MQL5/Include/AuraFX_Pro.mqh` | Pro engine (20-feature core) |
| `MQL5/Include/AuraFX_Structure.mqh` | FVG, OB, BOS, CHOCH |
| `pro-dashboard/` | Probability UI, journal, screenshot tool |
| `docs/PRO_FEATURES.md` | Full 20-feature map |
| `MQL5/Include/AuraFX_Core.mqh` | Shared signal engine |
| `MQL5/Include/AuraFX_NewsRisk.mqh` | News/calendar/trade protection engine |
| `news-risk-server/` | Live news API (Finnhub + RSS) |
| `risk-dashboard/` | Browser risk dashboard + push alerts |
| `docs/INSTALLATION.md` | MT5 install steps |
| `docs/MARKETPLACE_LISTING.md` | Copy for MQL5 Market listing |
| `docs/STRATEGY_TESTER_GUIDE.md` | How to backtest in MT5 |
| `docs/templates/strategy-tester-report.html` | Fillable tester report + PDF |
| `MQL5/Presets/*.set` | Symbol presets (EURUSD, XAUUSD, etc.) |
| `marketplace/icons/` | Branded 140/200 logos for MQL5 Market |
| `preview/` | Marketing preview (open `index.html`) |

## Quick install (MetaTrader 5)

1. In MT5: **File → Open Data Folder**
2. Copy the entire `MQL5` folder from this project into that data folder (merge folders).
3. Open **MetaEditor** (F4).
4. Compile `AuraFX_Elite_Signals.mq5` and `AuraFX_Elite_EA.mq5`.
5. In MT5 Navigator: **Indicators → AuraFX_Elite_Signals** → drag onto chart.

### Recommended charts

- **Gold:** XAUUSD, H1 or M15
- **Forex:** EURUSD, GBPUSD, USDJPY — H1

## Signal types

- **BUY** — Bullish EMA cross + MACD + RSI confluence
- **SELL** — Bearish confluence
- **COVER** — Exit / protect when momentum fades (short cover & long protection)

## Win rate display

The panel shows a **target win rate** (default 76%, configurable 75–78%). Live win rate is calculated from closed signals on your chart. **Always backtest and demo-trade** before live use.

## AuraFX Pro (20-feature assistant)

See **`docs/PRO_FEATURES.md`** for the complete map.

1. Attach **`AuraFX_Pro_Assistant`** on chart, or run **`AuraFX_Pro_EA`** on demo  
2. Load preset **`AuraFX_Pro_XAUUSD_H1.set`** for gold  
3. Open **`pro-dashboard/index.html`** for probability UI + trade journal  

> Scores and “AI” outputs are **rule-based assistants**, not guaranteed predictions.

## News & Risk Warning System

**Protects you from volatile news — warnings only, never auto-closes without your choice.**

1. Attach `AuraFX_Risk_Guardian` on MT5 chart (or use updated EA with `InpEnableNewsGuard`).
2. Start news server: `cd news-risk-server && npm install && npm start`
3. Open `risk-dashboard/index.html` for full dashboard + red alerts + sound.

See **`docs/NEWS_RISK_SYSTEM.md`** for full setup.

> This is not financial advice. This is a risk warning tool. Final decision is always yours.

## Preview dashboard

Open in a browser:

```
AuraFX-Elite/preview/index.html
AuraFX-Elite/risk-dashboard/index.html
```

## Legal disclaimer

Trading forex and gold involves substantial risk. Past performance does not guarantee future results. This software is a tool, not financial advice. See `docs/DISCLAIMER.md`.

## Strategy Tester & presets

1. Follow **`docs/STRATEGY_TESTER_GUIDE.md`**
2. Load presets from **`MQL5/Presets/`** (see `MQL5/Presets/README.md`)
3. Record results in **`docs/templates/strategy-tester-report.html`**

## Selling on MQL5 Market

- Listing copy: `docs/MARKETPLACE_LISTING.md`
- Logo: `marketplace/icons/aura-icon-200.png`
- Banner: `marketplace/banners/aura-market-banner.svg`

---

© 2026 AuraFX Labs · MetaTrader 5 Edition
