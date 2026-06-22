/**
 * Loads Google Fonts only when the user accepts non-essential cookies.
 */
(function () {
  var KEY = 'aurafx_cookie_consent';
  var consent = null;
  try { consent = localStorage.getItem(KEY); } catch (_) { /* ignore */ }

  function loadFonts() {
    if (document.querySelector('link[data-aurafx-fonts]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
    link.setAttribute('data-aurafx-fonts', '1');
    document.head.appendChild(link);
  }

  if (consent === 'all') {
    loadFonts();
  }

  window.AURAFX_loadFonts = loadFonts;
})();
