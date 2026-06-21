/**
 * Live quotes client — fetches from AuraFX /api/quotes (server aggregates Yahoo + CoinGecko).
 */
(function () {
  var API = window.AURAFX_API_BASE || '';

  window.AURAFX_LIVE_QUOTES = {
    loaded: false,
    live: false,
    source: 'loading',
    updatedAt: null,
    refreshSeconds: 30,
    forex: {},
    metals: {},
    crypto: {},
    changes: {}
  };

  function applyPayload(d) {
    if (!d) return;
    window.AURAFX_LIVE_QUOTES.loaded = true;
    window.AURAFX_LIVE_QUOTES.live = !!d.live;
    window.AURAFX_LIVE_QUOTES.source = d.source || 'AuraFX server';
    window.AURAFX_LIVE_QUOTES.updatedAt = d.updatedAt || new Date().toISOString();
    window.AURAFX_LIVE_QUOTES.refreshSeconds = d.refreshSeconds || 30;
    window.AURAFX_LIVE_QUOTES.forex = d.forex || {};
    window.AURAFX_LIVE_QUOTES.metals = d.metals || {};
    window.AURAFX_LIVE_QUOTES.crypto = d.crypto || {};
    window.AURAFX_LIVE_QUOTES.changes = d.changes || {};
    document.dispatchEvent(new CustomEvent('aurafx-quotes-updated'));
  }

  async function fetchFromServer() {
    try {
      var r = await fetch(API + '/api/quotes', { cache: 'no-store' });
      if (!r.ok) return false;
      applyPayload(await r.json());
      return true;
    } catch (e) {
      return false;
    }
  }

  window.AURAFX_refreshLiveQuotes = async function () {
    var ok = await fetchFromServer();
    if (!ok) {
      window.AURAFX_LIVE_QUOTES.source = 'Offline — restart START-LIVE-WEBSITE.bat';
      window.AURAFX_LIVE_QUOTES.live = false;
      document.dispatchEvent(new CustomEvent('aurafx-quotes-updated'));
    }
    return window.AURAFX_LIVE_QUOTES;
  };

  window.AURAFX_refreshLiveQuotes();
  setInterval(function () { window.AURAFX_refreshLiveQuotes(); }, 30000);
})();
