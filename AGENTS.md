# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is
AuraFX Elite is a Node.js project with two runnable services plus static MQL5 trading
tools (the `.mq5`/`.mqh` files compile only inside MetaTrader 5 / MetaEditor, not here).

| Service | Path | Run command | Port | Notes |
|---------|------|-------------|------|-------|
| Website + trading-assistant API (PRIMARY) | `website/` | `cd website && npm start` (alias for `node simple-server.js`) | 3847 | Marketing site, registration/lead API, live quotes, dashboard. |
| News & risk API (OPTIONAL) | `news-risk-server/` | `cd news-risk-server && npm start` | 3847 | Only needed for the MT5 Risk Guardian feed. Shares the default port with the website, so set `PORT=<other>` if running both at once. |

### Build / lint / test
- There is **no build step** (server serves static files from `website/public/`) and **no
  lint or test tooling** is configured (no eslint, no test runner; `package.json` has no
  `test`/`lint` scripts). Don't invent commands — validate changes by running the server
  and exercising endpoints.
- A tiny standalone mock API exists at `news-risk-server/test-server.js` (`node test-server.js`)
  for front-end demos only; it is not a test suite.

### Running locally (non-obvious gotchas)
- The website binds to `127.0.0.1` locally by default (`HOST` is `0.0.0.0` only when
  `RENDER=true`). Dependencies are optional at runtime — `simple-server.js` wraps every
  `require` in try/catch, so it boots even without `node_modules`, but install deps anyway
  for full functionality (handled by the update script).
- **Site is gated by `SITE_MODE=testing` (the default).** Pages like `/register.html`,
  `/dashboard.html`, `/scanner.html`, `/risk-calculator.html`, and the `/api/register`
  endpoint return 403 to the public until you have owner preview access.
- Locally (not production) the owner key defaults to `aurafx-local-dev`. To exercise gated
  flows:
  - API: send header `x-owner-key: aurafx-local-dev`.
  - Browser: the `/api/testing/unlock` endpoint used by `private-testing.html` is currently
    **broken** (it double-parses the JSON body and returns 400 "Invalid JSON"), so the
    "Unlock" button does not work. Instead set the preview cookie directly, e.g. in DevTools:
    `document.cookie = "aurafx_preview=<token>; path=/"` where `<token>` is generated with
    the server's HMAC: `exp + "." + hmacSHA256("aurafx-local-dev", "preview|"+exp)`.
- Live FX/metal/crypto quotes work out of the box via Yahoo Finance + CoinGecko (no API key
  required); the `/api/quotes`, `/api/status`, `/api/markets` endpoints are live.
- Registrations persist to `website/data/registrations.json` (file mode, git-ignored) unless
  `DATABASE_URL` (Neon Postgres) is set.

### Optional integrations (all degrade gracefully if unset)
See `website/.env.example`. PayPal, Resend email (`RESEND_API_KEY`), OpenAI, and Neon
(`DATABASE_URL`) are all optional for local dev — missing keys just disable those features,
they do not block startup.
