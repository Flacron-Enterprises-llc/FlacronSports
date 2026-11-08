"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { authFetch } from "@/lib/auth-fetch"
import { trackFeatureUsed } from "@/lib/growth-engine"
import { PLANS } from "@/lib/billing/plans"
import { useAuthUser } from "@/lib/hooks/useAuthUser"
import { DEFAULT_PREFERENCES, type Preferences } from "@/lib/me/preferences-defaults"
import { watchMemberCookie } from "@/lib/member-session"
import { readStored, writeStored } from "@/lib/storage-consent"

const KEY = "fs-prefs"

interface PrefsValue {
  prefs: Preferences
  /** True once the signed-in record has loaded, or at once for guests. */
  ready: boolean
  signedIn: boolean
  update(patch: Partial<Preferences>): Promise<boolean>
  /** Runs one at a time from the latest list, so two quick stars cannot overwrite each other. */
  toggleFavorite(name: string): Promise<FavoriteResult>
  /** Same queue, for any list: the patch is built from the latest saved state. */
  mutate(build: (current: Preferences) => Partial<Preferences>): Promise<MutateResult>
}

export type FavoriteResult = "added" | "removed" | "limit" | "failed"
export type MutateResult = "saved" | "limit" | "failed"

const PrefsContext = createContext<PrefsValue | null>(null)

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthUser()
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES)
  const [guestReady, setGuestReady] = useState(false)
  const [loadedUid, setLoadedUid] = useState<string | null>(null)
  const guestRef = useRef<Preferences>(DEFAULT_PREFERENCES)
  const latest = useRef<Preferences>(DEFAULT_PREFERENCES)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  latest.current = prefs

  useEffect(() => watchMemberCookie(), [])

  useEffect(() => {
    const stored = { ...DEFAULT_PREFERENCES, ...readStored<Partial<Preferences>>(KEY, {}) }
    guestRef.current = stored
    setPrefs(stored)
    setGuestReady(true)
  }, [])

  useEffect(() => {
    if (!user) return
    let active = true
    ;(async () => {
      const response = await authFetch("/api/me/preferences").catch(() => null)
      if (!active) return
      if (!response?.ok) return setLoadedUid(user.uid)
      const server = (await response.json()) as Preferences
      // Guest favorites join the account on first sign-in, within the plan limit.
      const merged = [...new Set([...server.favorites, ...guestRef.current.favorites])]
      const next = { ...server, favorites: merged }
      setPrefs(next)
      setLoadedUid(user.uid)
      if (merged.length !== server.favorites.length) {
        const saved = await authFetch("/api/me/preferences", { method: "PUT", body: JSON.stringify({ favorites: merged }) }).catch(() => null)
        if (active && !saved?.ok) setPrefs(server)
      }
    })()
    return () => {
      active = false
    }
  }, [user])

  const update = useCallback(
    async (patch: Partial<Preferences>) => {
      if (!user) {
        setPrefs((current) => {
          const next = { ...current, ...patch }
          writeStored(KEY, next)
          return next
        })
        return true
      }
      const response = await authFetch("/api/me/preferences", { method: "PUT", body: JSON.stringify(patch) }).catch(() => null)
      if (!response?.ok) return false
      setPrefs(await response.json())
      return true
    },
    [user],
  )

  const toggleFavorite = useCallback(
    (name: string) => {
      const run = async (): Promise<FavoriteResult> => {
        const names = latest.current.favorites
        const following = names.includes(name)
        const favorites = following ? names.filter((item) => item !== name) : [...names, name]
        if (!user) {
          if (!following && names.length >= (PLANS.basic.favoritesLimit as number)) return "limit"
          const next = { ...latest.current, favorites }
          latest.current = next
          setPrefs(next)
          writeStored(KEY, next)
          return following ? "removed" : "added"
        }
        const response = await authFetch("/api/me/preferences", { method: "PUT", body: JSON.stringify({ favorites }) }).catch(() => null)
        if (!response?.ok) {
          const data = await response?.json().catch(() => null)
          return data?.code === "favorites_limit" ? "limit" : "failed"
        }
        const next = (await response.json()) as Preferences
        latest.current = next
        setPrefs(next)
        if (!following) trackFeatureUsed("team_followed")
        return following ? "removed" : "added"
      }
      const result = queue.current.then(run, run)
      queue.current = result
      return result
    },
    [user],
  )

  const mutate = useCallback(
    (build: (current: Preferences) => Partial<Preferences>) => {
      const run = async (): Promise<MutateResult> => {
        const patch = build(latest.current)
        if (!user) return "failed"
        const response = await authFetch("/api/me/preferences", { method: "PUT", body: JSON.stringify(patch) }).catch(() => null)
        if (!response?.ok) {
          const data = await response?.json().catch(() => null)
          return data?.code === "favorites_limit" ? "limit" : "failed"
        }
        const next = (await response.json()) as Preferences
        latest.current = next
        setPrefs(next)
        return "saved"
      }
      const result = queue.current.then(run, run)
      queue.current = result
      return result
    },
    [user],
  )

  // Derived, so a just-signed-in user is never ready on guest defaults.
  const ready = user ? loadedUid === user.uid : guestReady
  const value = useMemo(() => ({ prefs, ready, signedIn: Boolean(user), update, toggleFavorite, mutate }), [prefs, ready, user, update, toggleFavorite, mutate])
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>
}

export function usePreferences(): PrefsValue {
  const value = useContext(PrefsContext)
  if (!value) throw new Error("usePreferences must be used inside PreferencesProvider")
  return value
}
