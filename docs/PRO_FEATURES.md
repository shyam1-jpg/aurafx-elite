# AuraFX Pro — Feature Map (20-Point System)

Professional trading assistant. **Does not guarantee profits.**

| # | Feature | MT5 | Web Dashboard | Notes |
|---|---------|-----|---------------|-------|
| 1 | Multi-Timeframe (M1–H4) | ✅ `AuraFX_Pro.mqh` | — | Requires 4/5 TFs agree |
| 2 | Smart risk (0.5–2%, daily/weekly/DD lock) | ✅ Pro EA | Journal | Auto lot from SL |
| 3 | AI trade scoring 0–100 | ✅ | ✅ `/api/pro-summary` | Rule-based confluence |
| 4 | Order flow (FVG, OB, BOS, CHOCH, liquidity) | ✅ `AuraFX_Structure.mqh` | — | Algorithmic SMC |
| 5 | Economic calendar protection | ✅ `AuraFX_NewsRisk.mqh` | ✅ risk-dashboard | 30 min block default |
| 6 | Market regime detection | ✅ | — | Trend / Range / Volatile / News |
| 7 | Correlation monitor | ✅ | — | Gold vs USD proxy, EUR |
| 8 | AI trade journal | — | ✅ `pro-dashboard` | localStorage + insights |
| 9 | S/R AI (D/W/M + supply/demand) | ✅ | Screenshot overlay | Swing + structure zones |
| 10 | Probability dashboard | ✅ Panel | ✅ pro-dashboard | Bull/Bear % |
| 11 | Smart stop-loss (swing + ATR + zones) | ✅ | Screenshot hints | Beyond liquidity |
| 12 | R:R filter (min 1:2, pref 1:3) | ✅ Pro EA | Checklist | Rejects poor R:R |
| 13 | Session intelligence | ✅ | ✅ | Asian / London / NY / Overlap |
| 14 | Sentiment scanner | ✅ | ✅ | News + score derived |
| 15 | AI trade checklist (9 items) | ✅ | ✅ | Must pass for Pro EA |
| 16 | Personal performance AI | — | ✅ | Best hour/setup from journal |
| 17 | Emergency crash detector | ✅ | ✅ Banner | ATR spike + breaking news |
| 18 | Gold (XAUUSD) specialist | ✅ | — | Vol, DXY proxy, overlap |
| 19 | Screenshot analysis | — | ✅ Canvas overlay | Assistive estimates |
| 20 | Portfolio protection | ✅ | ✅ | Exposure, corr, loss limits |

---

## Files to install

```
MQL5/Include/AuraFX_Pro.mqh
MQL5/Include/AuraFX_Structure.mqh
MQL5/Indicators/AuraFX_Pro_Assistant.mq5
MQL5/Experts/AuraFX_Pro_EA.mq5
```

Also keep existing: `AuraFX_Core.mqh`, `AuraFX_NewsRisk.mqh`, `AuraFX_Risk_Guardian.mq5`

## Quick start

1. Compile **AuraFX_Pro_Assistant** → attach to chart (read-only assistant)
2. Or **AuraFX_Pro_EA** → demo test with `AuraFX_Pro_XAUUSD_H1.set`
3. `cd news-risk-server && npm start`
4. Open `pro-dashboard/index.html`

## Scoring guide

| Score | Label |
|-------|-------|
| 90–100 | Excellent setup |
| 80–89 | Good setup |
| 70–79 | Marginal — caution |
| &lt;70 | Avoid (Pro EA blocks by default) |

## Checklist (MT5)

☑ Trend (MTF) · ☑ S/R · ☑ News clear · ☑ Risk limits · ☑ R:R ≥ 1:2  
☑ Volume · ☑ Session · ☑ MTF · ☑ Structure (BOS/FVG)

## Disclaimer

This is not financial advice. This is a risk warning and analysis assistant. Final decision is always yours. Past performance does not guarantee future results.
