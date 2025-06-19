"use client"

import { createContext, useContext, useEffect, useState } from 'react'
import { useAuthUser } from '@/lib/hooks/useAuthUser'

interface PremiumContextType {
  isPremium: boolean
  isLoading: boolean
}

const PremiumContext = createContext<PremiumContextType>({
  isPremium: false,
  isLoading: true,
})

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const [isPremium, setIsPremium] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const user = useAuthUser()

  useEffect(() => {
    const checkPremiumStatus = async () => {
      if (!user) {
        setIsPremium(false)
        setIsLoading(false)
        return
      }

      try {
        const response = await fetch("/api/is-premium", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.uid })
        })

        const data = await response.json()
        setIsPremium(!!data.isPremium)
      } catch (error) {
        console.error("Error checking premium status:", error)
        setIsPremium(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkPremiumStatus()
  }, [user])

  return (
    <PremiumContext.Provider value={{ isPremium, isLoading }}>
      {children}
    </PremiumContext.Provider>
  )
}

export function usePremium() {
  return useContext(PremiumContext)
} 