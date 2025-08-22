"use client"

import { useEffect } from 'react'
import { usePremium } from '@/lib/contexts/PremiumContext'

export default function AdScript() {
  const { isPremium, isLoading } = usePremium()
  
  // Immediate debug log to see current status
  console.log('🔍 AdScript render - isPremium:', isPremium, 'isLoading:', isLoading)

  useEffect(() => {
    console.log('🔍 AdScript check - isPremium:', isPremium, 'isLoading:', isLoading)
    
    // Don't load ads if user is premium or still loading
    if (isLoading || isPremium) {
      console.log('🛡️ Premium user - AdScript blocked', { isPremium, isLoading })
      return
    }
    
    console.log('💰 Non-premium user - Loading Monetag script', { isPremium, isLoading })
    
    // Only load the Monetag ad script for non-premium users
    const script = document.createElement('script')
    script.src = 'https://fpyf8.com/88/tag.min.js'  // This is your Monetag script
    script.setAttribute('data-zone', '165368')
    script.async = true
    script.setAttribute('data-cfasync', 'false')
    
    // Add script to head
    document.head.appendChild(script)

    // Cleanup function to remove script if component unmounts
    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script)
      }
    }
  }, [isPremium, isLoading])

  // Don't render anything - this component just manages the script
  return null
}
