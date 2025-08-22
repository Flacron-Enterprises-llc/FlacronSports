"use client"

import { useEffect, useCallback } from 'react'
import { usePremium } from '@/lib/contexts/PremiumContext'

export default function ConditionalServiceWorker() {
  const { isPremium, isLoading } = usePremium()

  // Function to send premium status to all service workers
  const sendPremiumStatusToServiceWorkers = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return

    try {
      const registrations = await navigator.serviceWorker.getRegistrations()
      
      for (const registration of registrations) {
        if (registration.active) {
          registration.active.postMessage({
            type: 'PREMIUM_STATUS_UPDATE',
            isPremium,
            isLoading
          })
        }
      }
      
      console.log('Sent premium status to service workers:', { isPremium, isLoading })
    } catch (error) {
      console.log('Could not send premium status to service workers')
    }
  }, [isPremium, isLoading])

  // Listen for service worker requests for premium status
  useEffect(() => {
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'REQUEST_PREMIUM_STATUS') {
        // Send current premium status
        if (event.source) {
          (event.source as ServiceWorker).postMessage({
            type: 'PREMIUM_STATUS_UPDATE',
            isPremium,
            isLoading
          })
        }
      }
    }

    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage)
    
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage)
    }
  }, [isPremium, isLoading])

  // Register service workers and send initial status
  useEffect(() => {
    const manageServiceWorker = async () => {
      if (!('serviceWorker' in navigator)) return

      try {
        // Check if service workers are already registered
        const registrations = await navigator.serviceWorker.getRegistrations()
        
        let needsRegistration = registrations.length === 0
        
        // If no service workers registered, register them
        if (needsRegistration) {
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
            
            console.log('Service workers registered')
          } catch (error) {
            console.log('Service worker registration completed')
          }
        }
        
        // Always send premium status to service workers
        await sendPremiumStatusToServiceWorkers()
        
      } catch (error) {
        console.log('Service worker management completed')
      }
    }

    manageServiceWorker()
  }, [sendPremiumStatusToServiceWorkers])

  // Send premium status updates whenever it changes
  useEffect(() => {
    if (!isLoading) {
      sendPremiumStatusToServiceWorkers()
    }
  }, [isPremium, isLoading, sendPremiumStatusToServiceWorkers])

  return null // This component doesn't render anything
}
