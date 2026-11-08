"use client"

import { useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { usePreferences } from "@/components/account/prefs-provider"
import { useConsent } from "@/components/consent/consent-provider"
import {
  captureOfferHandoff,
  growthEngineEnabled,
  identifyGrowthUser,
  installGrowthEngineQueue,
  isPricingPath,
  loadGrowthEngineSdk,
  resetGrowthIdentity,
  setGrowthConsent,
  signOutGrowthUser,
  trackGrowthEvent,
} from "@/lib/growth-engine"
import { useAuthState } from "@/lib/hooks/useAuthUser"
import { setupChecklist } from "@/lib/me/preferences-defaults"
import { readStored, SPOILER_DECIDED_KEY } from "@/lib/storage-consent"
import { useLocale } from "@/lib/use-locale"

/**
 * The one place the app talks to the Growth Engine about the session as a whole:
 * the SDK once Analytics consent exists (which also shows the support chat), who is
 * signed in, sign-out, offer links, pricing visits, upgrade clicks and the end of
 * the setup checklist. Mounted once in the root layout, so it sees the marketing
 * site, auth pages and the dashboard alike. The SDK records page views itself,
 * including client-side navigations.
 */
export function GrowthEngineTracker() {
  const consent = useConsent()
  const { locale } = useLocale()
  const path = usePathname() ?? "/"
  const search = useSearchParams()
  const { user, ready: authReady } = useAuthState()
  const { prefs, ready: prefsReady, signedIn } = usePreferences()
  const consented = consent.ready && consent.categories.includes("analytics")
  const previousUid = useRef<string | null>(null)
  const setupSeen = useRef<{ uid: string; complete: boolean; reported: boolean } | null>(null)

  // Queue first, then the SDK when (and only when) Analytics is allowed, including later in the visit.
  useEffect(() => {
    installGrowthEngineQueue()
    setGrowthConsent(consented)
    if (consented && loadGrowthEngineSdk()) {
      // Anything identified before consent was dropped; send it again.
      resetGrowthIdentity()
    }
  }, [consented])

  // Offer links (?code=&fcge_ref=) can land on any page.
  const query = search?.toString() ?? ""
  useEffect(() => {
    if (query) captureOfferHandoff(query)
  }, [query])

  useEffect(() => {
    if (isPricingPath(path)) trackGrowthEvent("pricing_page_visited", { path })
  }, [path, consented])

  // Verified users only: an unverified address may not be theirs.
  const isGoogle = Boolean(user?.providerData.some((provider) => provider.providerId === "google.com"))
  const verified = Boolean(user && (user.emailVerified || isGoogle))
  useEffect(() => {
    if (!consented || !verified || !user) return
    identifyGrowthUser({ uid: user.uid, email: user.email, name: user.displayName, locale })
  }, [consented, verified, user, locale])

  // Sign-out, or a different user signing in on this browser.
  useEffect(() => {
    if (!authReady) return
    const uid = user?.uid ?? null
    const previous = previousUid.current
    previousUid.current = uid
    if (previous && previous !== uid) signOutGrowthUser()
  }, [authReady, user])

  // onboarding_completed: the dashboard's "Get set up" checklist finishing in front of us.
  // A member who had it done before this visit is not reported again.
  useEffect(() => {
    if (!signedIn || !prefsReady || !user) return
    const complete = Object.values(setupChecklist(prefs, readStored<boolean>(SPOILER_DECIDED_KEY, false))).every(Boolean)
    const seen = setupSeen.current?.uid === user.uid ? setupSeen.current : null
    const finished = complete && seen !== null && !seen.complete && !seen.reported
    setupSeen.current = { uid: user.uid, complete, reported: Boolean(seen?.reported || finished) }
    if (finished) trackGrowthEvent("onboarding_completed")
  }, [signedIn, prefsReady, prefs, user])

  // One delegated listener rather than an onClick on every upgrade button: anything
  // marked data-fcge-upgrade="<plan>" (or "any") counts.
  useEffect(() => {
    if (!growthEngineEnabled) return
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return
      const marked = event.target.closest("[data-fcge-upgrade]")
      if (!marked) return
      trackGrowthEvent("upgrade_clicked", { plan: marked.getAttribute("data-fcge-upgrade") || "any", path: window.location.pathname })
    }
    document.addEventListener("click", onClick, { capture: true })
    return () => document.removeEventListener("click", onClick, { capture: true })
  }, [])

  return null
}
