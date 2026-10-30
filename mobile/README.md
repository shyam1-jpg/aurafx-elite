# AuraFX Elite Signals

Store-ready prototype for the AuraFX Elite signal point. It is a React Native app on Expo SDK 58, in this `mobile/` folder only. It reads the public site at `https://aurafxelite.com` and does not place trades.

Aura Elite FX provides AI-assisted market analysis, confidence scoring, backtesting and risk tools. Trading involves risk and no result is guaranteed.

## Requirements

- Node.js 22
- An Expo account only when you build with EAS
- Xcode for a local iOS build, Android Studio for a local Android build

Ads (`react-native-google-mobile-ads`) and subscriptions (`react-native-purchases`) are native modules. They are not in Expo Go. Use a development build or an EAS build to exercise them. The web preview shows the same screens with Google's test ad unit IDs labeled, and it does not grant a paid tier.

## Run

```bash
cd mobile
npm install
npx expo start
```

Web preview:

```bash
npx expo start --web
```

The API base is `https://aurafxelite.com` (`extra.apiBase` in `app.json`). Override it with `EXPO_PUBLIC_API_BASE` only when you are pointing at a copy of the same API.

Typecheck and static web export:

```bash
npx tsc --noEmit
npx expo export --platform web
```

## iOS and Android builds

Bundle ids, set in `app.json`:

- iOS: `com.aurafxelite.signals`
- Android: `com.aurafxelite.signals`

`eas.json` has `development`, `preview`, and `production` profiles. Do not submit this prototype to the App Store or Google Play.

```bash
npx eas-cli@latest build --platform all --profile preview
```

A production binary is the same command with `--profile production`. Store submission is a separate step and is out of scope.

## What the screens call

| Screen | Endpoint |
| --- | --- |
| Signals | `GET /api/signals`, `GET /api/signals/track-record` |
| Signal detail | those, plus `GET /api/members/candles?instrument=&timeframe=H1` |
| Markets | `GET /api/markets` |
| Upgrade | `GET /api/pricing` |
| Settings | `GET /api/signals/plans` |

If a call fails, or a field is missing, the screen shows that empty or error state. Candle history currently requires a member session, so the chart reports the server error instead of drawing stand-in bars. Measured win rate, average R, profit factor and drawdown come only from the track record.

## Ads

Google sample app ids are in the `react-native-google-mobile-ads` config plugin. Banner and rewarded units use the library `TestIds`, which are Google's test units:

- Android banner `ca-app-pub-3940256099942544/6300978111`
- iOS banner `ca-app-pub-3940256099942544/2934735716`
- Android rewarded `ca-app-pub-3940256099942544/5224354917`
- iOS rewarded `ca-app-pub-3940256099942544/1712485313`

The free tier shows a banner. A completed rewarded test ad unlocks factor notes and the rationale for that signal. Pro and Elite remove ads and skip the rewarded step. Do not replace the test units until a real AdMob app is approved.

## Subscriptions

RevenueCat product ids:

- `aurafx_pro_monthly` maps to the site Pro tier
- `aurafx_pro_yearly` maps to the site Elite tier (yearly price)

Keys are read from `EXPO_PUBLIC_REVENUECAT_IOS_KEY` and `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`. Leave them unset until the store products exist. Without a key, Upgrade explains that the paid tier is not granted.

## Push

`expo-notifications` registers a permission and, once an EAS project id exists, an Expo push token. This build does not send a notification and does not subscribe the device to `/api/signals/alerts`.

## Icon

`assets/icon.png` is rendered from `marketplace/icons/aura-icon-master.svg`.
