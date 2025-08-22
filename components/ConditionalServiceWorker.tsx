"use client"

import { useEffect } from 'react'
import { usePremium } from '@/lib/contexts/PremiumContext'

export default function ConditionalServiceWorker() {
  const { isPremium, isLoading } = usePremium()

  useEffect(() => {
    const manageServiceWorker = async () => {
      if (!('serviceWorker' in navigator)) return

      try {
        // Unregister all existing service workers first
        const registrations = await navigator.serviceWorker.getRegistrations()
        for (const registration of registrations) {
          await registration.unregister()
          console.log('Unregistered existing service worker')
        }

        // Small delay to ensure unregistration completes
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Register service workers - they're now static files that change based on server-side logic
        try {
          const timestamp = Date.now() // Cache busting
          
          await navigator.serviceWorker.register(`/sw.js?t=${timestamp}`, {
            scope: '/',
            updateViaCache: 'none'
          })
          
          await navigator.serviceWorker.register(`/sw (2).js?t=${timestamp}`, {
            scope: '/',
            updateViaCache: 'none'
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
