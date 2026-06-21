# AuraFX Elite — MetaTrader 5 Installation Guide

## Requirements

- MetaTrader 5 build 3000+
- Windows / Mac / Linux MT5 terminal
- Demo or live account with your broker

## Step 1 — Copy files

1. Open MT5 → **File → Open Data Folder**.
2. You will see a folder named `MQL5`.
3. From this project, copy:
   - `Indicators/AuraFX_Elite_Signals.mq5` → `MQL5/Indicators/`
   - `Experts/AuraFX_Elite_EA.mq5` → `MQL5/Experts/`
   - `Include/AuraFX_Core.mqh` → `MQL5/Include/`

## Step 2 — Compile

1. Press **F4** to open MetaEditor.
2. In the Navigator tree, open `Indicators/AuraFX_Elite_Signals.mq5`.
3. Press **Compile** (F7). Expect: `0 error(s), 0 warning(s)`.
4. Repeat for `Experts/AuraFX_Elite_EA.mq5`.

If compile fails with "cannot open AuraFX_Core.mqh", ensure the `.mqh` file is in `MQL5/Include/`.

## Step 3 — Attach indicator

1. In MT5 **Navigator → Indicators → Custom**.
2. Drag **AuraFX_Elite_Signals** onto your chart.
3. Enable **Allow Algo Trading** if using the EA later.
4. Recommended inputs for first run:
   - Target win rate: `76`
   - Alerts: `true`
   - Show panel: `true`

## Step 4 — Optional Expert Advisor

1. Navigator → **Expert Advisors → AuraFX_Elite_EA**.
2. Drag onto the **same symbol** chart.
3. Set lot size or enable auto-lots with risk %.
4. Test on **Strategy Tester** first (Visual mode recommended).

## Step 5 — Gold vs Forex

The engine **auto-detects** XAU/GOLD symbols and applies gold-tuned periods. No extra configuration required for XAUUSD.

For exotic pairs, increase `InpAtrMultMin` slightly (e.g. `0.45`) to reduce noise.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| No arrows on chart | Use H1/M15, ensure 100+ bars loaded |
| Panel not visible | Set `InpShowPanel = true`, check chart not maximized under objects |
| EA not trading | Enable AutoTrading button, check Experts tab for errors |
| Alerts silent | Tools → Options → Notifications, enable in indicator inputs |

## Strategy Tester

1. View → Strategy Tester
2. Expert: `AuraFX_Elite_EA`
3. Symbol: EURUSD or XAUUSD
4. Period: H1
5. Model: Every tick based on real ticks (if available)

---

After installation, run at least **2 weeks on demo** before live trading.
