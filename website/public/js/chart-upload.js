/* Chart image upload for dashboard.html. Standalone so errors in other dashboard scripts can't stop it. */
(function () {
  'use strict';
  var IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
  var IMAGE_EXT = /\.(png|jpe?g|webp)$/i;
  var HEIC_TYPES = ['image/heic', 'image/heif'];
  var HEIC_EXT = /\.(heic|heif)$/i;
  var HEIC_LIB = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';
  var heicLoader = null;

  function loadHeicLib() {
    if (window.heic2any) return Promise.resolve(window.heic2any);
    if (heicLoader) return heicLoader;
    heicLoader = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = HEIC_LIB;
      s.async = true;
      s.onload = function () { window.heic2any ? resolve(window.heic2any) : reject(new Error('HEIC converter unavailable')); };
      s.onerror = function () { heicLoader = null; reject(new Error('HEIC converter failed to load')); };
      document.head.appendChild(s);
    });
    return heicLoader;
  }

  function drawZones(img, c, out) {
    var ctx = c.getContext('2d');
    c.width = Math.min(800, img.width);
    c.height = Math.min(450, img.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    var w = c.width, h = c.height;
    ctx.strokeStyle = '#2ecc71';
    ctx.strokeRect(w * 0.1, h * 0.7, w * 0.8, h * 0.05);
    ctx.strokeStyle = '#e74c3c';
    ctx.strokeRect(w * 0.1, h * 0.15, w * 0.8, h * 0.05);
    if (out) out.textContent = 'Preview loaded — illustrative zones drawn (not financial advice).';
  }

  function showBlob(blob, input, c, out) {
    var url = URL.createObjectURL(blob);
    var img = new Image();
    img.onload = function () { if (c) drawZones(img, c, out); URL.revokeObjectURL(url); };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      if (out) out.textContent = 'Could not read that image — try another PNG, JPG, WebP or HEIC file.';
      input.value = '';
    };
    img.src = url;
  }

  function init() {
    var input = document.getElementById('chartUpload');
    if (!input || input.dataset.uploadBound) return;
    input.dataset.uploadBound = '1';
    input.addEventListener('change', function (ev) {
      var file = ev.target.files && ev.target.files[0];
      var out = document.getElementById('screenshotAnalysis');
      var c = document.getElementById('chartCanvas');
      if (!file) return;
      var isHeic = HEIC_TYPES.indexOf(file.type) !== -1 || HEIC_EXT.test(file.name);
      var isImage = IMAGE_TYPES.indexOf(file.type) !== -1 || IMAGE_EXT.test(file.name);
      if (!isHeic && !isImage) {
        if (out) out.textContent = 'Please upload a PNG, JPG, WebP or HEIC image.';
        input.value = '';
        return;
      }
      if (!isHeic) return showBlob(file, input, c, out);
      if (out) out.textContent = 'Converting HEIC photo…';
      loadHeicLib()
        .then(function (convert) { return convert({ blob: file, toType: 'image/jpeg', quality: 0.9 }); })
        .then(function (res) { showBlob(Array.isArray(res) ? res[0] : res, input, c, out); })
        .catch(function () { showBlob(file, input, c, out); }); // Safari can decode HEIC natively
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
