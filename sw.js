/* Lumi Service Worker：缓存主页，添加到主屏幕后可离线打开 */
var CACHE = "lumi-v3";
var ASSETS = ["./", "./index.html", "./icon.svg", "./icon-180.png", "./icon-192.png", "./icon-512.png", "./manifest.webmanifest"];

self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS).catch(function () {}); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* 网络优先，失败回缓存：保证更新及时，离线也能用 */
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;      // 跨源（模型 API）不拦
  if (url.pathname.indexOf("/api/") === 0) return;      // 云函数中转不缓存
  e.respondWith(
    fetch(e.request).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      return res;
    }).catch(function () { return caches.match(e.request).then(function (r) { return r || caches.match("./index.html"); }); })
  );
});
