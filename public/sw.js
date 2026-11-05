// Offline fallback only. API responses and account pages are never cached, so no
// private data can be served from this cache.
const CACHE = "fs-shell-v2"
const LOGO = "/brand/fs-mark-reversed.png"
const SHELL = ["/offline.html", LOGO]

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.mode === "navigate") {
    // A failure while connected is a site or DNS problem, not an offline visitor,
    // so the browser reports it instead of this page claiming there is no internet.
    event.respondWith(
      fetch(request).catch(() => (self.navigator.onLine ? Response.error() : caches.match("/offline.html"))),
    )
    return
  }
  if (new URL(request.url).pathname === LOGO) {
    event.respondWith(fetch(request).catch(() => caches.match(LOGO)))
  }
})
