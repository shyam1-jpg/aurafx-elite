# Aura AI intelligence layer

Aura AI combines the server's allow-listed quote, economic-calendar and news context into educational market analysis. The OpenAI key remains server-side and is never sent to the dashboard.

## Runtime configuration

- `OPENAI_API_KEY`: secret configured on the main `aurafx-elite` Render service.
- `OPENAI_MODEL`: configurable model name; currently defaults to `gpt-4o-mini`.
- `AI_ANALYSIS_CACHE_MS`: optional cache duration; minimum 30 seconds, default 60 seconds.

The dashboard calls `POST /api/ai/analyze` with only an allow-listed symbol and timeframe. The server supplies all market/news context. `GET /api/ai/status` reports configuration without revealing the key.

## Safety boundary

This integration cannot place, modify or close orders. AI output is untrusted and validated. Bad inputs, missing live quotes, timeouts, invalid JSON and API errors all return `NO_TRADE`. Risk is capped at 0.5% in the displayed analysis. Confidence is a setup-quality score, not a forecasted win rate.

Before any future MT5 bridge is considered, add authenticated users, broker-grade OHLC/spread data, deterministic risk checks, paper-trading evaluation, audit logs, daily-loss and news lockouts, and an explicit manual confirmation step.
