# AuraFX Elite — Strategy Tester Guide & Report Template

Use this workflow before publishing on **MQL5 Market** or going live.

## 1. Open Strategy Tester

1. MT5 → **View → Strategy Tester** (Ctrl+R)
2. **Expert:** `AuraFX_Elite_EA`
3. **Symbol:** start with `EURUSD` or `XAUUSD`
4. **Period:** H1 (or M15 for scalping preset)
5. **Dates:** at least 12 months
6. **Model:** *Every tick based on real ticks* (if your broker provides tick data)
7. **Deposit:** match your planned account (e.g. 10,000 USD)

## 2. Load preset

1. Inputs tab → **Load**
2. Choose from `MQL5/Presets/`:

| Preset | Use for |
|--------|---------|
| `AuraFX_EA_EURUSD_H1.set` | Major forex backtest |
| `AuraFX_EA_XAUUSD_H1.set` | Gold H1 with news guard |
| `AuraFX_EURUSD_H1.set` | Indicator-only signal tuning |
| `AuraFX_XAUUSD_M15.set` | Faster gold timeframe |

Copy presets to:  
`Terminal Data Folder/MQL5/Profiles/Tester/`  
or load from the `.set` file path in Inputs dialog.

## 3. Recommended test matrix

Run **separate** tests for each row and record in the HTML report:

| # | Symbol | TF | Preset | Min. months |
|---|--------|-----|--------|-------------|
| 1 | EURUSD | H1 | AuraFX_EA_EURUSD_H1 | 12 |
| 2 | GBPUSD | H1 | AuraFX_EA_EURUSD_H1 (tune SL) | 12 |
| 3 | USDJPY | H1 | AuraFX_EA_EURUSD_H1 | 12 |
| 4 | XAUUSD | H1 | AuraFX_EA_XAUUSD_H1 | 12 |
| 5 | XAUUSD | M15 | AuraFX_XAUUSD_M15 + EA | 6 |

## 4. Export results from MT5

After each run:

1. **Results** tab → right-click → **Report** → save as HTML (optional)
2. Note manually:
   - Net profit
   - Profit factor
   - Total trades
   - Profit trades % (win rate)
   - Balance drawdown maximal %
   - Expected payoff

3. **Graph** tab → screenshot equity curve (for Market listing)

## 5. Fill report template

Open in browser:

```
docs/templates/strategy-tester-report.html
```

- Enter real numbers from Tester
- **Export JSON** for your records
- **Print / PDF** for documentation

Blank JSON schema: `docs/templates/strategy-tester-report.json`

## 6. Visual mode (Risk Guardian)

1. Attach `AuraFX_Risk_Guardian` on same symbol in a **separate chart** while testing news periods
2. Confirm warnings appear before high-impact calendar events (demo forward test)

## 7. Marketplace compliance

In your listing:

- Do **not** promise fixed win rates
- State results are **Tester / demo** dependent
- Include disclaimer from `docs/DISCLAIMER.md`
- Attach **equity screenshot** + one **panel screenshot**

## 8. Optimization (optional)

If optimizing:

- Limit variables: `InpRsiBuyMax`, `InpRsiSellMin`, `InpAtrMultMin`, `InpSlPoints`, `InpTpPoints`
- Use **genetic algorithm** with max 10,000 passes
- Validate best set on **out-of-sample** 3-month period

---

© 2026 AuraFX Labs
