import { getApps, initializeApp } from "firebase/app"
import { getAuth, onIdTokenChanged, type User } from "firebase/auth"
import { firebaseConfig } from "@/lib/firebase-client-config"
import { clearedMemberCookie, memberCookie } from "@/lib/member-cookie"

const REFRESH_MARGIN_MS = 5 * 60_000
const MIN_REFRESH_WAIT_MS = 5 * 60_000

const secure = () => window.location.protocol === "https:"

export function clearMemberCookie(): void {
  document.cookie = clearedMemberCookie(secure())
}

/** Sign-in awaits this, so the first dashboard render already carries the token. */
export async function syncMemberCookie(user: User, force = false): Promise<boolean> {
  try {
    document.cookie = memberCookie(await user.getIdToken(force), secure())
    return true
  } catch {
    return false
  }
}

/** The SDK refreshes a token only when asked, so an open tab asks before this one runs out. */
export function watchMemberCookie(): () => void {
  if (!getApps().length) initializeApp(firebaseConfig)
  const auth = getAuth()
  let timer: ReturnType<typeof setTimeout> | undefined
  const unsubscribe = onIdTokenChanged(auth, async (user) => {
    clearTimeout(timer)
    if (!user) return clearMemberCookie()
    const result = await user.getIdTokenResult().catch(() => null)
    if (!result || auth.currentUser?.uid !== user.uid) return
    document.cookie = memberCookie(result.token, secure())
    const wait = Date.parse(result.expirationTime) - Date.now() - REFRESH_MARGIN_MS
    clearTimeout(timer)
    timer = setTimeout(() => void user.getIdToken(true).catch(() => undefined), Math.max(wait, MIN_REFRESH_WAIT_MS))
  })
  return () => {
    clearTimeout(timer)
    unsubscribe()
  }
}
