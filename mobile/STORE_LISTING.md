# AuraFX Elite Signals — store listing draft

Draft only. Do not submit this build to the App Store or Google Play.

## Identity

- Name: AuraFX Elite Signals
- Subtitle: Fewer, measured FX setups
- Bundle id (iOS and Android): `com.aurafxelite.signals`
- Category: Finance
- Price: Free, with auto-renewing subscriptions
- Support: support@aurafxelite.com
- Privacy policy: https://aurafxelite.com/privacy.html
- Marketing site: https://aurafxelite.com

## Short description

A short list of forex, gold, metals and commodity setups from the AuraFX scan, with entry, stop, target and the measured track record behind them.

## Full description

AuraFX Elite Signals is a signal point for people who want fewer setups, not a call on every market.

The list shows the public scan from AuraFX Elite. A row is a published buy or sell only when the rule engine publishes one. Everything else stays on no-trade, with the reason the scan recorded. Open a row for the levels, the confidence score, and the measured track record: win rate, average R, profit factor and max drawdown from closed signals. When the sample is empty, the app says so.

The free app shows ads. A rewarded ad can open the factor notes for one signal. Pro and Elite remove ads. Subscriptions use four product ids mapped to the site tiers: `aurafx_pro_monthly` (£19), `aurafx_pro_yearly` (£190), `aurafx_elite_monthly` (£49), and `aurafx_elite_yearly` (£490). Prices in the app are the prices returned by the site and, once the store is connected, the store.

Analysis only. Auto trading is off. Nothing in the app places an order.

Aura Elite FX provides AI-assisted market analysis, confidence scoring, backtesting and risk tools. Trading involves risk and no result is guaranteed.

## What this draft must not claim

- No guaranteed profit
- No fixed accuracy such as 90% or 96%
- No promise that a confidence score is a future win rate
- No claim that prices are the user's broker quotes

## Subscription copy

- `aurafx_pro_monthly` — Pro, £19 per month. Removes ads and includes extra signal detail. Length: 1 month, renews until cancelled.
- `aurafx_pro_yearly` — Pro, £190 per year. Removes ads and includes extra signal detail. Length: 1 year, renews until cancelled.
- `aurafx_elite_monthly` — Elite, £49 per month. Removes ads and includes extra signal detail. Length: 1 month, renews until cancelled.
- `aurafx_elite_yearly` — Elite, £490 per year. Removes ads and includes extra signal detail. Length: 1 year, renews until cancelled.

Manage or cancel in the App Store or Google Play account settings. Payment is charged by the store.

## Ads and privacy

The free tier uses Google Mobile Ads with Google's test ad units in this prototype. Replace them with a production AdMob app id before a public release. The listing should disclose advertising and, if the identifier is used, tracking, in App Store privacy nutrition labels and the Play Data safety form.

The app can ask for notification permission so a later server can send a new-signal alert. This prototype does not send those alerts.

Local data: a watchlist of symbols stored on the device.

## Age and content

Finance app. Not a game and not a casino. Suggested rating 17+ because it discusses leveraged market products. Confirm the questionnaire against the final binary.

## Screenshot captions

1. Signals — published list, or a clear no-trade scan when the engine publishes nothing.
2. Signal — levels, chart state, and measured stats from the track record.
3. Markets — forex, metals and commodities with a watchlist.
4. Upgrade — Free, plus Pro and Elite monthly and yearly.
5. Settings — risk warning, privacy, and support@aurafxelite.com.

## Reviewer notes

Test ads use Google's sample app ids and test ad units. Purchases stay inactive until RevenueCat keys and the four product ids are created in App Store Connect and Play Console. Do not review this draft as a submitted binary.
