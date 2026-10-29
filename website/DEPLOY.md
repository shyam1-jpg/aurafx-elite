# Deploy AuraFX Live Website

## Run locally (marketing test)

```powershell
cd "C:\Users\shyam prasad\Desktop\AuraFX-Elite\website"
npm install
npm start
```

Open:
- **Home:** http://127.0.0.1:3847
- **Dashboard:** http://127.0.0.1:3847/dashboard.html

Green **LIVE** pill on home = working.

## Deploy online (free options)

### Render.com (recommended)

1. Push `AuraFX-Elite` to GitHub
2. Render → New **Web Service**
3. Root: `website`
4. Build: `npm install`
5. Start: `npm start`
6. Add env `PORT` = `10000` (Render sets this automatically)
7. **Recommended:** `DATABASE_URL` from [Neon](https://neon.tech) — keeps client registrations after redeploy (see `NEON-SETUP.txt`)
8. Optional: `FINNHUB_API_KEY` (live calendar), `SIGNAL_NEWS_BEFORE_MIN` and `SIGNAL_NEWS_AFTER_MIN` (default 30), `SIGNAL_RANGE_INSTRUMENTS` (ranging mean-reversion, default `XAUUSD`, `none` turns it off), `SIGNAL_FREE_DELAY_MIN` (free delayed snapshot, default 15), `TWELVE_DATA_API_KEY` (candles, tried first), `OPENAI_API_KEY` plus `AI_RATIONALE_PROVIDER=openai` (wording and the dashboard assistant only; both keep working with the rule engine when unset), `TELEGRAM_BOT_TOKEN` and `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` for opt-in signal alerts, `MEMBER_SESSION_SECRET` for member cookies, and `GOOGLE_CLIENT_ID` plus `GOOGLE_CLIENT_SECRET` if Google sign-in should appear. Member tiers are Free until the owner signs in at `/admin-login.html` and sets them on `/owner-members.html`. Accounts stay in `website/data/members.json` on the server disk, not in git and not in `DATABASE_URL`. `ADMIN_PASSWORD` is required for that login and is set in the Render service Environment tab; it is not in `render.yaml`. Tier amounts live in `website/public/pricing.json` (GBP: Free £0, Pro £19/month or £190/year, Elite £49/month or £490/year). Payment is not taken on the site. With no candle key the server uses Yahoo Finance and falls back to Kraken public OHLC for supported forex and PAXG gold. See the root README section **AI signal board**.

You get URL like `https://aurafx.onrender.com`

### Railway / Fly.io

Same: point to `website` folder, `npm start`, Node 18+.

### Your own domain

1. Buy domain (~$12/year)
2. Point DNS to Render/Railway
3. Enable HTTPS (automatic on Render)

## What is live vs MT5

| Part | Hosted on website | MT5 install |
|------|-------------------|-------------|
| News, calendar, mood | ✅ Website API | Optional indicator |
| Journal, screenshot | ✅ Browser | — |
| Buy/Sell on chart | — | ✅ MT5 only |
| MT4 | — | Next week |

## Your monthly costs (owner)

| Item | Typical cost |
|------|----------------|
| Website hosting | $0–7/mo |
| Domain | ~$1/mo |
| Finnhub | $0 free tier |
| MT5 platform | $0 |
| MQL5 Market listing | $0 until you sell |

## Sell to customers

- **Website:** subscription you control (Stripe later)
- **MT5:** publish on mql5.com ($49–$149 typical)
- **MT4:** separate MQL4 build next week
