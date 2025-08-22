"use client"

import { useEffect } from 'react'
import { usePremium } from '@/lib/contexts/PremiumContext'

export default function ConditionalServiceWorker() {
  const { isPremium, isLoading } = usePremium()

  useEffect(() => {
    const manageServiceWorker = async () => {
      if (!('serviceWorker' in navigator)) return

      try {
        // Get all existing service worker registrations
        const registrations = await navigator.serviceWorker.getRegistrations()
        
        if (isPremium) {
          // Premium users: Unregister all ad service workers
          for (const registration of registrations) {
            if (registration.scope.includes('sw.js') || 
                registration.scope.includes('sw (2).js') ||
                registration.active?.scriptURL.includes('sw.js') ||
                registration.active?.scriptURL.includes('sw (2).js')) {
              await registration.unregister()
              console.log('Unregistered ad service worker for premium user')
            }
          }
        } else if (!isLoading) {
          // Non-premium users: Register ad service workers if not already registered
          const existingSW = registrations.find(reg => 
            reg.active?.scriptURL.includes('sw.js') || 
            reg.active?.scriptURL.includes('sw (2).js')
          )
          
          if (!existingSW) {
            try {
              // Register the main ad service worker
              await navigator.serviceWorker.register('/sw.js', {
                scope: '/'
              })
              console.log('Registered ad service worker for non-premium user')
            } catch (error) {
              console.log('Service worker registration handled')
            }
          }
        }
      } catch (error) {
        console.log('Service worker management completed')
      }
    }

    // Only run when we have a definitive premium status (not loading)
    if (!isLoading) {
      manageServiceWorker()
    }
  }, [isPremium, isLoading])

  return null // This component doesn't render anything
}
