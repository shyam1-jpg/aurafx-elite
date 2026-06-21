# AuraFX News & Risk Warning System

Professional trading-protection layer for **MetaTrader 5** and the **web Risk Dashboard**.

## Important safety rule

**This is not financial advice. This is a risk warning tool. Final decision is always yours.**

The system **never auto-closes** trades unless you explicitly enable button execution in MT5 (`InpAllowButtonClose = true`). Default behavior is **warnings and suggestions only**.

---

## Components

| Component | Path | Role |
|-----------|------|------|
| Risk engine | `MQL5/Include/AuraFX_NewsRisk.mqh` | Calendar, risk levels, trade exposure, AI text |
| Risk Guardian | `MQL5/Indicators/AuraFX_Risk_Guardian.mq5` | Standalone on-chart protection |
| Elite EA | `MQL5/Experts/AuraFX_Elite_EA.mq5` | Signals + integrated warnings |
| News server | `news-risk-server/server.js` | Live calendar + RSS + Finnhub |
| Risk dashboard | `risk-dashboard/index.html` | Desktop/mobile alerts, overlay UI |

---

## Risk levels & mood

| Alert | Meaning |
|-------|---------|
| **LOW RISK** | Normal conditions |
| **MEDIUM RISK** | Moderate-impact event or news |
| **HIGH RISK** | CPI, NFP, FOMC, war/crisis keywords, etc. |

| Mood | Meaning |
|------|---------|
| **SAFE** | No imminent danger window |
| **CAUTION** | Event within ~3 hours or trade stress |
| **DANGEROUS** | High-impact event within 90 minutes |

## Expected impact tags

- Gold bullish / Gold bearish  
- USD strong / USD weak  
- High volatility expected  

---

## MT5 setup

### 1. Install files

Copy `MQL5` folder to your MT5 data directory (same as main AuraFX install).

### 2. Enable economic calendar

Tools → Options → Terminal → ensure **news / calendar** is enabled (broker-dependent).

### 3. Compile

- `AuraFX_Risk_Guardian.mq5`  
- `AuraFX_Elite_EA.mq5` (updated)

### 4. Attach Risk Guardian

Drag **AuraFX_Risk_Guardian** onto XAUUSD or EURUSD chart.

### 5. Optional: WebRequest for news server

If using `InpUseNewsApi`:

1. Start `news-risk-server` (see below)  
2. MT5 → Tools → Options → Expert Advisors → allow WebRequest for:  
   `http://127.0.0.1:3847`

### 6. Push notifications (mobile)

MT5 mobile: enable notifications in terminal settings. Indicator uses `SendNotification()` + `Alert()` + `PlaySound()`.

---

## On-chart buttons

| Button | Default behavior |
|--------|------------------|
| **Close** | Shows instruction to close manually (or executes if `InpAllowButtonClose=true`) |
| **Reduce** | Suggests manual lot reduction |
| **Move SL** | Suggests manual SL adjustment |
| **Ignore** | Snoozes warnings 30 minutes |

---

## News server setup

```bash
cd AuraFX-Elite/news-risk-server
npm install
copy .env.example .env
# Add FINNHUB_API_KEY from https://finnhub.io/register (optional)
npm start
```

Server runs at **http://127.0.0.1:3847**

### Data sources

| Source | Type | Notes |
|--------|------|-------|
| **MT5 built-in calendar** | Economic events | Used directly in MQL5 |
| **Finnhub** | Calendar + news | Free API key in `.env` |
| **Reuters RSS** | Headlines | Via news server |
| **Investing.com RSS** | Headlines | Via news server |
| **Federal Reserve RSS** | Central bank | Via news server |

ForexFactory / Investing.com HTML calendars are not scraped (ToS); RSS + Finnhub + MT5 calendar provide professional coverage.

---

## Risk dashboard (browser)

1. Start news server: `npm start`  
2. Open `risk-dashboard/index.html` in Chrome/Edge  
3. Click 🔔 to allow **desktop push notifications**  
4. Enter your open trade details for exposure warnings  
5. Red overlay appears on **HIGH RISK** with action buttons  

Works on desktop and tablet; keep tab open or install as PWA for background polling.

---

## Warnings you will see

### Before news (open trade)

> High-impact news coming. Market may become volatile. Consider closing, reducing lot size, or moving stop loss.

### Adverse price movement

> Trade risk increasing. Possible fund loss. Check position now.

### AI explanation (simple language)

- What happened / what is coming  
- Why the market may move  
- How it may affect your trade  
- What you might consider  

---

## EA settings (news)

| Input | Default | Description |
|-------|---------|-------------|
| `InpEnableNewsGuard` | true | Master switch |
| `InpWarnMinutesBefore` | 90 | Advance warning window |
| `InpBlockNewTradesOnNews` | false | Only blocks **new** entries, never auto-close |
| `InpSoundRiskAlerts` | true | Terminal sound |

---

## Compliance for MQL5 Market

- Do not advertise guaranteed profits  
- State that risk warnings are not advice  
- Document that user must opt in for any button-based close  

---

© 2026 AuraFX Labs
