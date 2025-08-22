"use client"

import { useEffect } from 'react'
import { usePremium } from '@/lib/contexts/PremiumContext'

export default function AggressiveAdBlocker() {
  const { isPremium, isLoading } = usePremium()

  useEffect(() => {
    if (!isPremium || isLoading) return

    // Function to remove ad elements from DOM
    const removeAdElements = () => {
      // Common ad selectors
      const adSelectors = [
        '[id*="ad"]',
        '[class*="ad"]',
        '[id*="banner"]',
        '[class*="banner"]',
        '[id*="popup"]',
        '[class*="popup"]',
        '[data-zone]',
        'iframe[src*="ads"]',
        'iframe[src*="doubleclick"]',
        'iframe[src*="googlesyndication"]',
        'iframe[src*="fpyf8"]',
        'div[style*="position: fixed"]',
        'div[style*="z-index: 999"]',
        'div[style*="z-index: 9999"]',
        // Target specific patterns we saw in the ads
        'div:has(> img[alt*="trade"])',
        'div:has(> img[alt*="bonus"])',
        'div[style*="background: linear-gradient"]'
      ]

      let removedCount = 0
      
      adSelectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector)
          elements.forEach(element => {
            // Check if this looks like an ad
            const text = element.textContent?.toLowerCase() || ''
            const hasAdKeywords = text.includes('ad') || 
                                text.includes('bonus') || 
                                text.includes('trade') || 
                                text.includes('click') ||
                                text.includes('earn')
            
            if (hasAdKeywords || 
                element.innerHTML.includes('monetag') ||
                element.innerHTML.includes('publishers.monetag.com') ||
                element.innerHTML.includes('fpyf8') ||
                element.innerHTML.includes('tag.min.js')) {
              element.remove()
              removedCount++
              console.log('Removed Monetag/ad element:', element)
            }
          })
        } catch (error) {
          // Ignore selector errors
        }
      })

      if (removedCount > 0) {
        console.log(`Removed ${removedCount} ad elements from DOM`)
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
