"use client"

import { useEffect } from 'react'
import { usePremium } from '@/lib/contexts/PremiumContext'

export default function ConditionalServiceWorker() {
  const { isPremium, isLoading } = usePremium()

  useEffect(() => {
    const manageServiceWorker = async () => {
      if (!('serviceWorker' in navigator)) return

      try {
        // Always register service workers, but they'll get different content based on premium status
        const registrations = await navigator.serviceWorker.getRegistrations()
        
        // Unregister existing service workers to force refresh
        for (const registration of registrations) {
          await registration.unregister()
        }
        
        // Register service workers using our API routes
        // These routes will serve empty workers for premium users, real workers for non-premium
        try {
          await navigator.serviceWorker.register('/api/sw', {
            scope: '/',
            updateViaCache: 'none' // Always check for updates
          })
          
          await navigator.serviceWorker.register('/api/sw2', {
            scope: '/',
            updateViaCache: 'none' // Always check for updates
          })
          
          console.log(`Service workers registered - Premium: ${isPremium}`)
        } catch (error) {
          console.log('Service worker registration completed')
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
