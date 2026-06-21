# AuraFX Elite — Input Presets

Copy all `.set` files to:

```
<MT5 Data Folder>/MQL5/Presets/
```

Load via indicator/EA **Inputs → Load** or Strategy Tester **Inputs → Load**.

## Signal / Indicator presets

| File | Symbol | TF | Notes |
|------|--------|-----|-------|
| `AuraFX_Forex_H1.set` | Any major | H1 | Default forex |
| `AuraFX_Gold_H1.set` | XAUUSD | H1 | Gold tuned |
| `AuraFX_XAUUSD_H1.set` | XAUUSD | H1 | Same as Gold |
| `AuraFX_EURUSD_H1.set` | EURUSD | H1 | |
| `AuraFX_GBPUSD_H1.set` | GBPUSD | H1 | Slightly wider ATR filter |
| `AuraFX_USDJPY_H1.set` | USDJPY | H1 | |
| `AuraFX_USDCHF_H1.set` | USDCHF | H1 | |
| `AuraFX_AUDUSD_H1.set` | AUDUSD | H1 | |
| `AuraFX_EURUSD_M15.set` | EURUSD | M15 | Faster |
| `AuraFX_XAUUSD_M15.set` | XAUUSD | M15 | Active gold |

## Expert Advisor (Strategy Tester)

| File | Use |
|------|-----|
| `AuraFX_EA_EURUSD_H1.set` | EURUSD backtest defaults |
| `AuraFX_EA_XAUUSD_H1.set` | Gold + news block on high events |

## Risk Guardian

| File | Use |
|------|-----|
| `AuraFX_Risk_Guardian_Default.set` | 90 min warning window |
| `AuraFX_Risk_Guardian_Gold.set` | 120 min window, faster refresh |
