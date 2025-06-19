import { useEffect, useState } from "react"
import { onAuthStateChanged, getAuth, User } from "firebase/auth"
import { initializeApp, getApps } from "firebase/app"

// Import your firebaseConfig from the client config file
import { firebaseConfig } from "@/lib/firebase-client-config"

// Ensure Firebase is initialized only once
if (!getApps().length) {
  initializeApp(firebaseConfig)
}

export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null)
  
  useEffect(() => {
    const auth = getAuth()
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u))
    return () => unsubscribe()
  }, [])
  
  return user
} 