/**
 * AuraFX site boot — API base, logo, favicon, live pill.
 */
(function () {
  var isFile = window.location.protocol === 'file:';
  var isLiveSite = /aurafxelite\.com|onrender\.com/i.test(window.location.hostname || '');
  window.AURAFX_API_BASE = isFile ? '' : '';
  window.AURAFX_IS_FILE_MODE = isFile;
  var LOGO = '/assets/aurafx-elite-logo.png';
  var LOGO_WIDE = '/assets/aurafx-elite-logo.png';

  function assetUrl(path) {
    return (window.AURAFX_API_BASE || '') + path;
  }

  function injectBranding() {
    if (!document.querySelector('link[data-aurafx-icon]')) {
      var link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/png';
      link.href = assetUrl(LOGO);
      link.setAttribute('data-aurafx-icon', '1');
      document.head.appendChild(link);
    }
    var src = assetUrl(LOGO_WIDE);
    document.querySelectorAll('.logo, .nav-logo, .dash-sidebar-brand a').forEach(function (el) {
      if (el.querySelector('.logo-img')) return;
      var img = document.createElement('img');
      img.src = src;
      img.alt = 'AuraFX Elite logo';
      img.className = 'logo-img';
      el.setAttribute('aria-label', 'AuraFX Elite home');
      el.insertBefore(img, el.firstChild);
    });
  }

  function injectTestingBanner() {
    fetch(window.AURAFX_API_BASE + '/api/testing/status', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (st) {
        if (!st.testingMode) return;
        window.AURAFX_TESTING_MODE = true;
        window.AURAFX_PREVIEW_ACCESS = !!st.previewAccess;
        var bar = document.createElement('div');
        bar.setAttribute('role', 'status');
        bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9998;background:#5c3d0a;color:#fff;text-align:center;padding:.55rem .75rem;font-size:.82rem;border-bottom:2px solid #d4af37';
        bar.innerHTML = st.previewAccess
          ? 'Owner testing mode — you have full access. Public users are blocked.'
          : 'Private testing — registration &amp; MT5 tools are not public yet. <a href="/private-testing.html" style="color:#fff;font-weight:700">Owner unlock</a>';
        document.body.prepend(bar);
        document.body.style.paddingTop = '2.4rem';
      })
      .catch(function () {});
  }

  injectBranding();
  injectTestingBanner();

  if (isFile) {
    var banner = document.getElementById('fileModeBanner');
    if (banner) {
      banner.classList.remove('hidden');
      banner.textContent = 'This page was opened from your computer. For full features, visit https://aurafxelite.com';
    }
  }

  var pill = document.getElementById('livePill');
  if (!pill) return;

  (async function () {
    try {
      var statusR = await fetch(window.AURAFX_API_BASE + '/api/status', { cache: 'no-store' });
      var d = await statusR.json();
      var goldLine = '';
      try {
        var quotesR = await fetch(window.AURAFX_API_BASE + '/api/quotes', { cache: 'no-store' });
        if (quotesR.ok) {
          var q = await quotesR.json();
          if (q.metals && q.metals.XAUUSD) {
            goldLine = ' · Gold $' + Number(q.metals.XAUUSD).toFixed(1);
          }
        }
      } catch (_) { /* quotes optional */ }
      pill.className = 'live-pill online';
      var nextEv = d.nextEvent && d.nextEvent.title ? d.nextEvent.title : '';
      pill.innerHTML =
        '<span class="dot"></span> Live data' + goldLine + ' · Mood: ' + (d.mood || '—') +
        (nextEv ? ' · Next: ' + nextEv : '');
    } catch (e) {
      pill.textContent = isLiveSite
        ? 'Market feed loading — please refresh shortly'
        : 'Connect to aurafxelite.com for live market data';
      pill.style.borderColor = '#e67e22';
      pill.style.color = '#e67e22';
    }
  })();
})();
