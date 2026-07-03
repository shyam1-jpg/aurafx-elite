# XG Gold Robot MT5 — Competitive Analysis & AuraFX Design

**Source:** [XG Gold Robot MT5 on MQL5 Market](https://www.mql5.com/en/market/product/92195)  
**Author:** MQL TOOLS SL · v9.2 · ~$1,999 USD · 4.27★ (113 reviews)  
**Design target:** AuraFX **Gold Sovereign EA** — premium XAUUSD specialist for MQL5 Market

---

## 1. What XG Gold Robot Is

XG Gold Robot is a **MetaTrader 5 Expert Advisor** built exclusively for gold:

| Attribute | Value |
|-----------|-------|
| Symbols | XAUUSD, GOLD, XAUEUR |
| Timeframe | **H1** |
| Min deposit | $1,000 |
| Leverage | 1:10 – 1:1000 |
| Account types | Raw, Hedging, Zero, Micro, Cent, Standard, Premium, ECN |
| Min lot | 0.01 |

It is **not** a web app or mobile app — it runs inside MT5 on the chart, with an on-chart control panel and broker-agnostic execution.

---

## 2. Strategy Engine (Reverse-Engineered from Listing)

XG Gold uses a **multi-indicator confluence** approach:

```
┌─────────────────────────────────────────────────────────────┐
│                    ENTRY DECISION (H1 bar close)            │
├─────────────────────────────────────────────────────────────┤
│  Price Action patterns                                      │
│  + Cycle Strength (custom)                                  │
│  + SMA Strength (trend filter)                              │
│  + RSI (momentum / overbought-oversold)                     │
│  + 2 proprietary custom indicators (built-in, not separate) │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    PRE-TRADE FILTERS                        │
├─────────────────────────────────────────────────────────────┤
│  Time filter      — allowed days + hours                    │
│  News filter      — block ±60 min around high-impact news   │
│  Spread filter    — MaxSpread cap                           │
│  Volume filter    — gold tick volume sanity check           │
│  FIFO mode        — broker FIFO compliance                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    RISK & EXECUTION                         │
├─────────────────────────────────────────────────────────────┤
│  Risk % lot sizing                                          │
│  Risk mode: Low / Medium / High                             │
│  Trade comment (custom label per order)                     │
└─────────────────────────────────────────────────────────────┘
```

**Key differentiator:** Weekly Gold Levels — prior week high/low drawn on chart **and** shown in the panel for manual traders.

---

## 3. On-Chart Panel (XG Style)

Shared panel design across MQL TOOLS SL products:

| Zone | Content |
|------|---------|
| Header | EA name, version |
| P&L | Daily profit ($), daily pips |
| Session | Current forex session (Asian / London / NY) |
| Calendar | Next high-impact news event |
| Market | Live spread |
| Levels | Weekly gold high / low |
| Controls | Close All, Close Buys, Close Sells buttons |

---

## 4. Parameter Surface (Full Input Groups)

### Trading
- `RiskPercent` — auto lot from balance risk
- `SelectRiskMode` — Low / Medium / High (scales aggression)
- `TradeComment` — order comment string
- `FIFO` — enable for FIFO brokers

### Filters
- `TradeHours` — start/end hour, allowed weekdays
- `MaxSpread` — points
- `NewsFilter` — on/off
- `doNotTradeBeforeInMinutes` / `doNotTradeAfterInMinutes` — default 60
- `ReportForUSD` / `ReportForEUR` — news currency scope
- `AllowTradingOnHolidays` — override during holidays
- `FilterVolume` — gold volume gate

### Display
- `ShowPanel` — HUD toggle
- `WeeklyGoldLevels` — lines + panel values

### Testing (seller recommendation)
- Deposit: $1,000 · Every Tick · Risk 5–10% · Leverage 1:500 · Risk mode Low/Medium

---

## 5. AuraFX Gap Analysis

| XG Gold Feature | AuraFX Today | Gap |
|-----------------|--------------|-----|
| H1 gold-only EA | Gold Reaper (basic), Crown/Queen (advanced) | Need dedicated H1 flagship |
| Price Action + Cycle + SMA + RSI | Core signal + Structure + Pro scoring | Cycle Strength missing |
| Weekly gold levels on chart | `AuraFX_LoadSRLevels` has weekly H/L | Not drawn as chart lines in Gold Reaper |
| Rich trader panel | Basic `AuraFX_DrawPanel` (7 lines) | Missing session, spread, news, buttons |
| Risk Low/Med/High presets | Crown has Low/Medium only | Add High + clearer mapping |
| News ±60 min block | `AuraFX_NewsRisk.mqh` exists | Wired in Gold Reaper but basic |
| Volume filter | Not in Gold Reaper | New filter needed |
| FIFO mode | Not present | Add close-then-open logic |
| Trade hours / holidays | Session filter in Elite Classic | Not in Gold Reaper |
| MQL5 listing polish | Catalog at $849 for Gold Reaper | Reposition at $1,499–1,999 tier |

---

## 6. Proposed Product: **AuraFX Gold Sovereign EA**

**Positioning:** XG Gold Robot competitor with AuraFX's obsidian-gold HUD, structure engine, and compliance-first copy.

**File:** `MQL5/Experts/AuraFX_Gold_Sovereign_EA.mq5`  
**Includes:** Reuse `AuraFX_Core.mqh`, `AuraFX_Pro.mqh`, `AuraFX_NewsRisk.mqh`, `AuraFX_Structure.mqh`  
**New include:** `AuraFX_GoldPanel.mqh` — XG-style extended panel + weekly level lines

### 6.1 Strategy Stack (Sovereign Engine)

```mql5
// Confluence score 0–100; entry when score >= threshold (mode-dependent)
int SovereignScore(bool &buy, bool &sell)
{
   // 1. Price Action — engulfing / pin bar / inside bar (Structure.mqh)
   // 2. Cycle Strength — RSI(14) slope + MACD histogram momentum (new)
   // 3. SMA Strength — EMA8 vs EMA21 distance normalized by ATR
   // 4. RSI filter — not OB for buys, not OS for sells
   // 5. Custom A — ADX trend strength >= 22
   // 6. Custom B — Volume vs 20-bar average (gold volume filter)
}
```

**Risk mode thresholds:**

| Mode | Min score | Risk % cap | Max spread pts |
|------|-----------|------------|----------------|
| Low | 78 | 0.5% | 25 |
| Medium | 68 | 1.0% | 35 |
| High | 58 | 2.0% | 45 |

### 6.2 Weekly Gold Levels

On `OnInit` + each new W1 bar:

1. Read prior week `high` / `low` from `PERIOD_W1` rates.
2. Draw `OBJ_HLINE` — gold color, dashed, labels "Wk High" / "Wk Low".
3. Push values into panel row `Weekly: 2648.20 / 2612.50`.

### 6.3 Extended Panel (`AuraFX_GoldPanel.mqh`)

```
┌──────────────────────────────────────────┐
│  AURAFX GOLD SOVEREIGN          v1.0     │
│  XAUUSD · H1 · London/NY Overlap         │
├──────────────────────────────────────────┤
│  Daily P&L    +$142.30    (+18.4 pips)   │
│  Weekly Lvl   2648.20  /  2612.50        │
│  Spread       18 pts    Max 30           │
│  Next News    USD NFP · 14:30 · 47m      │
│  Status       ARMED · Score 72/100       │
├──────────────────────────────────────────┤
│  [Close All]  [Close Buys] [Close Sells] │
└──────────────────────────────────────────┘
```

Button clicks via `OnChartEvent` → `CTrade` position close by magic.

### 6.4 Input Groups (MQL5 `#property` description + inputs)

```
=== Sovereign — Plug & Play ===
InpRiskMode        Low | Medium | High
InpRiskPercent     1.0
InpMagic           20261001
InpTradeComment    "AuraFX Sovereign"

=== Gold Strategy (H1) ===
InpMinConfluence   (auto from risk mode)
InpUsePriceAction  true
InpUseCycleStrength true
InpUseSmaStrength  true

=== Weekly Levels ===
InpShowWeeklyLevels true
InpDrawLevelLines   true

=== Filters ===
InpMaxSpreadPts     30
InpNewsFilter       true
InpNewsBeforeMin    60
InpNewsAfterMin     60
InpNewsUSD          true
InpNewsEUR          true
InpAllowHolidays    false
InpVolumeFilter     true
InpTradeStartHour   7
InpTradeEndHour     20
InpTradeDays        Mon–Fri bitmask

=== Safety ===
InpDailyLossPct     3.0
InpUseTrailing      true
InpFifoMode         false
InpShowPanel        true
```

### 6.5 Architecture Diagram

```
OnTick (new H1 bar)
    │
    ├─► AuraFX_Pro_Update()      → session, regime, news_block
    ├─► SovereignScore()         → buy/sell + score
    ├─► ApplyFilters()           → spread, hours, volume, news
    ├─► CalcLots(risk%)          → from AuraFX_Pro smart_lots
    ├─► OpenPosition()           → CTrade + SL/TP from ATR
    ├─► ManageTrailing()
    └─► AuraFX_GoldPanel_Draw()  → HUD + weekly lines
```

---

## 7. MQL5 Marketplace Listing

**Title:** AuraFX Gold Sovereign — XAUUSD H1 Expert Advisor | Weekly Levels | News Filter

**Short description (500 chars):**

> AuraFX Gold Sovereign is a professional MetaTrader 5 EA for XAUUSD, GOLD and XAUEUR on H1. Multi-factor gold engine: price action, cycle strength, SMA trend, RSI and volume filter. Weekly gold high/low on chart and panel. News filter, spread guard, session hours, risk presets (Low/Medium/High). Elegant obsidian-gold HUD with close buttons. Educational software — demo test first.

**Suggested pricing:**

| Tier | Price | Notes |
|------|-------|-------|
| Full purchase | **$1,799** | Undercuts XG at $1,999 |
| Annual rent | $1,299 | Match competitor rent psychology |
| Bundle | $2,499 | Sovereign + Risk Guardian + Gold presets |

**Screenshots checklist:**

1. XAUUSD H1 — panel showing weekly levels + London session
2. News block state — "BLOCKED · NFP in 12m"
3. Strategy Tester equity — $1k, H1, 2023–2025
4. Inputs dialog — risk mode selector
5. Weekly level lines on chart zoom

---

## 8. Implementation Phases

| Phase | Deliverable | Reuse |
|-------|-------------|-------|
| **P1** | `AuraFX_GoldPanel.mqh` — extended HUD + buttons | Core colors |
| **P2** | Weekly level lines + W1 bar refresh | Pro SR levels |
| **P3** | `AuraFX_Gold_Sovereign_EA.mq5` — full engine | NewsRisk, Structure, Pro |
| **P4** | Presets: `AuraFX_Sovereign_Low/Med/High.set` | Gold H1 set |
| **P5** | `MQL5-GOLD-SOVEREIGN-LISTING.txt` + screenshots | Marketplace folder |
| **P6** | `INSTALL-GOLD-SOVEREIGN-MT5.bat` | Existing install bats |

---

## 9. Compliance (AuraFX Standard)

- No guaranteed profit language
- "Educational software only" in `#property description`
- Risk disclaimer on panel footer
- Live results page on aurafxelite.com (optional signal link)
- Demo-first workflow in manual

---

## 10. Summary

XG Gold Robot succeeds because it is **narrow** (gold only), **filtered** (news/spread/time/volume), **visible** (rich panel + weekly levels), and **simple to sell** (3 risk modes, H1 only, $1k min deposit story).

AuraFX can match this with **Gold Sovereign** by extending the existing Pro/News/Structure stack, upgrading the panel to XG parity, and pricing at the Crown tier ($1,799) with stronger compliance copy than typical MQL5 sellers.

**Next build step:** Implement Phase P1–P3 (`AuraFX_GoldPanel.mqh` + `AuraFX_Gold_Sovereign_EA.mq5`).

---

## Related: Waka Waka EA MT5 (#70283)

MQL5 recommends this **“Bought Together”** with XG Gold — see [WAKA_WAKA_DEEP_RESEARCH.md](./WAKA_WAKA_DEEP_RESEARCH.md).

| Product | AuraFX answer |
|---------|---------------|
| XG Gold Robot | **Gold Sovereign EA** ($1,799) |
| Waka Waka | **Cross Guardian EA** ($1,499) |
| Both | **Diversified bundle** ($2,499) |
