"use client"

import { useEffect } from 'react'
import { usePremium } from '@/lib/contexts/PremiumContext'

export default function AggressiveAdBlocker() {
  const { isPremium, isLoading } = usePremium()

  useEffect(() => {
    if (!isPremium || isLoading) return

    // Function to remove specific Monetag ad elements from DOM
    const removeAdElements = () => {
      let removedCount = 0
      
      // Look for specific Monetag popup patterns
      const specificSelectors = [
        // Monetag specific patterns
        'div[style*="position: fixed"][style*="z-index"]',
        'div[style*="position: absolute"][style*="z-index"]',
        '[data-zone="165368"]', // Your specific ad zone
        'iframe[src*="monetag"]',
        'iframe[src*="fpyf8"]',
        'script[src*="fpyf8"]',
        'script[src*="monetag"]'
      ]
      
      specificSelectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector)
          elements.forEach(element => {
            // Additional verification - only remove if it contains monetag content or specific ad patterns
            const innerHTML = element.innerHTML || ''
            const outerHTML = element.outerHTML || ''
            
            const isMonetag = innerHTML.includes('monetag') || 
                             innerHTML.includes('fpyf8') ||
                             innerHTML.includes('trade bonus') ||
                             innerHTML.includes('You received trade') ||
                             outerHTML.includes('data-zone="165368"')
            
            // Only remove if we're confident it's a Monetag ad
            if (isMonetag || 
                (element.tagName === 'SCRIPT' && (
                  element.getAttribute('src')?.includes('fpyf8') ||
                  element.getAttribute('src')?.includes('monetag')
                ))) {
              element.remove()
              removedCount++
              console.log('Removed specific Monetag ad element:', element.tagName, element.className || element.id)
            }
          })
        } catch (error) {
          // Ignore selector errors
        }
      })

      // Also look for specific text patterns that indicate Monetag ads
      const textElements = document.querySelectorAll('div, span')
      textElements.forEach(element => {
        const text = element.textContent?.toLowerCase() || ''
        if ((text.includes('trade bonus') || 
             text.includes('you received trade') ||
             text.includes('you have (1) new message')) &&
            element.style.position === 'fixed') {
          element.remove()
          removedCount++
          console.log('Removed Monetag popup with text:', text.substring(0, 50))
        }
      })

      if (removedCount > 0) {
        console.log(`Removed ${removedCount} specific Monetag ad elements`)
      }
    }

    // Remove ads immediately
    removeAdElements()

    // Set up mutation observer to catch dynamically added ads
    const observer = new MutationObserver((mutations) => {
      let shouldCheck = false
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          shouldCheck = true
        }
      })
      
      if (shouldCheck) {
        setTimeout(removeAdElements, 100) // Small delay to let elements render
      }
    })

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true
    })

    // Also check periodically (in case mutation observer misses something)
    const interval = setInterval(removeAdElements, 2000)

    // Cleanup
    return () => {
      observer.disconnect()
      clearInterval(interval)
    }
  }, [isPremium, isLoading])

  return null
}
