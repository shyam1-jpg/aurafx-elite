(function () {
  'use strict';
  const core = window.AuraTradingTools;
  const $ = id => document.getElementById(id);
  if (!core || !$('toolsChart')) return;
  const KEY = 'aurafx_trading_tools_v1';
  const defaults = ['XAUUSD', 'EURUSD', 'GBPUSD', 'BTC'];
  let saved;
  try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { /* local storage unavailable */ }
  let watchlist = Array.isArray(saved?.watchlist)
    ? [...new Set(saved.watchlist.filter(s => Object.hasOwn(core.symbols, s)))] : defaults;
  let alerts = Array.isArray(saved?.alerts) ? saved.alerts.filter(core.validAlert).slice(0, 50).map(a => ({
    id: a.id, symbol: a.symbol, target: a.target, direction: a.direction,
    triggeredAt: typeof a.triggeredAt === 'string' && Number.isFinite(Date.parse(a.triggeredAt)) ? a.triggeredAt : null
  })) : [];
  let chartLoaded = false;
  let chartTimer;
  let toastTimer;
  let quotes = window.AURAFX_LIVE_QUOTES || {};
  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ watchlist, alerts: alerts.map(a => ({
        id: a.id, symbol: a.symbol, target: a.target, direction: a.direction, triggeredAt: a.triggeredAt || null
      })) }));
      $('toolsStorageStatus').textContent = '';
    } catch (_) { $('toolsStorageStatus').textContent = 'Browser storage is unavailable. Changes last for this visit only.'; }
  }
  function option(symbol) {
    const el = document.createElement('option');
    el.value = symbol;
    el.textContent = core.symbols[symbol].name + ' · ' + symbol;
    return el;
  }
  ['toolsSymbol', 'toolsWatchSymbol', 'toolsAlertSymbol'].forEach(id => {
    Object.keys(core.symbols).forEach(s => $(id).appendChild(option(s)));
  });
  function text(tag, value, className) {
    const el = document.createElement(tag);
    el.textContent = value;
    if (className) el.className = className;
    return el;
  }
  function price(symbol, value) { return Number(value).toFixed(core.symbols[symbol].digits); }
  function updateChartLink() {
    $('toolsChartLink').href = 'https://www.tradingview.com/chart/?symbol=' + encodeURIComponent(core.symbols[$('toolsSymbol').value].chart);
  }
  function loadChart() {
    chartLoaded = true;
    clearTimeout(chartTimer);
    const host = $('toolsChart');
    host.replaceChildren();
    const container = document.createElement('div');
    container.className = 'tradingview-widget-container';
    const widget = document.createElement('div');
    widget.className = 'tradingview-widget-container__widget';
    container.appendChild(widget);
    const credit = document.createElement('div');
    credit.className = 'tradingview-widget-copyright';
    const link = document.createElement('a');
    link.href = $('toolsChartLink').href;
    link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.textContent = 'Track all markets on TradingView';
    credit.appendChild(link); container.appendChild(credit);
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.textContent = JSON.stringify({
      autosize: true, symbol: core.symbols[$('toolsSymbol').value].chart,
      interval: $('toolsInterval').value, timezone: 'Etc/UTC', theme: 'dark', style: '1', locale: 'en',
      hide_side_toolbar: false, hide_top_toolbar: false, allow_symbol_change: true,
      withdateranges: true, save_image: true, calendar: false, support_host: 'https://www.tradingview.com'
    });
    $('toolsChartStatus').textContent = 'Loading external chart…';
    script.onerror = () => {
      if (!host.contains(container)) return;
      $('toolsChartStatus').textContent = 'Chart could not load. Retry or use the TradingView link below.';
    };
    host.appendChild(container); container.appendChild(script);
    // The cross-origin chart cannot report successful rendering to this page.
    chartTimer = setTimeout(() => {
      $('toolsChartStatus').textContent = 'If the chart is blank or unavailable, retry or open TradingView below. Watchlist and alerts use the selected AuraFX market, independently of changes inside the chart.';
    }, 10000);
  }
  function selectMarket(symbol) {
    $('toolsSymbol').value = symbol;
    $('toolsAlertSymbol').value = symbol;
    updateChartLink();
    if (chartLoaded) loadChart();
    renderWatchlist();
  }
  function renderWatchlist() {
    const tbody = $('toolsWatchRows');
    const focused = document.activeElement;
    const focusSymbol = focused?.dataset?.watchSymbol;
    const focusAction = focused?.dataset?.watchAction;
    tbody.replaceChildren();
    const now = Date.now();
    let fresh = 0;
    watchlist.forEach(symbol => {
      const config = core.symbols[symbol];
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      const select = text('button', config.name, $('toolsSymbol').value === symbol ? 'tools-selected' : '');
      select.type = 'button'; select.dataset.watchSymbol = symbol; select.dataset.watchAction = 'select';
      select.addEventListener('click', () => selectMarket(symbol));
      cell.appendChild(select); cell.appendChild(text('small', symbol)); row.appendChild(cell);
      const sample = core.quote(quotes, symbol, now);
      if (sample) fresh++;
      const valueCell = text('td', sample ? price(symbol, sample.price) : '—');
      valueCell.appendChild(text('small', sample ? new Date(sample.at).toLocaleTimeString() : 'No fresh quote'));
      row.appendChild(valueCell);
      const removeCell = document.createElement('td');
      const remove = text('button', '×'); remove.type = 'button';
      remove.dataset.watchSymbol = symbol; remove.dataset.watchAction = 'remove';
      remove.setAttribute('aria-label', 'Remove ' + config.name + ' from watchlist');
      remove.addEventListener('click', () => { watchlist = watchlist.filter(s => s !== symbol); persist(); renderWatchlist(); });
      removeCell.appendChild(remove); row.appendChild(removeCell); tbody.appendChild(row);
    });
    if (!watchlist.length) { const row = document.createElement('tr'); const cell = text('td', 'Add a market to begin.'); cell.colSpan = 3; row.appendChild(cell); tbody.appendChild(row); }
    $('toolsFeedStatus').textContent = fresh
      ? fresh + '/' + watchlist.length + ' fresh · ' + (quotes.source || 'AuraFX feed')
      : 'No fresh quotes. Markets may be closed or the feed unavailable.';
    if (focusSymbol) {
      const replacement = [...tbody.querySelectorAll('button')].find(b => b.dataset.watchSymbol === focusSymbol && b.dataset.watchAction === focusAction);
      replacement?.focus({ preventScroll: true });
    }
  }
  function renderAlerts() {
    const list = $('toolsAlertList'); list.replaceChildren();
    alerts.forEach(a => {
      const item = document.createElement('li');
      const remove = text('button', 'Delete', 'btn-dash'); remove.type = 'button';
      remove.setAttribute('aria-label', 'Delete alert for ' + core.symbols[a.symbol].name);
      remove.addEventListener('click', () => { alerts = alerts.filter(x => x.id !== a.id); persist(); renderAlerts(); });
      item.appendChild(remove);
      item.appendChild(text('strong', core.symbols[a.symbol].name + ' crosses ' + a.direction + ' ' + price(a.symbol, a.target)));
      item.appendChild(text('p', a.triggeredAt ? 'Triggered ' + new Date(a.triggeredAt).toLocaleString() : 'Armed · waiting for a fresh price crossing', 'muted'));
      list.appendChild(item);
    });
    if (!alerts.length) list.appendChild(text('li', 'No alerts yet. Choose a market and target price to create one.', 'muted'));
  }
  function notify(a, sample) {
    const message = core.symbols[a.symbol].name + ' crossed ' + a.direction + ' ' + price(a.symbol, a.target) + '. AuraFX quote: ' + price(a.symbol, sample.price);
    clearTimeout(toastTimer);
    $('toolsToast').textContent = message;
    toastTimer = setTimeout(() => { $('toolsToast').textContent = ''; }, 15000);
    try {
      if ('Notification' in window && Notification.permission === 'granted') new Notification('AuraFX price alert', { body: message });
    } catch (_) { /* on-page notification remains available */ }
  }
  function tick() {
    quotes = window.AURAFX_LIVE_QUOTES || {};
    const now = Date.now();
    let triggered = false;
    alerts.forEach(a => {
      const sample = core.quote(quotes, a.symbol, now);
      if (core.step(a, sample)) { triggered = true; notify(a, sample); }
    });
    if (triggered) { persist(); renderAlerts(); }
    renderWatchlist();
  }
  $('toolsWatchForm').addEventListener('submit', e => {
    e.preventDefault();
    const symbol = $('toolsWatchSymbol').value;
    if (!watchlist.includes(symbol)) watchlist.push(symbol);
    persist(); renderWatchlist();
  });
  $('toolsAlertForm').addEventListener('submit', e => {
    e.preventDefault();
    if (alerts.length >= 50) { $('toolsAlertMessage').textContent = 'Delete an existing alert before adding another (limit 50).'; return; }
    const a = { id: String(Date.now()) + '-' + Math.random().toString(36).slice(2), symbol: $('toolsAlertSymbol').value,
      direction: $('toolsAlertDirection').value, target: Number($('toolsAlertPrice').value) };
    if (!core.validAlert(a)) { $('toolsAlertMessage').textContent = 'Enter a target price greater than zero.'; return; }
    core.step(a, core.quote(window.AURAFX_LIVE_QUOTES, a.symbol, Date.now()));
    alerts.push(a); persist(); renderAlerts();
    $('toolsAlertMessage').textContent = 'Alert saved. It fires on the next fresh crossing in your chosen direction.';
  });
  $('toolsNotifications').addEventListener('click', async () => {
    try {
      if (!('Notification' in window)) { $('toolsNotificationStatus').textContent = 'This browser supports on-page alerts only.'; return; }
      const result = await Notification.requestPermission();
      $('toolsNotificationStatus').textContent = result === 'granted' ? 'Browser notifications enabled while the dashboard is open.' : 'Notifications are not enabled. On-page alerts still work.';
    } catch (_) { $('toolsNotificationStatus').textContent = 'Use on-page alerts; browser notifications are unavailable.'; }
  });
  $('toolsLoadChart').addEventListener('click', loadChart);
  $('toolsSymbol').addEventListener('change', () => selectMarket($('toolsSymbol').value));
  $('toolsInterval').addEventListener('change', () => { if (chartLoaded) loadChart(); });
  document.addEventListener('aurafx-quotes-updated', tick);
  updateChartLink(); renderAlerts(); tick();
  setInterval(tick, 5000);
})();
