/**
 * AuraFX site boot — API base, logo, favicon, live pill.
 */
(function () {
  var isFile = window.location.protocol === 'file:';
  var isLiveSite = /aurafxelite\.com|onrender\.com/i.test(window.location.hostname || '');
  window.AURAFX_API_BASE = isFile ? '' : '';
  window.AURAFX_IS_FILE_MODE = isFile;
  window.AURAFX_CLIENT_POLL_MS = 1000;
  var LOGO_VER = '7';
  var LOGO = '/assets/aura-icon-140.png?v=' + LOGO_VER;
  var LOGO_WIDE = '/assets/aurafx-elite-logo.png?v=' + LOGO_VER;

  function assetUrl(path) {
    return (window.AURAFX_API_BASE || '') + path;
  }

  function logoFile(path) {
    return path.split('?')[0].replace(/^\//, '');
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
      var existing = el.querySelector('.logo-img');
      if (existing) {
        var want = LOGO_WIDE.replace(/^\//, '');
        if (logoFile(existing.getAttribute('src') || '') !== logoFile(want)) {
          existing.src = src;
        }
        if (!existing.classList.contains('logo-img')) existing.className = 'logo-img';
        return;
      }
      var img = document.createElement('img');
      img.src = src;
      img.alt = 'AuraFX Elite logo';
      img.className = 'logo-img';
      img.width = 160;
      img.height = 160;
      img.decoding = 'sync';
      el.setAttribute('aria-label', 'AuraFX Elite home');
      while (el.firstChild) el.removeChild(el.firstChild);
      el.appendChild(img);
    });
  }

  function upgradeHeroLogos() {
    var png = assetUrl(LOGO_WIDE);
    document.querySelectorAll('.hero-logo, img[src*="aura-logo-hero"], img[src*="aurafx-elite-logo"]').forEach(function (img) {
      if (img.closest('.dash-sidebar-brand') || img.classList.contains('logo-img')) return;
      var src = img.getAttribute('src') || '';
      if (/aura-logo-hero\.svg/i.test(src) || /aurafx-elite-logo\.png/i.test(src)) {
        img.src = png;
        img.classList.add('hero-logo');
        img.removeAttribute('style');
        if (!img.parentElement || !img.parentElement.classList.contains('hero-logo-wrap')) {
          var wrap = document.createElement('div');
          wrap.className = 'hero-logo-wrap';
          img.parentNode.insertBefore(wrap, img);
          wrap.appendChild(img);
        }
      }
    });
  }

  function syncStylesheets() {
    document.querySelectorAll('link[rel="stylesheet"]').forEach(function (link) {
      var href = link.getAttribute('href') || '';
      if (/css\/site\.css/i.test(href) && !/v=10/.test(href)) {
        link.setAttribute('href', 'css/site.css?v=10');
      }
      if (/css\/pro-dashboard\.css/i.test(href) && !/v=10/.test(href)) {
        link.setAttribute('href', 'css/pro-dashboard.css?v=10');
      }
    });
  }

  syncStylesheets();
  injectBranding();
  upgradeHeroLogos();

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
