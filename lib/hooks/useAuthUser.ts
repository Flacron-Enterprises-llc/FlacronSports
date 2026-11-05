import { useEffect, useState } from "react"
import { onAuthStateChanged, getAuth, User } from "firebase/auth"
import { initializeApp, getApps } from "firebase/app"

// Import your firebaseConfig from the client config file
import { firebaseConfig } from "@/lib/firebase-client-config"

// Lazy initialization of Firebase
function getFirebaseApp() {
  if (!getApps().length) {
    // Only initialize if we have an API key
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || firebaseConfig.apiKey;
    if (apiKey && apiKey !== '') {
      initializeApp(firebaseConfig)
    }
  }
  return getApps()[0] || null;
}

export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null)
  
  useEffect(() => {
    // Only initialize Firebase in the browser (client-side)
    if (typeof window === 'undefined') return;
    
    const app = getFirebaseApp();
    if (!app) return;
    
    const auth = getAuth(app)
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u))
    return () => unsubscribe()
  }, [])
  
  return user
}

/** Unlike useAuthUser, this can tell "still loading" apart from "signed out". */
export function useAuthState() {
  const [state, setState] = useState<{ user: User | null; ready: boolean }>({ user: null, ready: false })

  useEffect(() => {
    const app = getFirebaseApp()
    if (!app) return setState({ user: null, ready: true })
    return onAuthStateChanged(getAuth(app), (user) => setState({ user, ready: true }))
  }, [])

  return state
}
