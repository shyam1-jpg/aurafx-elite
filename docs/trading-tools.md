# Charts, watchlist and price alerts

Open **Charts & alerts** in the dashboard sidebar.

- Load the TradingView chart to access its indicators, drawing toolbar and timeframes. This explicitly loads a third-party widget. Changing the outer symbol or timeframe rebuilds the widget; drawings may reset. The TradingView link remains available when embedding fails.
- Add or remove gold, silver, four forex majors, Bitcoin and Ethereum from the AuraFX watchlist. Selecting a row chooses the outer chart and alert market.
- Create a one-shot crossing alert, then optionally enable browser notifications. Triggered alerts remain in the list until deleted.

Chart prices use TradingView's providers. Watchlist prices and alerts use AuraFX `/api/quotes`; these feeds are independent and can differ. Changes within the embedded chart do not change AuraFX alerts or the outer market selector.

Alerts require a positive live price and a per-symbol timestamp no older than two minutes. Duplicate timestamps, reference prices and stale quotes cannot trigger an alert. The first fresh quote establishes a baseline; gaps over two minutes reset it, so missed crossings are not replayed.

Watchlist and alert settings are stored in `aurafx_trading_tools_v1` in this browser's local storage. No email, account sync, background service or closed-browser alert delivery is provided. Browser suspension, throttling and network outages can delay or miss alerts. No orders are sent.

Validation:

```
node website/test-trading-tools.js
node website/test-dashboard-tools.js
```

Official widget reference: https://www.tradingview.com/widget-docs/tutorials/iframe/build-page/widget-integration/
