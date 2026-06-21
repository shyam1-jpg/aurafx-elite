/**
 * AuraFX site boot — API base, logo, favicon, file:// banner, live pill.
 */
(function () {
  var isFile = window.location.protocol === 'file:';
  window.AURAFX_API_BASE = isFile ? 'http://127.0.0.1:3847' : '';

  function assetUrl(path) {
    return (window.AURAFX_API_BASE || '') + path;
  }

  function injectBranding() {
    if (!document.querySelector('link[data-aurafx-icon]')) {
      var link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/svg+xml';
      link.href = assetUrl('/assets/aura-logo.svg');
      link.setAttribute('data-aurafx-icon', '1');
      document.head.appendChild(link);
    }
    var src = assetUrl('/assets/aura-logo.svg');
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
      var r = await fetch(window.AURAFX_API_BASE + '/api/status');
      var d = await r.json();
      pill.className = 'live-pill online';
      pill.innerHTML =
        '<span class="dot"></span> LIVE — Mood: ' + d.mood +
        (d.nextEvent ? ' · Next: ' + d.nextEvent : '');
      var dn = document.getElementById('domainNote');
      if (dn && window.location.hostname === 'aurafxelite.com') dn.classList.remove('hidden');
    } catch (e) {
      pill.textContent = isFile
        ? 'Start START-LIVE-WEBSITE.bat for live buttons & API'
        : 'Start server: node website/simple-server.js';
      pill.style.borderColor = '#e67e22';
      pill.style.color = '#e67e22';
    }
  })();
})();
