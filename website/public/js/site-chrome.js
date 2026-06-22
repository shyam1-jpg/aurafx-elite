/**
 * AuraFX site chrome — mega footer + nav dropdown on all pages that include this script.
 */
(function () {
  var FOOTER_LINKS = {
    Platform: [
      { href: 'dashboard.html', label: 'Pro dashboard' },
      { href: 'markets.html', label: 'Live markets' },
      { href: 'economic-calendar.html', label: 'Economic calendar' },
      { href: 'symbols.html', label: 'Symbols & instruments' },
      { href: 'market-hours.html', label: 'Market hours' }
    ],
    Products: [
      { href: 'products.html', label: 'Product line' },
      { href: 'mt5-install.html', label: 'MT5 install' },
      { href: 'mt5-upload.html', label: 'Publish on MQL5' },
      { href: 'get-started.html', label: 'Register & trade guide' }
    ],
    Learn: [
      { href: 'learn.html', label: 'Learning center' },
      { href: 'methodology.html', label: 'Analysis methodology' },
      { href: 'how-it-works.html', label: 'How it works' },
      { href: 'faq.html', label: 'FAQ' }
    ],
    Company: [
      { href: 'about.html', label: 'About' },
      { href: 'support.html', label: 'Support' },
      { href: 'roadmap.html', label: 'Roadmap' },
      { href: 'resources.html', label: 'All resources' }
    ],
    Legal: [
      { href: 'terms.html', label: 'Terms' },
      { href: 'privacy.html', label: 'Privacy' },
      { href: 'risk-warning.html', label: 'Risk warning' },
      { href: 'regulatory.html', label: 'Regulatory' },
      { href: 'refunds.html', label: 'Refunds' },
      { href: 'cookies.html', label: 'Cookies' }
    ]
  };

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  }

  function renderMegaFooter() {
    var foot = document.querySelector('footer.footer');
    if (!foot || foot.dataset.chromeDone) return;
    foot.dataset.chromeDone = '1';
    foot.classList.add('hub-mega-footer');

    var cols = Object.keys(FOOTER_LINKS).map(function (title) {
      var links = FOOTER_LINKS[title].map(function (l) {
        return '<a href="' + esc(l.href) + '">' + esc(l.label) + '</a>';
      }).join('');
      return '<div class="hub-footer-col"><h4>' + esc(title) + '</h4>' + links + '</div>';
    }).join('');

    foot.innerHTML =
      '<div class="hub-footer-grid">' + cols + '</div>' +
      '<div class="hub-footer-bottom">' +
      '<p>© 2026 AuraFX Elite · Shyam Prasad t/a AuraFX Elite · UK</p>' +
      '<p style="margin-top:.35rem">Educational software only · Not FCA-authorised · Not financial advice</p>' +
      '<p style="margin-top:.35rem">Past performance is not indicative of future results · You trade with your own broker</p>' +
      '<p style="margin-top:.5rem"><a href="register.html">Register</a> · ' +
      '<a href="mailto:support@aurafxelite.com">support@aurafxelite.com</a></p></div>';
  }

  function injectNavDropdown() {
    var nav = document.querySelector('.nav-links');
    if (!nav || nav.querySelector('.nav-dropdown')) return;
    var first = nav.firstChild;
    var dd = document.createElement('details');
    dd.className = 'nav-dropdown';
    dd.innerHTML =
      '<summary>Explore</summary>' +
      '<div class="nav-dropdown-menu">' +
      '<a href="resources.html">All resources</a>' +
      '<a href="learn.html">Learning center</a>' +
      '<a href="symbols.html">Symbols</a>' +
      '<a href="market-hours.html">Market hours</a>' +
      '<a href="methodology.html">Methodology</a>' +
      '<a href="economic-calendar.html">Calendar</a>' +
      '</div>';
    if (first) nav.insertBefore(dd, first);
    else nav.appendChild(dd);
  }

  function init() {
    renderMegaFooter();
    injectNavDropdown();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
