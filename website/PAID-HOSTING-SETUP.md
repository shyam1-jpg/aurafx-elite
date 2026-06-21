# AuraFX — Paid hosting + domain (go live professionally)

Recommended **simple stack** (no server admin skills needed):

| What | Provider | Price (approx.) |
|------|----------|-----------------|
| **Domain** (.com) | Cloudflare Registrar or Namecheap | **~$10–12 / year** |
| **Website + API server** | Render.com **Starter** | **$7 / month** |
| **SSL (HTTPS)** | Included free on Render | **$0** |
| **Email** (optional later) | Zoho Mail free or Google Workspace | $0–$6/mo |

**Total to start:** about **$7 first month** + **~$11 for domain (1 year)** ≈ **$18 today**, then **~$7/month**.

---

## Why this stack

- Your app needs **Node.js** (live news API + dashboard).
- **Render Starter** = always on (no 15-minute sleep), custom domain, automatic HTTPS.
- **Cloudflare** = cheap domains + fast DNS (optional free CDN).

Avoid cheap “$2/month web hosting” (Hostinger shared, GoDaddy basic) — those are for **WordPress/PHP**, not your Node app.

---

## STEP 1 — Buy a domain (10 minutes)

### Option A — Cloudflare (recommended)

1. Go to https://www.cloudflare.com → sign up  
2. **Domain Registration** → search a name, e.g.:
   - **`aurafxelite.com`** ← your GoDaddy domain
   - `aurafxpro.com`
   - `aurafxgold.com`
3. Pay (~$10–12/year for `.com`)  
4. Keep domain on Cloudflare (DNS managed there)

### Option B — Namecheap

1. https://www.namecheap.com  
2. Search same names → add to cart → pay  
3. Later: point nameservers to Cloudflare or Render DNS

**Tip:** Pick a short `.com` name for marketing and MQL5 Market links.

---

## STEP 2 — Deploy on Render (paid, always live)

### 2a — Put code on GitHub (if not done)

1. https://github.com → new repo `aurafx-elite`  
2. Upload folder `AuraFX-Elite` from Desktop  

### 2b — Create paid web service

1. https://render.com → sign up / log in  
2. **New +** → **Web Service**  
3. Connect GitHub → repo `aurafx-elite`  
4. Settings:

| Field | Value |
|-------|--------|
| Name | `aurafx-elite` |
| Root Directory | `website` |
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| **Instance Type** | **Starter** ($7/mo) — not Free |

5. **Environment variables** (optional):
   - `FINNHUB_API_KEY` = your key from https://finnhub.io/register (free tier)

6. **Create Web Service** → wait for **Live**  
7. Test: `https://aurafx-elite.onrender.com` (name may vary)

### 2c — Add payment on Render

- Dashboard → **Billing** → add card  
- Starter plan bills monthly (~$7 + tax)

---

## STEP 3 — Connect your domain (15 minutes)

1. Render → your service → **Settings** → **Custom Domains**  
2. Add: `www.aurafxelite.com` and `aurafxelite.com`  
3. Render shows **DNS records** (CNAME or A record)

4. In **Cloudflare** (or Namecheap DNS):
   - Add the records Render shows  
   - For root domain `@`, use Render’s A record or CNAME flattening  
   - For `www`, CNAME to Render hostname  

5. Wait 5–60 minutes → HTTPS certificate auto-issues  

**Live URLs:**

- https://www.aurafxelite.com  
- https://www.aurafxelite.com/dashboard.html  

See also: **`GODADDY-AURAFXELITE-NEXT-STEPS.txt`** in project root.  

---

## STEP 4 — Optional upgrades

| Upgrade | Cost | When |
|---------|------|------|
| Finnhub API (more news) | $0–$50/mo | When free tier limits hit |
| Render Pro | $25/mo | High traffic |
| Business email hello@yourdomain.com | $0–6/mo | When you sell seriously |
| MQL5 Market listing | $0 list fee | When MT5 files ready |

---

## Budget summary (you pay)

| Period | Cost |
|--------|------|
| **Today** | Domain ~$11 + first month Render ~$7 ≈ **$18** |
| **Each month** | Render Starter **~$7** |
| **Each year** | Domain renewal **~$11** |
| **6 months total** | ~$7×6 + $11 ≈ **$53** |
| MetaTrader 5 / 4 | **$0** (broker platform) |
| MQL5 when you sell | Commission per sale only |

---

## What customers pay YOU (income)

| Product | You charge |
|---------|------------|
| Website subscription (you decide) | e.g. $9–29/mo via Stripe later |
| MT5 full bundle on MQL5 | $99–149 one-time |
| MT4 version (next week) | $49–99 on MT4 Market |

Example: 10 sales at $99 ≈ $790 after ~20% MQL5 fee (covers years of hosting).

---

## Checklist after payment

- [ ] Domain bought  
- [ ] GitHub repo uploaded  
- [ ] Render **Starter** (not Free) deployed  
- [ ] Home page shows LIVE  
- [ ] Dashboard loads news  
- [ ] Custom domain + HTTPS works  
- [ ] Link on social / business card  

---

## Support links

- Render docs: https://render.com/docs/custom-domains  
- Cloudflare DNS: https://developers.cloudflare.com/dns/  
- Project local test: `START-LIVE-WEBSITE.bat`  

Not financial advice. © AuraFX Elite
