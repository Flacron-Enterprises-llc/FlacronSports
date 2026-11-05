import { getApps, initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { firebaseConfig } from "@/lib/firebase-client-config"

/** fetch() that attaches the signed-in user's Firebase ID token. */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  if (!getApps().length) initializeApp(firebaseConfig)
  const token = await getAuth().currentUser?.getIdToken()
  const headers = new Headers(init.headers)
  if (token) headers.set("Authorization", `Bearer ${token}`)
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json")
  return fetch(input, { ...init, headers })
}
