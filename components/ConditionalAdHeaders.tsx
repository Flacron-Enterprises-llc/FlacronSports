"use client"

import { usePremium } from '@/lib/contexts/PremiumContext'
import { useEffect } from 'react'

export default function ConditionalAdHeaders() {
  const { isPremium, isLoading } = usePremium()

  useEffect(() => {
    // Only load ad headers for non-premium users
    if (isLoading || isPremium) {
      console.log('🛡️ Skipping ad headers for premium user')
      return
    }

    console.log('💰 Loading ad headers for non-premium user')

    // Create and add Monetag meta tags and headers for non-premium users
    const metaTags = [
      {
        name: 'monetag-site-verification',
        content: 'your-site-verification-code'
      },
      {
        name: 'ads-txt-verification', 
        content: 'monetag-publisher-verification'
      }
    ]

    // Add meta tags
    metaTags.forEach(tag => {
      const existingTag = document.querySelector(`meta[name="${tag.name}"]`)
      if (!existingTag) {
        const meta = document.createElement('meta')
        meta.name = tag.name
        meta.content = tag.content
        document.head.appendChild(meta)
      }
    })

    // Preconnect to Monetag domains for faster loading (non-premium only)
    const preconnectDomains = [
      'https://publishers.monetag.com',
      'https://fpyf8.com'
    ]

    preconnectDomains.forEach(domain => {
      const existingLink = document.querySelector(`link[href="${domain}"]`)
      if (!existingLink) {
        const link = document.createElement('link')
        link.rel = 'preconnect'
        link.href = domain
        link.crossOrigin = 'anonymous'
        document.head.appendChild(link)
      }
    })

    // Cleanup function - remove ad headers if user becomes premium
    return () => {
      metaTags.forEach(tag => {
        const existingTag = document.querySelector(`meta[name="${tag.name}"]`)
        if (existingTag) {
          existingTag.remove()
        }
      })

      preconnectDomains.forEach(domain => {
        const existingLink = document.querySelector(`link[href="${domain}"]`)
        if (existingLink) {
          existingLink.remove()
        }
      })

      console.log('🛡️ Removed ad headers for premium user')
    }
  }, [isPremium, isLoading])

  return null
}
