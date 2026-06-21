/**
 * AuraFX Lite — signal preview page (hard-sell.html / aura-lite.html).
 */
(function () {
  var API = window.AURAFX_API_BASE || '';
  var symbols = ['XAUUSD · GOLD', 'EURUSD · FOREX', 'GBPUSD · FOREX'];
  var symIdx = 0;

  function setSignal(kind) {
    var el = document.getElementById('liteSignal');
    if (!el) return;
    var labels = { buy: 'BUY', sell: 'SELL', cover: 'COVER' };
    el.textContent = 'Signal: ' + (labels[kind] || 'SELL');
    el.className = 'lite-panel-row lite-signal ' + (kind || 'sell');
    document.querySelectorAll('.lite-sig-btns button').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-sig') === kind);
    });
  }

  document.querySelectorAll('.lite-sig-btns button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      setSignal(btn.getAttribute('data-sig'));
    });
  });

  async function loadMood() {
    var moodEl = document.getElementById('liteMood');
    try {
      var r = await fetch(API + '/api/pro-summary', { cache: 'no-store' });
      var d = await r.json();
      if (moodEl) {
        moodEl.textContent =
          'Live mood: ' + (d.mood || '—') +
          ' · Session: ' + (d.session || '—') +
          ' · AI score ' + (d.score != null ? d.score : '—') + '/100';
      }
      var pill = document.getElementById('livePill');
      if (pill && pill.classList.contains('online')) {
        pill.innerHTML =
          '<span class="dot"></span> LIVE preview · Mood ' + (d.mood || '—');
      }
    } catch (e) {
      if (moodEl) moodEl.textContent = 'Start START-LIVE-WEBSITE.bat for live mood data.';
    }
  }

  setInterval(function () {
    symIdx = (symIdx + 1) % symbols.length;
    var sym = document.getElementById('liteSymbol');
    if (sym) sym.textContent = symbols[symIdx];
  }, 8000);

  loadMood();
  setInterval(loadMood, 30000);
})();
