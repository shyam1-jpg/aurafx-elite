# Aura FX Elite AI — MVP Starter

Educational AI market-analysis dashboard. **Live market prices, demo analysis. Not financial advice. No auto-trading.**

## What's included

- `app/page.jsx` — landing page (dark premium fintech, gold/blue)
- `app/dashboard/page.jsx` — user dashboard: watchlist toggle, BUY/SELL/WAIT filters, signal cards
- `app/admin/page.jsx` — admin approval queue (demo, in-memory)
- `app/legal/page.jsx` — risk disclosure & disclaimer (template — get solicitor review)
- `app/api/signals/route.js` — signals API (serves mock data)
- `components/SignalCard.jsx` — entry zone, SL, T1/T2, confidence, AI explanation, risk warning
- `components/RiskWarning.jsx` — site-wide banner + per-card warning
- `lib/mockSignals.js` — deterministic demo signal generator (seeded per day), anchored to live prices
- `lib/livePrices.js` — live spot prices from free keyless APIs: Coinbase (BTC/ETH), gold-api.com (XAU), Frankfurter/ECB (EUR, GBP), 5-min cache, automatic demo fallback if a feed is down
- `supabase/schema.sql` — database schema with RLS policies
- `.env.example` — environment variables template

## Run it

```bash
npm install
npm run dev
# open http://localhost:3000
```

### Admin demo flow

1. Open `/admin` — enter your `ADMIN_DEMO_KEY` (optional in local dev).
2. Approve signals in the queue.
3. Open `/dashboard` — only **approved** signals are shown.

Set `ADMIN_DEMO_KEY` in `.env.local` before any public deploy.

## Roadmap (in order)

1. **Auth** — Supabase Auth (email + magic link); gate the dashboard; force risk acknowledgement on first login.
2. **Persist signals** — run `supabase/schema.sql`, switch `/api/signals` from the mock generator to the `signals` table (approved only).
3. **Admin for real** — protect `/admin` by role, write approve/reject to DB + `admin_actions` audit log.
4. **Real indicators** — live spot prices are already wired in (`lib/livePrices.js`); next add OHLC history and compute RSI/MACD/EMA/ATR server-side, keep the WAIT rule.
5. **AI explanations** — LLM writes the plain-English analysis *after* rules create the setup. Never let the AI invent trades.
6. **Alerts** — Resend/SendGrid email on approved signals; Telegram later.
7. **Payments** — Stripe subscription (Free = delayed signals, Pro = instant).
8. **Charts** — TradingView lightweight-charts widget on the dashboard.

## Compliance (UK) — read before launch

- Keep all wording educational: no profit promises, no win rates, no "guaranteed".
- FCA financial-promotion rules can apply to signal services and crypto promotions even with disclaimers. Get legal advice **before** charging money or marketing to UK consumers.
- Never hold client funds, never auto-trade for users in this version.
- Keep the risk banner and per-signal warnings — do not remove them.
