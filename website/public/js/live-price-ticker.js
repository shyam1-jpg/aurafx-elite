/**
 * Live price display — updates DOM from real /api/quotes data (no fake random ticks).
 */
(function () {
  var prices = {};
  var started = false;
  var apiMs = 30000;

  function key(cat, sym) {
    return cat + ':' + sym;
  }

  function decimals(cat, sym) {
    if (cat === 'forex') {
      if (sym.indexOf('JPY') >= 0) return 3;
      return 5;
    }
    if (cat === 'crypto') return parseFloat(prices[key(cat, sym)]) < 1 ? 6 : 2;
    if (cat === 'metals') return 2;
    if (cat === 'indices') return 0;
    return 2;
  }

  function format(cat, sym, val) {
    var n = Number(val);
    if (!isFinite(n)) return '—';
    return n.toFixed(decimals(cat, sym));
  }

  function setPrice(cat, sym, val) {
    if (val == null || !isFinite(Number(val))) return;
    prices[key(cat, sym)] = Number(val);
  }

  function seedFromData(data) {
    if (!data) return;
    (data.forex && data.forex.majors || []).concat(data.forex.minors || [], data.forex.exotics || []).forEach(function (r) {
      setPrice('forex', r.symbol, r.price);
    });
    (data.crypto || []).forEach(function (r) { setPrice('crypto', r.symbol, r.price); });
    (data.metals || []).forEach(function (r) { setPrice('metals', r.symbol, r.spotPrice); });
    (data.energy || []).forEach(function (r) { setPrice('energy', r.symbol, r.price); });
    (data.indices || []).forEach(function (r) { setPrice('indices', r.symbol, r.value); });
    (data.ag || []).forEach(function (r) { setPrice('ag', r.symbol, r.price); });
  }

  function syncFromLiveQuotes() {
    var q = window.AURAFX_LIVE_QUOTES || {};
    Object.keys(q.forex || {}).forEach(function (sym) { setPrice('forex', sym, q.forex[sym]); });
    Object.keys(q.crypto || {}).forEach(function (sym) { setPrice('crypto', sym, q.crypto[sym]); });
    Object.keys(q.metals || {}).forEach(function (sym) { setPrice('metals', sym, q.metals[sym]); });
    pushAllToDom();
    updateBadge();
  }

  function flashCell(cell, dir) {
    cell.classList.remove('price-flash-up', 'price-flash-down');
    void cell.offsetWidth;
    cell.classList.add(dir === 'up' ? 'price-flash-up' : 'price-flash-down');
    setTimeout(function () {
      cell.classList.remove('price-flash-up', 'price-flash-down');
    }, 450);
  }

  function pushAllToDom() {
    document.querySelectorAll('[data-live-price]').forEach(function (cell) {
      var sym = cell.getAttribute('data-live-price');
      var cat = cell.getAttribute('data-live-cat') || 'forex';
      var k = key(cat, sym);
      if (prices[k] == null) return;
      var next = format(cat, sym, prices[k]);
      var isPill = cell.classList && cell.classList.contains('inst-watch-pill');
      var nextText = isPill ? sym + ' ' + next : next;
      var prev = cell.textContent.trim();
      var prevNum = isPill ? (prev.split(/\s+/).pop() || '') : prev;
      if (prevNum !== next) {
        var dir = parseFloat(next) >= parseFloat(prevNum) ? 'up' : 'down';
        cell.textContent = nextText;
        flashCell(cell, dir);
      }
    });
  }

  function ageLabel(iso) {
    if (!iso) return '—';
    var sec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (sec < 0) sec = 0;
    if (sec < 60) return sec + 's ago';
    return Math.floor(sec / 60) + 'm ago';
  }

  function updateBadge() {
    var el = document.getElementById('gmPriceLiveBadge');
    if (!el) return;
    var q = window.AURAFX_LIVE_QUOTES || {};
    if (q.live) {
      el.textContent = '● LIVE PRICES';
      el.className = 'live-tick-badge on';
    } else {
      el.textContent = '○ OFFLINE';
      el.className = 'live-tick-badge';
    }
    el.title = (q.source || '') + ' · updated ' + ageLabel(q.updatedAt);
  }

  function start() {
    if (started) return;
    started = true;
    setInterval(function () {
      if (window.AURAFX_refreshLiveQuotes) window.AURAFX_refreshLiveQuotes();
    }, apiMs);
    document.addEventListener('aurafx-quotes-updated', syncFromLiveQuotes);
    updateBadge();
  }

  window.AURAFX_TICKER = {
    seedFromData: seedFromData,
    syncFromLiveQuotes: syncFromLiveQuotes,
    start: start,
    scanDom: pushAllToDom
  };

  document.addEventListener('aurafx-markets-mounted', function () {
    start();
    syncFromLiveQuotes();
  });
})();
