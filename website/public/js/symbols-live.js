/**
 * Live symbol table — fills data-live-price cells from /api/quotes
 */
(function () {
  function fmt(cat, sym, val) {
    var n = Number(val);
    if (!isFinite(n)) return '—';
    if (cat === 'forex' && sym.indexOf('JPY') >= 0) return n.toFixed(3);
    if (cat === 'forex') return n.toFixed(5);
    if (cat === 'metals') return n.toFixed(2);
    if (cat === 'crypto') return n < 1 ? n.toFixed(4) : n.toFixed(2);
    return n.toFixed(2);
  }

  function apply() {
    var q = window.AURAFX_LIVE_QUOTES || {};
    document.querySelectorAll('[data-sym-row]').forEach(function (row) {
      var sym = row.getAttribute('data-sym-row');
      var cat = row.getAttribute('data-sym-cat') || 'forex';
      var bucket = q[cat] || {};
      var ch = (q.changes || {})[sym];
      var px = row.querySelector('.live-px');
      var chEl = row.querySelector('.live-ch');
      if (px && bucket[sym] != null) px.textContent = fmt(cat, sym, bucket[sym]);
      if (chEl && ch != null) {
        chEl.textContent = (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%';
        chEl.className = 'live-ch ' + (ch >= 0 ? 'up' : 'down');
      }
    });
    var badge = document.getElementById('symSourceBadge');
    if (badge) {
      badge.textContent = q.live ? 'LIVE · ' + (q.source || 'AuraFX') : 'Loading…';
    }
  }

  document.addEventListener('aurafx-quotes-updated', apply);
  if (window.AURAFX_LIVE_QUOTES && window.AURAFX_LIVE_QUOTES.loaded) apply();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
})();
