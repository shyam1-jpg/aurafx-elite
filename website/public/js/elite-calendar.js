/**
 * AuraFX Economic Calendar — full page + embeddable widget.
 * Fetches /api/calendar with filters; countdown to next event.
 */
(function () {
  var API = window.AURAFX_API_BASE || '';
  var state = { items: [], nextEvent: null, source: '', finnhub: false, updatedAt: null };
  var filters = { hours: '168', risk: '', currency: '' };

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function riskClass(r) {
    var x = String(r || '').toUpperCase();
    if (x === 'HIGH') return 'elite-tag-hi';
    if (x === 'MEDIUM') return 'elite-tag-med';
    return 'elite-tag-lo';
  }

  function fmtTime(iso) {
    try {
      return new Date(iso).toLocaleString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit', hour12: false
      });
    } catch (_) { return iso; }
  }

  function fmtCountdown(iso) {
    var ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return 'Now / passed';
    var m = Math.floor(ms / 60000);
    if (m < 60) return m + ' min';
    var h = Math.floor(m / 60);
    var rm = m % 60;
    if (h < 48) return h + 'h ' + rm + 'm';
    return Math.floor(h / 24) + 'd ' + (h % 24) + 'h';
  }

  function groupByDay(items) {
    var groups = {};
    items.forEach(function (e) {
      var d = new Date(e.time);
      var key = d.toISOString().slice(0, 10);
      if (!groups[key]) groups[key] = { label: d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }), events: [] };
      groups[key].events.push(e);
    });
    return Object.keys(groups).sort().map(function (k) { return groups[k]; });
  }

  function renderHero(mount) {
    if (!mount) return;
    var ne = state.nextEvent;
    mount.innerHTML =
      '<div class="elite-cal-hero lux-glass lux-shimmer">' +
      '<div class="elite-cal-hero-grid">' +
      '<div><span class="lux-badge-elite">Next event</span>' +
      '<h2 style="margin:.5rem 0;font-size:1.25rem">' + esc(ne ? ne.title : 'Loading calendar…') + '</h2>' +
      '<p style="color:var(--muted);font-size:.88rem">' +
      (ne ? esc(ne.currency) + ' · ' + esc(ne.risk) + ' impact · ' + fmtTime(ne.time) : '') + '</p></div>' +
      '<div class="elite-cal-countdown">' +
      '<div class="num" id="eliteCalCountdown">' + (ne ? fmtCountdown(ne.time) : '—') + '</div>' +
      '<div class="lbl">until release</div></div></div>' +
      '<p class="elite-cal-source" id="eliteCalSource"></p></div>';
    var src = document.getElementById('eliteCalSource');
    if (src) {
      src.textContent = 'Source: ' + (state.source || 'AuraFX server') +
        (state.finnhub ? ' · Finnhub LIVE' : ' · Reference schedule (add FINNHUB_API_KEY on Render for live data)') +
        ' · Updated ' + (state.updatedAt ? new Date(state.updatedAt).toLocaleTimeString() : '—');
    }
  }

  function renderFilters(mount) {
    if (!mount) return;
    var risks = ['', 'HIGH', 'MEDIUM', 'LOW'];
    var currs = ['', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'];
    mount.innerHTML =
      '<div class="elite-cal-filters lux-glass">' +
      '<label>Window <select id="eliteCalHours"><option value="24">24 hours</option><option value="48">48 hours</option><option value="168" selected>7 days</option></select></label>' +
      '<label>Impact <select id="eliteCalRisk">' + risks.map(function (r) {
        return '<option value="' + r + '">' + (r || 'All') + '</option>';
      }).join('') + '</select></label>' +
      '<label>Currency <select id="eliteCalCurrency">' + currs.map(function (c) {
        return '<option value="' + c + '">' + (c || 'All') + '</option>';
      }).join('') + '</select></label>' +
      '<button type="button" class="btn btn-outline" id="eliteCalRefresh">Refresh</button></div>';

    document.getElementById('eliteCalHours').value = filters.hours;
    document.getElementById('eliteCalRisk').value = filters.risk;
    document.getElementById('eliteCalCurrency').value = filters.currency;

    ['eliteCalHours', 'eliteCalRisk', 'eliteCalCurrency'].forEach(function (id) {
      document.getElementById(id).addEventListener('change', function () {
        filters.hours = document.getElementById('eliteCalHours').value;
        filters.risk = document.getElementById('eliteCalRisk').value;
        filters.currency = document.getElementById('eliteCalCurrency').value;
        load();
      });
    });
    document.getElementById('eliteCalRefresh').addEventListener('click', load);
  }

  function renderTable(mount) {
    if (!mount) return;
    if (!state.items.length) {
      mount.innerHTML = '<p style="color:var(--muted);text-align:center;padding:2rem">No events match filters.</p>';
      return;
    }
    var groups = groupByDay(state.items);
    var html = groups.map(function (g) {
      var rows = g.events.map(function (e) {
        return '<tr class="elite-cal-row" data-risk="' + esc(e.risk) + '">' +
          '<td class="elite-cal-time">' + fmtTime(e.time) + '<br><span class="muted">' + fmtCountdown(e.time) + '</span></td>' +
          '<td><span class="' + riskClass(e.risk) + '">' + esc(e.risk) + '</span></td>' +
          '<td><strong>' + esc(e.currency) + '</strong></td>' +
          '<td><strong>' + esc(e.title) + '</strong><br><span class="muted" style="font-size:.75rem">' + esc(e.impact || e.category || '') + '</span></td>' +
          '<td>' + esc(e.forecast || '—') + '</td>' +
          '<td>' + esc(e.previous || '—') + '</td>' +
          '<td>' + esc(e.actual || '—') + '</td></tr>';
      }).join('');
      return '<div class="elite-cal-day lux-glass"><h3 class="elite-cal-day-title">' + esc(g.label) + '</h3>' +
        '<table class="elite-cal-table"><thead><tr><th>Time</th><th>Impact</th><th>Cur</th><th>Event</th><th>Forecast</th><th>Previous</th><th>Actual</th></tr></thead><tbody>' +
        rows + '</tbody></table></div>';
    }).join('');
    mount.innerHTML = html;
  }

  function renderStats(mount) {
    if (!mount) return;
    var high = state.items.filter(function (e) { return e.risk === 'HIGH'; }).length;
    var med = state.items.filter(function (e) { return e.risk === 'MEDIUM'; }).length;
    mount.innerHTML =
      '<div class="elite-stat-row">' +
      '<div class="elite-stat lux-glass"><div class="num">' + state.items.length + '</div><div class="lbl">Events in window</div></div>' +
      '<div class="elite-stat lux-glass"><div class="num">' + high + '</div><div class="lbl">High impact</div></div>' +
      '<div class="elite-stat lux-glass"><div class="num">' + med + '</div><div class="lbl">Medium impact</div></div>' +
      '<div class="elite-stat lux-glass"><div class="num">' + (state.finnhub ? 'LIVE' : 'REF') + '</div><div class="lbl">Data mode</div></div></div>';
  }

  async function load() {
    var qs = '?hours=' + encodeURIComponent(filters.hours) +
      '&risk=' + encodeURIComponent(filters.risk) +
      '&currency=' + encodeURIComponent(filters.currency);
    try {
      var r = await fetch(API + '/api/calendar' + qs, { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var d = await r.json();
      state.items = d.items || d.calendar || [];
      state.nextEvent = d.nextEvent;
      state.source = d.source || '';
      state.finnhub = !!d.finnhubEnabled;
      state.updatedAt = d.updatedAt;
    } catch (_) {
      state.items = [];
    }
    renderHero(document.getElementById('eliteCalHero'));
    renderStats(document.getElementById('eliteCalStats'));
    renderTable(document.getElementById('eliteCalTable'));
  }

  function tickCountdown() {
    var el = document.getElementById('eliteCalCountdown');
    if (el && state.nextEvent && state.nextEvent.time) {
      el.textContent = fmtCountdown(state.nextEvent.time);
    }
  }

  function init() {
    renderFilters(document.getElementById('eliteCalFilters'));
    load();
    setInterval(tickCountdown, 30000);
    setInterval(load, 300000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /** Compact list for dashboard embed */
  window.AURAFX_renderCalendarList = function (container, limit) {
    if (!container) return;
    fetch(API + '/api/calendar?hours=168', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var items = (d.items || []).slice(0, limit || 15);
        container.innerHTML = items.map(function (e) {
          return '<li class="elite-cal-li"><span class="' + riskClass(e.risk) + '">' + esc(e.risk) + '</span> ' +
            '<strong>' + esc(e.title) + '</strong> <span class="muted">(' + esc(e.currency) + ')</span><br>' +
            '<span class="muted" style="font-size:.75rem">' + fmtTime(e.time) + ' · ' + fmtCountdown(e.time) + '</span></li>';
        }).join('') || '<li style="color:var(--muted)">No upcoming events</li>';
      })
      .catch(function () {
        container.innerHTML = '<li style="color:var(--muted)">Calendar unavailable</li>';
      });
  };

  window.AURAFX_EliteCalendar = { load: load, state: state };
})();
