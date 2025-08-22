import { writeFileSync, readFileSync } from 'fs'
import { join } from 'path'

const SW_PATH = join(process.cwd(), 'public', 'sw.js')
const SW2_PATH = join(process.cwd(), 'public', 'sw (2).js')
const SW_ORIGINAL_PATH = join(process.cwd(), 'public', 'sw-original.js')
const SW2_ORIGINAL_PATH = join(process.cwd(), 'public', 'sw2-original.js')

const EMPTY_SW = `// Empty service worker for premium users
console.log('Premium user service worker - ads disabled');

self.addEventListener('install', function(event) {
  console.log('Empty service worker installed for premium user');
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('Empty service worker activated for premium user');
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
    console.log('Blocked ad request:', url);
    event.respondWith(new Response('', { status: 204 }));
    return;
  }
  // Let other requests pass through normally
  event.respondWith(fetch(event.request));
});`

const EMPTY_SW2 = `// Empty service worker 2 for premium users
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
});`

export function setServiceWorkersForPremium() {
  try {
    writeFileSync(SW_PATH, EMPTY_SW)
    writeFileSync(SW2_PATH, EMPTY_SW2)
    console.log('Service workers set to empty for premium users')
  } catch (error) {
    console.error('Error setting empty service workers:', error)
  }
}

export function setServiceWorkersForNonPremium() {
  try {
    const originalSW = readFileSync(SW_ORIGINAL_PATH, 'utf8')
    const originalSW2 = readFileSync(SW2_ORIGINAL_PATH, 'utf8')
    
    writeFileSync(SW_PATH, originalSW)
    writeFileSync(SW2_PATH, originalSW2)
    console.log('Service workers set to original for non-premium users')
  } catch (error) {
    console.error('Error setting original service workers:', error)
  }
}
