(function () {
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function word(action) {
    if (action === 'BUY') return 'Buy';
    if (action === 'SELL') return 'Sell';
    return 'Wait';
  }

  function biasClass(action) {
    if (action === 'BUY') return 'buy';
    if (action === 'SELL') return 'sell';
    return 'wait';
  }

  function render(data) {
    var list = document.getElementById('planList');
    var risk = document.getElementById('planRisk');
    var stamp = document.getElementById('planStamp');
    if (!list) return;
    var plans = data.plans || [];
    if (stamp) stamp.textContent = 'Scan date ' + (data.plan_date || '—') + ' UTC. This restates the current signals.';
    if (risk && data.risk) {
      risk.innerHTML =
        '<div><b>' + esc(data.risk.per_trade_pct) + '%</b><span>Per trade</span></div>' +
        '<div><b>' + esc(data.risk.max_daily_loss_pct) + '%</b><span>Daily loss cap</span></div>' +
        '<div><b>' + esc(data.risk.max_weekly_loss_pct) + '%</b><span>Weekly loss cap</span></div>' +
        '<div><b>' + esc(data.risk.max_open_trades) + '</b><span>Open trades · auto ' + esc(data.risk.auto_trading) + '</span></div>';
    }
    if (!plans.length) {
      list.innerHTML = '<article class="pf-card"><p>No plan until the scan returns. Levels are not invented.</p></article>';
      return;
    }
    list.innerHTML = plans.map(function (plan) {
      var levels = '<p class="pf-fine">' + esc(plan.levels_note || 'Entry, stop and targets stay in the members area.') + '</p>';
      var scenario = plan.scenario || {};
      return '<article class="pf-card">' +
        '<div class="pf-plan-top"><strong>' + esc(plan.name) + '</strong><span class="pf-bias ' + biasClass(plan.bias) + '">' + esc(word(plan.bias)) + '</span></div>' +
        '<p>' + esc(plan.regime || 'Regime pending') + (plan.session ? ' · ' + esc(plan.session) : '') +
        (plan.price != null ? ' · Last ' + esc(plan.price) : '') + '</p>' +
        '<p><strong>' + esc(scenario.label || 'Scenario') + '.</strong> ' + esc(scenario.detail || '') + '</p>' +
        levels +
        (plan.confidence_basis ? '<p class="pf-fine">' + esc(plan.confidence_basis) + '</p>' : '') +
        '<p class="pf-fine">' + esc(plan.note || '') + '</p></article>';
    }).join('');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var list = document.getElementById('planList');
    if (!list) return;
    list.innerHTML = '<article class="pf-card"><p>Building today’s plans from the current scan…</p></article>';
    fetch('/api/signals/plans', { cache: 'no-store' })
      .then(function (res) { return res.json(); })
      .then(render)
      .catch(function () {
        list.innerHTML = '<article class="pf-card"><p>Plans could not be loaded. No levels are shown in their place.</p></article>';
      });
  });
})();
