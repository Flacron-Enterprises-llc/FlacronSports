// Smart service worker 2 that checks premium status
console.log('Smart service worker 2 loaded');

let isPremium = false;
let isLoading = true;

self.addEventListener('install', function(event) {
  console.log('Smart service worker 2 installed');
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('Smart service worker 2 activated');
  event.waitUntil(self.clients.claim());
});

// Listen for premium status updates from main thread
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'PREMIUM_STATUS_UPDATE') {
    isPremium = event.data.isPremium;
    isLoading = event.data.isLoading;
    console.log('Service worker 2 received premium status:', { isPremium, isLoading });
  }
});

// Check premium status via API
async function checkPremiumStatus() {
  try {
    // Get all clients to check for auth token
    const clients = await self.clients.matchAll();
    if (clients.length > 0) {
      // Ask the main thread for premium status
      clients[0].postMessage({ type: 'REQUEST_PREMIUM_STATUS' });
    }
  } catch (error) {
    console.log('Could not check premium status');
  }
}

// Initial premium status check
checkPremiumStatus();

// Intercept fetch requests
self.addEventListener('fetch', function(event) {
  const url = event.request.url;
  
  // If this is an ad-related request and user is premium, block it
  if ((url.includes('monetag.com') || 
       url.includes('publishers.monetag.com') ||
       url.includes('ads') || 
       url.includes('doubleclick') || 
       url.includes('googlesyndication') ||
       url.includes('fpyf8.com') ||
       url.includes('tag.min.js') ||
       url.includes('antiadblock')) && 
      isPremium && !isLoading) {
    console.log('Blocked Monetag/ad request for premium user (sw2):', url);
    event.respondWith(new Response('', { status: 204 }));
    return;
  }
  
  // For non-premium users or non-ad requests, let them through
  event.respondWith(fetch(event.request));
});
