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
8. Optional: `FINNHUB_API_KEY`

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
