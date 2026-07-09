# Deploy Aura FX Elite AI — FREE (Phase 1)

Educational demo only. No payments in this phase. Add Stripe later (Phase 2).

## Option A — Render (matches your main site)

1. **Push this repo** to GitHub (`shyam1-jpg/aurafx-elite`).
2. Open [Render Dashboard](https://dashboard.render.com) → **Blueprints** → connect the repo.
3. Render reads root `render.yaml` — it creates **two** services:
   - `aurafx-elite` — main website (Starter, paid)
   - `aura-fx-elite-ai` — AI demo (**free** plan)
4. After deploy, copy the AI service URL (e.g. `https://aura-fx-elite-ai.onrender.com`).
5. In Render → **aura-fx-elite-ai** → **Environment**, note `ADMIN_DEMO_KEY` (auto-generated). Use it at `/admin`.

**Free plan notes:** Service sleeps after ~15 min idle. First visit may take 30–60s to wake up.

## Option B — Vercel (faster for Next.js, also free)

1. Go to [vercel.com](https://vercel.com) → Import Git repo.
2. Set **Root Directory** to `aura-fx-elite-ai`.
3. Add env var: `ADMIN_DEMO_KEY` = a long random string.
4. Deploy. URL will be like `https://aura-fx-elite-ai.vercel.app`.

## Link from main website

Set on the **aurafx-elite** Render service (or `website/.env` locally):

```
AI_DEMO_URL=https://your-ai-demo-url.onrender.com
```

The main site products page reads this for the “AI Signal Demo” button.

## Phase 2 — when you want to charge

1. Supabase (free tier) — auth + persist signals (`supabase/schema.sql`).
2. Stripe — `plans` / `subscriptions` tables already in schema.
3. Gate dashboard: Free = delayed signals, Pro = instant (README roadmap step 7).
4. Get legal review before UK paid marketing (FCA rules).

## Local dev

```bash
cd aura-fx-elite-ai
npm install
npm run dev
```

Or double-click `START-AI-DEMO.bat` in the repo root.
