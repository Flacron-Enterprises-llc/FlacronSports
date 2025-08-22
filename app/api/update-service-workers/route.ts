import { NextRequest, NextResponse } from 'next/server'
import { writeFileSync, readFileSync } from 'fs'
import { join } from 'path'

export async function POST(request: NextRequest) {
  try {
    const { isPremium } = await request.json()
    
    const publicDir = join(process.cwd(), 'public')
    const swPath = join(publicDir, 'sw.js')
    const sw2Path = join(publicDir, 'sw (2).js')
    const swOriginalPath = join(publicDir, 'sw-original.js')
    const sw2OriginalPath = join(publicDir, 'sw2-original.js')

    if (isPremium) {
      // Premium users get completely empty service workers
      const emptyServiceWorker = `
// Empty service worker for premium users
console.log('🛡️ Premium user - ads completely disabled');

self.addEventListener('install', function(event) {
  console.log('🛡️ Empty service worker installed for premium user');
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('🛡️ Empty service worker activated for premium user');
  event.waitUntil(self.clients.claim());
});

// Don't intercept any requests - let everything pass through normally
self.addEventListener('fetch', function(event) {
  // Just let all requests pass through without interception
});
`

      writeFileSync(swPath, emptyServiceWorker)
      writeFileSync(sw2Path, emptyServiceWorker.replace('Empty service worker', 'Empty service worker 2'))
      
      console.log('✅ Service workers set to empty for premium user')
      
    } else {
      // Non-premium users get the original Monetag service workers
      try {
        const originalSW = readFileSync(swOriginalPath, 'utf8')
        const originalSW2 = readFileSync(sw2OriginalPath, 'utf8')
        
        writeFileSync(swPath, originalSW)
        writeFileSync(sw2Path, originalSW2)
        
        console.log('✅ Service workers set to original for non-premium user')
      } catch (error) {
        console.error('Error reading original service workers:', error)
        return NextResponse.json({ error: 'Could not read original service workers' }, { status: 500 })
      }
    }

    return NextResponse.json({ 
      success: true, 
      isPremium,
      message: `Service workers updated for ${isPremium ? 'premium' : 'non-premium'} user`
    })

  } catch (error) {
    console.error('Error updating service workers:', error)
    return NextResponse.json({ error: 'Failed to update service workers' }, { status: 500 })
  }
}
