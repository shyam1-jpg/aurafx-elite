'use strict';

var CACHE = 'aurafx-shell-v1';
var SHELL = [
  '/',
  '/index.html',
  '/css/platform.css',
  '/js/platform-home.js',
  '/js/pwa.js',
  '/manifest.webmanifest',
  '/assets/aurafx-elite-logo.png',
  '/assets/aura-icon-192.png',
  '/assets/aura-icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return Promise.all(SHELL.map(function (url) {
        return cache.add(url).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) { return key !== CACHE; }).map(function (key) {
        return caches.delete(key);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (error) { return; }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf('/api/') === 0) {
    event.respondWith(fetch(req));
    return;
  }
  var accept = req.headers.get('accept') || '';
  if (req.mode === 'navigate' || accept.indexOf('text/html') !== -1) {
    event.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (cache) { return cache.put(req, copy); }).catch(function () {});
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) { return hit || caches.match('/index.html'); });
      })
    );
    return;
  }
  event.respondWith(
    fetch(req).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (cache) { return cache.put(req, copy); }).catch(function () {});
      return res;
    }).catch(function () { return caches.match(req); })
  );
});
