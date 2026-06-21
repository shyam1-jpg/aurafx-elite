(function () {
  var KEY = 'aurafx_cookie_consent';
  if (localStorage.getItem(KEY)) return;

  var bar = document.createElement('div');
  bar.className = 'cookie-banner';
  bar.setAttribute('role', 'dialog');
  bar.innerHTML =
    'We use essential cookies and local storage for registration and dashboard preferences. ' +
    '<a href="cookies.html">Cookie policy</a> · ' +
    '<a href="privacy.html">Privacy</a> · ' +
    '<button type="button" class="btn btn-gold" id="cookieAcceptBtn" style="padding:.4rem .9rem;font-size:.8rem">Accept</button> · ' +
    '<button type="button" class="btn btn-outline" id="cookieEssentialBtn" style="padding:.4rem .9rem;font-size:.8rem">Essential only</button>';

  document.body.appendChild(bar);
  document.getElementById('cookieAcceptBtn').onclick = function () {
    localStorage.setItem(KEY, 'all');
    bar.classList.add('hidden');
  };
  document.getElementById('cookieEssentialBtn').onclick = function () {
    localStorage.setItem(KEY, 'essential');
    bar.classList.add('hidden');
  };
})();
