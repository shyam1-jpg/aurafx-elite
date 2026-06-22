(function () {
  var KEY = 'aurafx_cookie_consent';
  var existing = null;
  try { existing = localStorage.getItem(KEY); } catch (_) { /* ignore */ }

  function applyConsent(level) {
    if (level === 'all' && window.AURAFX_loadFonts) {
      window.AURAFX_loadFonts();
    }
    document.dispatchEvent(new CustomEvent('aurafx:consent', { detail: { level: level } }));
  }

  if (existing) {
    applyConsent(existing);
    return;
  }

  var bar = document.createElement('div');
  bar.className = 'cookie-banner';
  bar.setAttribute('role', 'dialog');
  bar.setAttribute('aria-label', 'Cookie consent');
  bar.innerHTML =
    '<p>We use essential storage for registration and your consent choice. Optional fonts load from Google if you accept all cookies. ' +
    '<a href="cookies.html">Cookie policy</a> · <a href="privacy.html">Privacy</a></p>' +
    '<div class="cookie-banner-actions">' +
    '<button type="button" class="btn btn-gold" id="cookieAcceptBtn">Accept all</button>' +
    '<button type="button" class="btn btn-outline" id="cookieEssentialBtn">Essential only</button>' +
    '</div>';

  document.body.appendChild(bar);
  document.getElementById('cookieAcceptBtn').onclick = function () {
    localStorage.setItem(KEY, 'all');
    bar.classList.add('hidden');
    applyConsent('all');
  };
  document.getElementById('cookieEssentialBtn').onclick = function () {
    localStorage.setItem(KEY, 'essential');
    bar.classList.add('hidden');
    applyConsent('essential');
  };
})();
