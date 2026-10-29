(function () {
  var DISCLAIMER = 'Aura Elite FX provides AI-assisted market analysis, confidence scoring, backtesting and risk tools. Trading involves risk and no result is guaranteed.';

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function biasClass(action) {
    if (action === 'BUY') return 'buy';
    if (action === 'SELL') return 'sell';
    return 'wait';
  }

  function word(action) {
    if (action === 'BUY') return 'Buy';
    if (action === 'SELL') return 'Sell';
    return 'Wait';
  }

  function rank(signals) {
    var order = { BUY: 0, SELL: 1, WAIT: 2 };
    return (signals || []).slice().sort(function (a, b) {
      var diff = (order[a.action] == null ? 9 : order[a.action]) - (order[b.action] == null ? 9 : order[b.action]);
      if (diff) return diff;
      return (Number(b.confidence) || 0) - (Number(a.confidence) || 0);
    });
  }

  function confidenceLine(signal) {
    if (signal.confidence == null) return 'No score';
    if (signal.confidence_basis) return signal.confidence_basis;
    return 'Setup quality ' + signal.confidence + '. This is not a forecast.';
  }

  function cardHtml(signal) {
    var levels = '<p class="pf-fine">Entry, stop and targets stay in the members area.</p>';
    var why = (signal.blockers && signal.blockers[0]) || signal.regime_note || '';
    return '<article class="pf-card pf-signal">' +
      '<div class="pf-signal-top"><strong>' + esc(signal.name || signal.instrument) + '</strong>' +
      '<span class="pf-bias ' + biasClass(signal.action) + '">' + esc(word(signal.action)) + '</span></div>' +
      '<p>' + esc(signal.regime || 'regime pending') + (signal.session ? ' · ' + esc(signal.session) : '') + '</p>' +
      '<p class="pf-fine">' + esc(confidenceLine(signal)) + '</p>' +
      (why ? '<p class="pf-fine">' + esc(why) + '</p>' : '') +
      levels + '</article>';
  }

  function renderPreview(board) {
    var phone = document.getElementById('phoneLive');
    var list = document.getElementById('signalPreview');
    var insight = document.getElementById('insightVisual');
    var signals = (board && board.signals) || [];
    var summary = (board && board.summary) || {};
    var feed = (board && board.feed) || {};
    var ranked = rank(signals);
    if (phone) {
      var counts = { trending: 0, ranging: 0, volatile: 0 };
      signals.forEach(function (signal) {
        if (counts[signal.regime] != null) counts[signal.regime] += 1;
      });
      phone.innerHTML =
        '<div class="pf-stat-row">' +
        '<div class="pf-stat"><b>' + esc(summary.buy || 0) + '</b><span>Buy</span></div>' +
        '<div class="pf-stat"><b>' + esc(summary.sell || 0) + '</b><span>Sell</span></div>' +
        '<div class="pf-stat"><b>' + esc(summary.wait || 0) + '</b><span>Wait</span></div>' +
        '<div class="pf-stat"><b>' + esc(signals.length) + '</b><span>Scanned</span></div></div>' +
        ranked.slice(0, 3).map(function (signal) {
          return '<div class="pf-mini"><span>' + esc(signal.name || signal.instrument) + '<br><small>' + esc(signal.regime || '') + '</small></span><span class="pf-bias ' + biasClass(signal.action) + '">' + esc(word(signal.action)) + '</span></div>';
        }).join('') +
        '<p class="pf-fine">' + esc(feed.detail || 'Waiting for the price feed.') + ' Trending ' + counts.trending + ' · Ranging ' + counts.ranging + ' · Volatile ' + counts.volatile + '.</p>';
    }
    if (list) {
      list.innerHTML = ranked.length
        ? ranked.slice(0, 4).map(cardHtml).join('')
        : '<article class="pf-card"><p>No scan is available yet. The board stays blank rather than showing a sample.</p></article>';
    }
    if (insight) {
      var regimes = {};
      signals.forEach(function (signal) {
        var key = signal.regime || 'unknown';
        regimes[key] = (regimes[key] || 0) + 1;
      });
      var chips = Object.keys(regimes).map(function (key) {
        return '<article class="pf-card"><h3>' + esc(key) + '</h3><p>' + regimes[key] + ' instruments on this scan</p></article>';
      }).join('');
      insight.innerHTML = chips +
        '<article class="pf-card"><h3>' + esc(feed.status || 'feed') + '</h3><p>' + esc(feed.detail || 'Price feed status is not in yet.') + '</p></article>' +
        '<article class="pf-card"><h3>' + esc((summary.buy || 0) + (summary.sell || 0)) + ' published</h3><p>' + esc(summary.wait || 0) + ' markets are Wait. Wait is a result, not a missing card.</p></article>';
    }
  }

  function loadBoard() {
    var targets = ['phoneLive', 'signalPreview', 'insightVisual'].some(function (id) { return document.getElementById(id); });
    if (!targets) return;
    fetch('/api/signals', { cache: 'no-store' })
      .then(function (res) { return res.json(); })
      .then(renderPreview)
      .catch(function () {
        var list = document.getElementById('signalPreview');
        if (list) list.innerHTML = '<article class="pf-card"><p>The live scan could not be loaded. Nothing here is a sample signal.</p></article>';
      });
  }

  function loadTrack() {
    var mount = document.getElementById('trackVisual');
    if (!mount) return;
    fetch('/api/signals/track-record', { cache: 'no-store' })
      .then(function (res) { return res.json(); })
      .then(function (record) {
        var measured = record.measured || {};
        var resolved = Number(measured.resolved) || 0;
        var rate = resolved && measured.win_rate != null
          ? (Math.round(measured.win_rate * 1000) / 10) + '% on ' + resolved + ' closed'
          : 'No closed sample';
        var note = measured.sample_note || record.basis || 'Closed take-profit and stop results only. This is not a forecast.';
        mount.innerHTML =
          '<article class="pf-card"><h3>Win rate</h3><p>' + esc(rate) + '</p></article>' +
          '<article class="pf-card"><h3>Average R</h3><p>' + esc(resolved ? measured.average_r : '—') + '</p></article>' +
          '<article class="pf-card"><h3>Profit factor</h3><p>' + esc(resolved ? measured.profit_factor : '—') + '</p></article>' +
          '<p class="pf-fine">' + esc(note) + '</p>';
      })
      .catch(function () {
        mount.innerHTML = '<article class="pf-card"><p>The measured record could not be loaded.</p></article>';
      });
  }

  function formatMoney(amount, symbol) {
    var n = Number(amount);
    if (!Number.isFinite(n)) return '';
    return symbol + (n % 1 === 0 ? String(n) : n.toFixed(2));
  }

  function priceText(tier, symbol) {
    if (tier.price == null || tier.price === '') return tier.price_label || 'Set by owner';
    var amount = formatMoney(tier.price, symbol);
    if (tier.period) amount += '/' + tier.period;
    return amount;
  }

  function tierCard(tier, data) {
    var symbol = (data && data.currency_symbol) || '£';
    var delay = tier.id === 'free' && tier.delay_minutes != null
      ? '<p class="pf-fine">Delay window: ' + esc(tier.delay_minutes) + ' minutes. The free snapshot stays empty until a saved scan is that old.</p>'
      : '';
    var annual = tier.annual_price == null ? ''
      : '<p class="pf-annual">' + esc(formatMoney(tier.annual_price, symbol)) + '/' + esc(tier.annual_period || 'year') + ' · two months free</p>';
    var action = tier.id === 'free'
      ? '<a class="pf-btn pf-btn-sm" href="signup.html">Create a free account</a>'
      : (data && data.checkout
        ? '<button type="button" class="pf-btn pf-btn-sm" data-checkout="' + esc(tier.id) + '">Checkout</button>'
        : '<button type="button" class="pf-btn pf-btn-sm" disabled>Coming soon</button>');
    return '<article class="pf-card pf-price' + (tier.id === 'pro' ? ' is-pro' : '') + '">' +
      '<h3>' + esc(tier.name) + '</h3>' +
      '<p class="pf-amount">' + esc(priceText(tier, symbol)) + '</p>' +
      annual +
      '<ul>' + (tier.features || []).map(function (line) { return '<li>' + esc(line) + '</li>'; }).join('') + '</ul>' +
      delay +
      action + '</article>';
  }

  function startCheckout(tier, mount) {
    var note = mount.querySelector('.pf-pay-note');
    if (note) note.textContent = 'Opening Stripe Checkout…';
    fetch('/api/members/checkout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: tier })
    }).then(function (res) { return res.json().then(function (body) { return { ok: res.ok, status: res.status, body: body }; }); })
      .then(function (result) {
        if (result.status === 401) {
          window.location.href = 'login.html?next=' + encodeURIComponent('pricing.html');
          return;
        }
        if (result.body && result.body.url) {
          window.location.href = result.body.url;
          return;
        }
        if (note) note.textContent = (result.body && result.body.error) || 'Checkout is coming soon.';
      }).catch(function () {
        if (note) note.textContent = 'Checkout could not be opened.';
      });
  }

  function renderPricing(data, mount) {
    var tiers = (data && data.tiers) || [];
    var portal = data && data.checkout
      ? '<p><button type="button" class="pf-btn pf-btn-sm" data-portal="1">Manage billing</button></p>'
      : '';
    mount.innerHTML = tiers.map(function (tier) { return tierCard(tier, data); }).join('') +
      portal +
      '<p class="pf-fine pf-pay-note">' + esc((data && data.note) || 'Checkout is coming soon. Email support@aurafxelite.com with questions.') + '</p>';
    mount.onclick = function (event) {
      var tier = event.target.getAttribute && event.target.getAttribute('data-checkout');
      if (tier) startCheckout(tier, mount);
      if (event.target.getAttribute && event.target.getAttribute('data-portal')) {
        fetch('/api/members/billing-portal', { method: 'POST', credentials: 'same-origin' })
          .then(function (res) { return res.json().then(function (body) { return { status: res.status, body: body }; }); })
          .then(function (result) {
            if (result.status === 401) {
              window.location.href = 'login.html?next=' + encodeURIComponent('pricing.html');
              return;
            }
            if (result.body && result.body.url) window.location.href = result.body.url;
            else {
              var note = mount.querySelector('.pf-pay-note');
              if (note) note.textContent = (result.body && result.body.error) || 'The billing portal is not available yet.';
            }
          });
      }
    };
  }

  function loadPricing() {
    var mounts = ['homePricing', 'pricingMount'].map(function (id) { return document.getElementById(id); }).filter(Boolean);
    if (!mounts.length) return;
    fetch('/api/pricing', { cache: 'no-store' })
      .then(function (res) { return res.json(); })
      .then(function (data) { mounts.forEach(function (mount) { renderPricing(data, mount); }); })
      .catch(function () {
        mounts.forEach(function (mount) {
          mount.innerHTML = '<article class="pf-card"><p>Pricing could not be loaded. Amounts stay unset until the owner edits the pricing file.</p></article>';
        });
      });
  }

  function loadFree() {
    var mount = document.getElementById('freeSnapshot');
    if (!mount) return;
    mount.innerHTML = '<article class="pf-card"><p>Checking the delayed snapshot…</p></article>';
    fetch('/api/signals/free', { cache: 'no-store' })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data.ready) {
          mount.innerHTML = '<article class="pf-card"><h3>Delayed snapshot not ready</h3><p>' + esc(data.note || 'The delay window has not filled.') + '</p></article>';
          return;
        }
        var count = (data.signals || []).length;
        mount.innerHTML = '<article class="pf-card"><h3>Delayed snapshot</h3><p>' + esc(data.note) + '</p><p class="pf-fine">' + count + ' instruments in the saved scan.</p></article>';
      })
      .catch(function () {
        mount.innerHTML = '<article class="pf-card"><p>The delayed snapshot could not be loaded.</p></article>';
      });
  }

  function bindAsk() {
    var form = document.getElementById('askForm');
    if (!form) return;
    var out = document.getElementById('askOut');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var question = (form.q.value || '').trim();
      if (!question) return;
      if (out) out.textContent = 'Reading the current board…';
      fetch('/api/signals/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question })
      }).then(function (res) { return res.json(); })
        .then(function (data) {
          if (!out) return;
          out.textContent = (data.answer || data.error || 'No answer.') + (data.note ? ' ' + data.note : '');
        })
        .catch(function () {
          if (out) out.textContent = 'The assistant could not answer just now.';
        });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadBoard();
    loadTrack();
    loadPricing();
    loadFree();
    bindAsk();
    var note = document.querySelector('[data-disclaimer]');
    if (note && !note.textContent) note.textContent = DISCLAIMER;
  });
})();
