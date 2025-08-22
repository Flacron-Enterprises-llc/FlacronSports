// Empty service worker 2 for premium users
console.log('Premium user service worker 2 - ads disabled');

self.addEventListener('install', function(event) {
  console.log('Empty service worker 2 installed for premium user');
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('Empty service worker 2 activated for premium user');
  event.waitUntil(self.clients.claim());
});

// Block any fetch requests that might be ad-related
self.addEventListener('fetch', function(event) {
  const url = event.request.url;
  if (url.includes('ads') || 
      url.includes('doubleclick') || 
      url.includes('googlesyndication') ||
      url.includes('fpyf8.com') ||
      url.includes('tag.min.js')) {
    console.log('Blocked ad request (sw2):', url);
    event.respondWith(new Response('', { status: 204 }));
    return;
  }
  // Let other requests pass through normally
  event.respondWith(fetch(event.request));
});
