/**
 * AuraFX system status — owner-only server check (not shown to customers).
 */
(function () {
  var API = window.AURAFX_API_BASE || '';

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  }

  function statusRow(name, ok, detail, ms) {
    return '<tr><td>' + esc(name) + '</td><td class="' + (ok ? 'wire-ok' : 'wire-fail') + '">' +
      (ok ? '✓ OK' : '✗ FAIL') + '</td><td>' + esc(detail) + '</td><td>' + (ms != null ? ms + ' ms' : '—') + '</td></tr>';
  }

  async function ping(path) {
    var t0 = performance.now();
    try {
      var r = await fetch(API + path, { cache: 'no-store' });
      var ms = Math.round(performance.now() - t0);
      if (!r.ok) return { ok: false, ms: ms, detail: 'HTTP ' + r.status };
      await r.json().catch(function () { return {}; });
      return { ok: true, ms: ms, detail: 'OK' };
    } catch (e) {
      return { ok: false, ms: Math.round(performance.now() - t0), detail: e.message || 'Network error' };
    }
  }

  async function pingPage(file) {
    var t0 = performance.now();
    try {
      var r = await fetch(API + '/' + file, { cache: 'no-store' });
      var ms = Math.round(performance.now() - t0);
      return { ok: r.ok, ms: ms, detail: r.ok ? 'Loads' : 'HTTP ' + r.status };
    } catch (e) {
      return { ok: false, ms: Math.round(performance.now() - t0), detail: e.message || 'Fail' };
    }
  }

  async function runTests() {
    var summary = document.getElementById('wiringSummary');
    var serverEl = document.getElementById('wiringServer');
    var apisEl = document.getElementById('wiringApis');
    var pagesEl = document.getElementById('wiringPages');
    var modsEl = document.getElementById('wiringModules');

    if (summary) summary.innerHTML = '<p>Checking system status…</p>';

    var wiringRes = await fetch(API + '/api/wiring', { cache: 'no-store' }).catch(function () { return null; });
    var manifest = wiringRes && wiringRes.ok ? await wiringRes.json() : null;
    var wiring = { ok: !!(wiringRes && wiringRes.ok) };

    var apiPaths = [
      ['/api/health', 'Health'],
      ['/api/status', 'Website status'],
      ['/api/quotes', 'Live market prices'],
      ['/api/pro-summary', 'Pro dashboard data'],
      ['/api/risk-summary', 'Risk + calendar'],
      ['/api/news', 'News feed'],
      ['/api/institutional', 'Institutional terminal'],
      ['/api/institutional-live', 'Live preview (owner; 403 if demo mode)'],
      ['/api/markets', 'Global markets']
    ];

    var apiRows = '';
    var apiPass = 0;
    for (var i = 0; i < apiPaths.length; i++) {
      var p = apiPaths[i];
      var res = await ping(p[0]);
      if (res.ok) apiPass++;
      apiRows += statusRow(p[1], res.ok, res.detail, res.ms);
    }

    var pageFiles = [
      ['index.html', 'Marketing home'],
      ['hard-sell.html', 'AuraFX Lite signals preview'],
      ['aura-lite.html', 'Lite redirect'],
      ['dashboard.html', 'Pro dashboard'],
      ['register.html', 'Client registration'],
      ['mt5-install.html', 'MT5 install guide'],
      ['terms.html', 'Terms of use'],
      ['privacy.html', 'Privacy policy'],
      ['risk-warning.html', 'Risk warning'],
      ['system-status.html', 'System status']
    ];
    var pageRows = '';
    var pagePass = 0;
    for (var j = 0; j < pageFiles.length; j++) {
      var f = pageFiles[j];
      var pr = await pingPage(f[0]);
      if (pr.ok) pagePass++;
      pageRows += statusRow(f[1], pr.ok, pr.detail, pr.ms);
    }

    var checks = [
      ['API connection', typeof window.AURAFX_API_BASE !== 'undefined', String(window.AURAFX_API_BASE || 'same-origin')],
      ['system-status.js', true, 'Loaded'],
      ['localStorage', !!window.localStorage, 'Journal']
    ];
    var modRows = '';
    checks.forEach(function (c) {
      modRows += statusRow(c[0], c[1], c[2], null);
    });

    var total = apiPaths.length + pageFiles.length;
    var passed = apiPass + pagePass;
    var allOk = passed === total && wiring.ok;

    if (summary) {
      summary.innerHTML = allOk
        ? '<p class="wire-ok" style="font-size:1.1rem;font-weight:700">✓ All systems online (' + passed + '/' + total + ')</p>' +
          '<p class="muted" style="margin-top:.5rem"><a href="dashboard.html">Go to Pro dashboard →</a></p>'
        : '<p class="wire-fail" style="font-size:1.1rem;font-weight:700">✗ Some checks failed (' + passed + '/' + total + ')</p>' +
          '<p class="muted" style="margin-top:.5rem">Run <strong>START-LIVE-WEBSITE.bat</strong>, then <a href="dashboard.html">dashboard</a></p>';
    }

    if (serverEl && manifest) {
      serverEl.innerHTML = '<h3 style="color:var(--gold);margin-bottom:.5rem">Server</h3>' +
        '<table class="inst-table"><tr><th>Field</th><th>Value</th></tr>' +
        '<tr><td>Name</td><td>' + esc(manifest.server) + '</td></tr>' +
        '<tr><td>Node</td><td>' + esc(manifest.nodeVersion) + '</td></tr>' +
        '<tr><td>Port</td><td>' + esc(manifest.port) + '</td></tr>' +
        '<tr><td>Uptime</td><td>' + esc(manifest.uptimeSeconds) + 's</td></tr>' +
        '<tr><td>Mood</td><td>' + esc(manifest.mood) + '</td></tr>' +
        '</table>';
    }

    if (apisEl) {
      apisEl.innerHTML = '<h3 style="color:var(--gold);margin-bottom:.5rem">APIs (' + apiPass + '/' + apiPaths.length + ')</h3>' +
        '<table class="inst-table inst-table-compact"><tr><th>Service</th><th>Status</th><th>Detail</th><th>Time</th></tr>' + apiRows + '</table>';
    }

    if (pagesEl) {
      pagesEl.innerHTML = '<h3 style="color:var(--gold);margin-bottom:.5rem">Pages (' + pagePass + '/' + pageFiles.length + ')</h3>' +
        '<table class="inst-table inst-table-compact"><tr><th>Page</th><th>Status</th><th>Detail</th><th>Time</th></tr>' + pageRows + '</table>';
    }

    if (modsEl) {
      modsEl.innerHTML = '<h3 style="color:var(--gold);margin-bottom:.5rem">Client</h3>' +
        '<table class="inst-table inst-table-compact"><tr><th>Check</th><th>Status</th><th>Detail</th><th>Time</th></tr>' + modRows + '</table>';
    }
  }

  document.getElementById('btnRetest')?.addEventListener('click', runTests);
  runTests();
  setInterval(runTests, 10000);
})();
