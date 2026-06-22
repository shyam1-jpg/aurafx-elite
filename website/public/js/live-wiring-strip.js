/**
 * Compact live wiring indicator on Pro dashboard header.
 */
(function () {
  var strip = document.getElementById('aurafxWiringStrip');
  if (!strip) return;

  var API = window.AURAFX_API_BASE || '';

  async function update() {
    try {
      var t0 = performance.now();
      var r = await fetch(API + '/api/wiring', { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var d = await r.json();
      var ms = Math.round(performance.now() - t0);
      strip.className = 'wiring-strip wiring-strip-ok';
      strip.innerHTML =
        '● Node LIVE · ' + (d.apis ? d.apis.length : 7) + ' APIs · mood: ' + (d.mood || '—') +
        ' · ' + ms + 'ms · <a href="live-wiring.html">Full wiring test →</a>';
    } catch (e) {
      strip.className = 'wiring-strip wiring-strip-fail';
      strip.innerHTML =
        '○ Server offline — <a href="https://aurafxelite.com">Visit live site</a>';
    }
  }

  update();
  setInterval(update, 15000);
})();
