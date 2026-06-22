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

  injectBranding();

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
