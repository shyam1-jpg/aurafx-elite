/**
 * AuraFX site boot — API base, logo, favicon, file:// banner, live pill.
 */
(function () {
  var isFile = window.location.protocol === 'file:';
  window.AURAFX_API_BASE = isFile ? 'http://127.0.0.1:3847' : '';
  var LOGO = '/assets/aura-icon-140.png';

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
    var src = assetUrl(LOGO);
    document.querySelectorAll('.logo, .nav-logo').forEach(function (el) {
      if (el.querySelector('.logo-img')) return;
      var img = document.createElement('img');
      img.src = src;
      img.alt = 'AuraFX Elite logo';
      img.className = 'logo-img';
      img.width = 36;
      img.height = 36;
      el.insertBefore(img, el.firstChild);
    });
  }

  injectBranding();

  if (isFile) {
    var banner = document.getElementById('fileModeBanner');
    if (banner) {
      banner.classList.remove('hidden');
      banner.innerHTML =
        'Opened as a file — links may not work. Run <strong>START-LIVE-WEBSITE.bat</strong>, then use ' +
        '<a href="http://127.0.0.1:3847/index.html">http://127.0.0.1:3847/</a>';
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
      var nextEv = d.nextEvent && d.nextEvent.title ? d.nextEvent.title : (d.nextEvent || '');
      pill.innerHTML =
        '<span class="dot"></span> LIVE' + goldLine + ' · Mood: ' + (d.mood || '—') +
        (nextEv ? ' · Next: ' + nextEv : '');
      var dn = document.getElementById('domainNote');
      if (dn && window.location.hostname.indexOf('aurafxelite.com') >= 0) dn.classList.remove('hidden');
    } catch (e) {
      pill.textContent = isFile
        ? 'Start START-LIVE-WEBSITE.bat for live buttons & API'
        : 'Market feed loading — refresh in a few seconds';
      pill.style.borderColor = '#e67e22';
      pill.style.color = '#e67e22';
    }
  })();
})();
