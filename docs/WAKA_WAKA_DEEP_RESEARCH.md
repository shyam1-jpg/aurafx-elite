# Waka Waka EA MT5 — Deep Research Report

**Source:** [Waka Waka EA MT5 — MQL5 #70283](https://www.mql5.com/en/market/product/70283)  
**Author:** Valeriia Mishchenko · **v4.59** (Feb 2026) · **$2,800 USD**  
**Rating:** 4.13★ (44 reviews) · 22,114 demo downloads · Published Aug 2021  
**Related:** Same author as Golden Pickaxe (gold grid + ML). MT4 version is a separate listing.

---

## Executive Summary

Waka Waka is one of the **highest-grossing grid EAs** on MQL5. It trades **three correlated AUD/NZD commodity crosses** from a **single M15 chart** using **Bollinger Band mean-reversion entries**, **RSI filtering**, **progressive lot multipliers** (martingale-style grid), and **weighted basket take-profit**.

It is marketed as “not just a grid” because entries are filtered by volatility extremes and market mechanics — but **critical reviews consistently classify it as grid + martingale**. Long live-track records exist, but **account blow-ups at Medium/High risk** are documented (June 2023, March 2024, May 2024).

**Why it appears “Bought Together” with XG Gold Robot:** Complementary portfolio — XG Gold = directional gold H1; Waka Waka = mean-reversion grid on low-trend crosses M15. Different symbols, timeframes, and risk profiles.

---

## 1. Product Positioning

### Marketing claims
- “8+ years live track record” with “+12,000% account growth”
- “Designed to exploit market inefficiencies” — not curve-fitted to history
- “Not a simple hit-and-miss grid” — uses real market mechanics
- “3 lines of instructions” — plug-and-play, settings stored internally
- “Much cheaper than high-quality alternatives” (at $2,800 this is premium tier)
- NOT sensitive to spread/slippage (developer claim; ECN still recommended)

### Social proof
- Live performance link on listing (MyFxBook / MQL5 signals)
- Third-party resellers cite **402 weeks** tracked, **74.39% win rate**, **5,156 trades** on IC Markets
- Telegram support community (some users report moderation of negative feedback)
- Sister product: **Golden Pickaxe** — same grid+ML approach on **XAUUSD**

---

## 2. Technical Architecture

### 2.1 One-Chart Multi-Symbol Engine

```
┌─────────────────────────────────────────────────────────────┐
│  SINGLE CHART: AUDCAD M15 (recommended attach point)        │
│  EA internally manages:                                     │
│    • AUDCAD                                                 │
│    • AUDNZD                                                 │
│    • NZDCAD                                                 │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
   ┌──────────┐         ┌──────────┐         ┌──────────┐
   │ Grid #1  │         │ Grid #2  │         │ Grid #3  │
   │ AUDCAD   │         │ AUDNZD   │         │ NZDCAD   │
   └──────────┘         └──────────┘         └──────────┘
```

**Why these pairs:** AUD/NZD/CAD crosses tend to **range** more than trend — ideal for mean-reversion grid (until they don’t).

**Broker suffix:** User must map symbols in `Symbols` param (e.g. `AUDCAD.a`).

### 2.2 Entry Logic (Signal Layer)

| Component | Role |
|-----------|------|
| **Bollinger Bands** (configurable period, default ~35) | Entry when price hits upper/lower band = volatility extreme |
| **RSI** (configurable period, default ~15) | Filters low-potential trades via `Maximum RSI Value` |
| **ML pattern recognition** (third-party docs) | Optional filter layer — disputed effectiveness per negative reviews |
| **Working TF** | M15 for BB + RSI calculation |

**Direction:** Mean reversion — buy at lower band, sell at upper band (in ranging conditions).

### 2.3 Grid / Recovery Layer

| Parameter | Purpose |
|-----------|---------|
| `Trade Distance` | Min pips between averaging trades |
| `Smart Distance` | Auto-adjusts step by volatility (ATR-like) |
| `2nd Trade Multiplier` | Lot scale for 2nd grid leg |
| `3rd-5th Trade Multiplier` | Lot scale for legs 3–5 |
| `6th+ Trade Multiplier` | Lot scale for deep grid |
| `Maximum Trades` | Cap on grid depth |
| `TakeProfit Initial` | TP in pips if no grid opened |
| `TakeProfit Grid` | TP in pips OR **weighted** (if 0 → dollar TP = initial trade money target) |
| `StopLoss Grid` | SL in pips (1000 if zero = very wide) |
| `Hide StopLoss` | Broker-invisible SL option |

**Weighted TP (key innovation):** As grid grows, TP target stays constant in **money**, not pips — basket closes sooner in price terms. This is why win rate appears high (~74%) while tail risk remains.

### 2.4 Money Management

| Method | Description |
|--------|-------------|
| Fixed Lots | Static lot from `Fixed Lot` |
| Dynamic Lots | Balance/equity per 0.01 lot |
| Deposit Load % | % of deposit for initial trade |
| **4 Presets** | Low / Medium / Significant / High — auto risk |

**Leverage guidance (developer):**
- 1:30 leverage + <$6,000 → **Low risk only**
- 1:100 leverage + $1,000 → up to **Significant** risk OK (developer claim)

### 2.5 Safety Systems

| Feature | Behavior |
|---------|----------|
| `Maximum Drawdown %` | Closes all positions if floating DD exceeds threshold |
| `Allow Opening New Grid` | Pause new grids; existing grids continue |
| `Maximum Symbols at a time` | Cap concurrent pair grids |
| `Maximum Spread` / `Maximum Slippage` | Execution guards |
| `Allow Hedging` | Multi-directional on same symbol |
| `Allow Trading on Holidays` | Christmas/NY filter |
| News filter | Requires **WebRequest** to news URL + time server (MT5 guide 1:00–2:05) |
| `Allow Buy` / `Allow Sell` | Direction toggles |

### 2.6 Account Requirements

| Requirement | Mandatory? |
|-------------|--------------|
| **Hedging account** | **YES** |
| VPS 24/5 | Strongly recommended |
| ECN/low spread broker | Recommended |
| GMT offset | Auto — “no need to adjust GMT” |
| WebRequest for news | Required for news filter |

---

## 3. Operational Workflow

### Install (3 steps per developer)
1. Attach to **one** M15 chart — **AUDCAD** recommended
2. Update symbol names if broker uses suffix
3. Enable WebRequest for news + time server
4. Select risk preset (Low for most users per reviews)
5. Run on VPS continuously

### No .set files needed
All defaults baked into EA — reduces buyer friction but limits transparency for advanced users.

---

## 4. Review Sentiment Analysis (44 MQL5 reviews)

### Positive themes (≈60%)
- “Best EA I’ve purchased” with **Low risk** settings
- Consistent small daily profits over months/years
- Fast developer support (Telegram, private messages)
- Works well on low-spread ECN accounts
- Pairs “rarely have big trends” (buyer belief — contested)

### Negative themes (≈25% — high signal weight)
- **Grid + martingale** — “risking 100% to win 0.1% per trade”
- **Account wipeouts** at High/Significant risk (documented June 2023)
- **50% DD** on developer account (March 2024 allegation)
- **NZDCAD downtrend** caused 72% DD on medium risk (May 2023)
- Max DD protection **crystallizes loss** — “years to recover”
- ML filter **does not prevent** entries at bad levels (March 2024 review)
- Developer allegedly **deposited 30% capital** to save demo account at 70% DD (May 2024, Russian review)
- Telegram group **silences negative feedback** (reported)

### Developer response pattern
- Emphasizes verified long-term track records
- Points to MM/RM parameters — “losing account nearly impossible” if configured right
- Acknowledges grid nature but argues years of profit prove edge
- Public Waka accounts total ~$23k (developer statement) — small vs marketing %

### Risk consensus from honest users
> **USE LOW RISK ONLY** — 0.25% deposit load → ~20% DD acceptable; High/Significant = account death in trending markets.

---

## 5. Documented Failure Modes

| Event | What happened | Lesson |
|-------|---------------|--------|
| AUDCAD trend Jun 2023 | High & Significant accounts wiped in 11–16 days | Grid fails in sustained trends |
| NZDCAD downtrend May 2023 | Medium risk → 72% DD | “Pairs don’t trend” assumption breaks |
| Mar 2024 | 50% DD on author account | Marketing signal ≠ user risk settings |
| Max DD trigger | Saves from total loss but locks large realized loss | Safety net ≠ safe strategy |

**Structural risk:** Grid/martingale profits resemble **picking up pennies in front of a steamroller** — long win streaks, rare catastrophic loss.

---

## 6. Comparison: Waka Waka vs XG Gold Robot

| Dimension | Waka Waka (#70283) | XG Gold Robot (#92195) |
|-----------|-------------------|------------------------|
| **Price** | $2,800 | $1,999 |
| **Symbols** | AUDCAD, AUDNZD, NZDCAD | XAUUSD, GOLD, XAUEUR |
| **Timeframe** | M15 | H1 |
| **Strategy type** | Mean-reversion grid + martingale | Directional confluence (PA, RSI, SMA, cycle) |
| **Account** | Hedging required | Any (FIFO option) |
| **Risk profile** | High tail risk; many small wins | Moderate; SL-based trades |
| **Martingale** | Yes (multipliers per grid level) | No |
| **One-chart multi-symbol** | Yes (core feature) | No (single pair per chart) |
| **Weekly levels** | No | Yes |
| **Panel** | Info panel | Rich panel + calendar |
| **Live track record** | 8+ years, +12,000% claimed | Seller website signals |
| **Best for** | Range-bound cross pairs | Gold trend sessions |

**Portfolio logic (why bought together):** Uncorrelated instruments + different strategy classes = smoother combined equity (in theory). In practice, both can draw down during risk-off USD or commodity shocks.

---

## 7. Comparison: Waka Waka vs AuraFX Today

| Waka Waka Feature | AuraFX Asset | Gap |
|-------------------|--------------|-----|
| One-chart 3-symbol | None | **New MultiSymbol engine needed** |
| BB + RSI mean reversion | Core has RSI; no BB entry module | Add `AuraFX_MeanReversion.mqh` |
| Progressive lot multipliers | GridEngine uses **additive** scale, no martingale | Waka-style = different product philosophy |
| Weighted basket TP (money target) | Basket TP in **points** only | Add money-weighted TP mode |
| 4 risk presets | Crown: Low/Medium | Add Significant/High + deposit load % |
| Smart distance (volatility step) | `InpGridAtrMult` in Crown | Partial match |
| Max floating DD % close all | `InpDailyLossPct` in Crown | Similar |
| Hedging required | Crown warns for grid mode | Match |
| Internal presets (no .set) | Uses .set files | Marketing choice |
| News WebRequest | NewsRisk.mqh | Exists |
| Info panel | GridPanel in GridEngine | Extend for multi-symbol |

**Strategic choice for AuraFX:** Do NOT clone martingale. Build **AuraFX Cross Guardian EA** — Waka-inspired but with AuraFX’s “no martingale doubling” grid (Crown/GridEngine philosophy) on AUD crosses.

---

## 8. Proposed AuraFX Product: **Cross Guardian EA**

**Positioning:** “Waka Waka class multi-symbol mean reversion — with capped recovery, no martingale doubling, full transparency.”

| Spec | Value |
|------|-------|
| File | `AuraFX_Cross_Guardian_EA.mq5` |
| Chart | Single AUDCAD M15 |
| Symbols | AUDCAD, AUDNZD, NZDCAD (internal) |
| Entry | BB touch + RSI filter |
| Recovery | AuraFX_GridEngine additive lots (max 4–6 levels) |
| TP | Weighted money basket OR points (toggle) |
| Risk | Low / Medium / High + deposit load % |
| Account | Hedging |
| Price | **$1,499** (undercut Waka, premium over Gold Reaper) |

### Differentiators vs Waka Waka (marketing)
1. **No martingale doubling** — capped additive scaling (already in GridEngine)
2. **Transparent .set presets** — Low/Med/High published
3. **Honest risk copy** — “grid recovery involves drawdown; not for prop firms”
4. **Per-symbol DD cap** — pause new grids on pair if DD > X%
5. **Regime filter** — ADX trend filter blocks new grids when pair is trending

---

## 9. Implementation Architecture (Cross Guardian)

```
OnTimer / OnTick
    │
    ├─► For each symbol in {AUDCAD, AUDNZD, NZDCAD}
    │       ├─► AuraFX_Pro_Update(symbol)
    │       ├─► RegimeCheck — ADX < 25 → allow mean reversion
    │       ├─► BB_RSI_Signal(symbol, M15)
    │       ├─► ApplyFilters — spread, news, max symbols, hours
    │       ├─► BasketCollect(symbol, magic)
    │       ├─► If flat → OpenInitial()
    │       ├─► If basket losing → CanAddGrid? → AddLeg (additive lots)
    │       ├─► If basket profit → WeightedTpHit? → CloseBasket
    │       └─► If pair DD > max → CloseBasket + lock symbol 24h
    │
    └─► AuraFX_MultiGridPanel_Draw() — all 3 baskets + totals
```

### New includes
- `AuraFX_MultiSymbol.mqh` — symbol list, suffix mapping, per-symbol state
- `AuraFX_MeanReversion.mqh` — BB + RSI entry
- `AuraFX_WeightedTP.mqh` — money-constant basket target

---

## 10. MQL5 Listing Copy (Draft)

**Title:** AuraFX Cross Guardian — AUDCAD AUDNZD NZDCAD Multi-Symbol Grid | One Chart

**Short description:**

> Professional MT5 EA for AUD/NZD commodity crosses. One M15 chart trades AUDCAD, AUDNZD, and NZDCAD with Bollinger mean-reversion entries, RSI filter, and smart basket recovery. Capped additive lots — no martingale doubling. Weighted take-profit, news filter, spread guard, 3 risk presets. Hedging account. Educational software — demo test first.

**Compliance bullets:**
- Grid strategies involve drawdown risk
- Past live signals do not guarantee future results
- Use Low risk on accounts under $5,000
- Not suitable for FIFO-only or netting accounts

---

## 11. Testing Protocol

| Test | Settings |
|------|----------|
| Symbol | AUDCAD chart, all 3 pairs |
| Period | M15 |
| Model | Every tick based on real ticks |
| Deposit | $1,000 |
| Leverage | 1:100 |
| Risk | Low preset only for marketplace screenshots |
| Years | 2020–2025 (include Jun 2023 stress) |
| Metrics | Max DD, recovery time, profit factor, consecutive losses |

**Must disclose in listing:** Performance on Low risk during trending periods (Jun 2023) vs Waka’s High risk blow-ups.

---

## 12. Portfolio Strategy (XG Gold + Cross Guardian)

For AuraFX bundle marketing:

| Product | Role in portfolio |
|---------|---------------------|
| **Gold Sovereign** (XG competitor) | Directional gold H1 |
| **Cross Guardian** (Waka competitor) | Mean-reversion AUD crosses M15 |
| **Risk Guardian** (indicator) | Shared news/DD dashboard |

**Bundle name:** AuraFX Diversified Metals & Crosses — **$2,499** (vs $4,799 buying XG + Waka separately)

---

## 13. Key Takeaways

1. **Waka Waka is a grid/martingale product** regardless of marketing — treat it as such.
2. **One-chart multi-symbol** is its killer UX feature — high implementation value for AuraFX.
3. **Weighted money TP** is a clever basket mechanic worth adopting (without martingale).
4. **4 internal risk presets** reduce buyer friction — AuraFX should offer the same.
5. **Honest reviews are the moat** — AuraFX can win on transparency where Waka’s Telegram moderation hurts trust.
6. **Do not promise +12,000%** — show Low-risk DD and recovery times instead.

---

## 14. Sources

- [MQL5 Product 70283](https://www.mql5.com/en/market/product/70283)
- [MQL5 Product 92195 — XG Gold](https://www.mql5.com/en/market/product/92195) (bought-together pair)
- MQL5 reviews on listing (especially user 29707 detailed negative reviews)
- Third-party parameter analysis (eafxstore.com Waka Waka settings blog)
- AuraFX-Elite: `AuraFX_GridEngine.mqh`, `AuraFX_Crown_EA.mq5`

**Next step:** Implement `AuraFX_Cross_Guardian_EA.mq5` Phase 1 — multi-symbol router + BB/RSI entry on AUDCAD M15.
