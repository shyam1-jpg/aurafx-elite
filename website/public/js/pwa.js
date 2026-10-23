(function () {
  var deferred = null;

  document.addEventListener('click', function (event) {
    var toggle = event.target.closest('[data-nav-toggle]');
    if (toggle) {
      var links = document.getElementById('pfNavLinks');
      if (!links) return;
      var open = links.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      return;
    }
    var install = event.target.closest('[data-pwa-install]');
    if (!install) return;
    var status = document.getElementById('installStatus');
    if (deferred) {
      deferred.prompt();
      deferred.userChoice.finally(function () { deferred = null; });
      return;
    }
    if (status) status.textContent = 'Use the browser menu and choose Install app or Add to Home Screen. The install prompt appears when the browser allows it.';
  });

  window.addEventListener('beforeinstallprompt', function (event) {
    if (!document.querySelector('[data-pwa-install]')) return;
    event.preventDefault();
    deferred = event;
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  }
})();
