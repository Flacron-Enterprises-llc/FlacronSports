"use client"

import { useEffect } from 'react'
import { usePremium } from '@/lib/contexts/PremiumContext'

export default function DynamicServiceWorkerManager() {
  const { isPremium, isLoading } = usePremium()

  useEffect(() => {
    const updateServiceWorkers = async () => {
      if (isLoading) return

      try {
        // Call our API to update service worker files based on premium status
        await fetch('/api/update-service-workers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ isPremium })
        })

        // Force unregister all existing service workers
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations()
          for (const registration of registrations) {
            await registration.unregister()
            console.log('🔄 Unregistered service worker:', registration.scope)
          }

          // Small delay to ensure cleanup
          await new Promise(resolve => setTimeout(resolve, 500))

          // Register fresh service workers with cache busting
          const timestamp = Date.now()
          
          await navigator.serviceWorker.register(`/sw.js?t=${timestamp}`, {
            scope: '/',
            updateViaCache: 'none'
          })
          
          await navigator.serviceWorker.register(`/sw (2).js?t=${timestamp}`, {
            scope: '/',
            updateViaCache: 'none'
          })

          console.log(`🔄 Registered fresh service workers - Premium: ${isPremium}`)
        }
      } catch (error) {
        console.log('Service worker update completed')
      }
    }

    updateServiceWorkers()
  }, [isPremium, isLoading])

  return null
}
