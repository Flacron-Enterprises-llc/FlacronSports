"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { usePreferences } from "@/components/account/prefs-provider"
import { TIME_ZONE_COOKIE } from "@/lib/local-day"

/**
 * Tells server pages the zone LocalTime shows times in, so a day on Scores is the
 * member's own day. Same rule as LocalTime: the saved zone, else the browser's.
 */
export function TimeZoneCookie() {
  const { prefs, signedIn, ready } = usePreferences()
  const router = useRouter()
  useEffect(() => {
    if (ready === false) return
    let zone = "UTC"
    try {
      zone = signedIn && prefs.timeZone !== "UTC" ? prefs.timeZone : Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    } catch {
      return
    }
    const current = document.cookie.split("; ").find((item) => item.startsWith(`${TIME_ZONE_COOKIE}=`))?.split("=")[1]
    if (current === encodeURIComponent(zone)) return
    document.cookie = `${TIME_ZONE_COOKIE}=${encodeURIComponent(zone)}; path=/; max-age=31536000; samesite=lax; secure`
    // The page already drawn used the old day boundaries.
    router.refresh()
  }, [prefs.timeZone, ready, router, signedIn])
  return null
}
