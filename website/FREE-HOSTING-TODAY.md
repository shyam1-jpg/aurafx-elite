# Free hosting for 6+ months — deploy AuraFX TODAY

Best option for your Node.js website (home + live dashboard + news API):

## ⭐ #1 Render.com (RECOMMENDED — free, no credit card)

| | |
|---|---|
| **Cost** | **$0** (Hobby workspace) |
| **How long** | **750 hours/month** = one app can run **24/7 all month** → fine for **6+ months** marketing |
| **Credit card** | **Not required** |
| **Cold start** | After 15 min no visitors, wakes in ~1 min (OK for new product) |
| **Custom URL** | `https://aurafx-elite.onrender.com` (free subdomain) |

### Steps (about 15 minutes)

1. **Create free account:** https://render.com — sign up with **GitHub** or email.

2. **Put code on GitHub** (if not already):
   - Install GitHub Desktop or use https://github.com/new
   - New repository: `aurafx-elite`
   - Upload folder `AuraFX-Elite` (or whole project)

3. **Deploy on Render:**
   - Dashboard → **New +** → **Web Service**
   - Connect your GitHub repo
   - Settings:
     - **Name:** `aurafx-elite`
     - **Root Directory:** `website`
     - **Runtime:** Node
     - **Build Command:** `npm install`
     - **Start Command:** `npm start`
     - **Instance Type:** **Free**
   - Click **Create Web Service**

4. Wait 5–10 min for first deploy. Open the URL Render gives you, e.g.  
   `https://aurafx-elite.onrender.com`

5. Test:
   - Home page shows **LIVE** green pill
   - `/dashboard.html` loads news and scores

6. **Optional:** Render → Settings → Custom Domain (if you buy a domain later).

---

## #2 Railway.app (backup — very small free credit)

| | |
|---|---|
| **Cost** | ~**$1 credit/month** after trial (not 24/7) |
| **Good for** | Short demos, not full-time free for 6 months |

Only use if Render fails. https://railway.app

---

## #3 GitHub Pages (marketing page ONLY — no live API)

| | |
|---|---|
| **Cost** | **$0 forever** |
| **Limit** | Static HTML only — **no** live news server |

Use for a simple landing page later; full product needs Render.

---

## #4 Oracle Cloud “Always Free” (advanced — 6+ months VPS)

| | |
|---|---|
| **Cost** | **$0** for years (ARM VM) |
| **Effort** | Harder — Linux setup, not “click deploy” |

https://www.oracle.com/cloud/free/ — only if you outgrow Render.

---

## What NOT to use for this project

| Site | Why |
|------|-----|
| InfinityFree / 000webhost | PHP only — no Node.js |
| Wix / WordPress.com | Not for your custom app |
| Heroku | No real free tier anymore |

---

## After deploy — share these links

Replace with your Render URL:

- **Home:** `https://YOUR-APP.onrender.com`
- **Dashboard:** `https://YOUR-APP.onrender.com/dashboard.html`

Post on social / MQL5 profile when MT5 is ready next week.

---

## Optional: faster news (still free)

1. Register https://finnhub.io/register (free API key)
2. Render → your service → **Environment** → add:
   - `FINNHUB_API_KEY` = your key
3. **Manual Deploy** → redeploy

---

## Costs summary (you)

| Item | 6 months |
|------|----------|
| Render hosting | **$0** |
| MT5 platform | **$0** |
| Domain (optional) | ~$12/year if you want `.com` |
| MQL5 Market when you sell | **$0** to list, commission per sale |

---

## Problems?

| Problem | Fix |
|---------|-----|
| “Application failed to respond” | Wait 60s (free tier waking up) |
| Build failed | Root Directory must be `website` |
| npm not found locally | Install Node.js from nodejs.org, then `START-LIVE-WEBSITE.bat` |

Not financial advice. © AuraFX Elite
