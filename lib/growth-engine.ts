// Flacron Growth Engine (FCGE): lifecycle analytics, support chat and offers for
// FlacronSport, all controlled from the Growth Engine dashboard. See docs/growth-engine.md.
//
// Consent-gated install, the same as the other Flacron apps:
//   1. `window.FCGE` is created as a queue by `installGrowthEngineQueue()`. It makes
//      no request; calls only land in memory.
//   2. The SDK (`fcge.min.js`, which sends the queue and also brings the support chat
//      widget and any popups configured in the Growth Engine) is appended to <head>
//      only once the visitor has allowed Analytics in the cookie banner, including a
//      consent given later in the visit (components/growth-engine-tracker.tsx).
//
// Every helper is a no-op without consent and never throws: analytics must never be
// the reason an action fails. Payment and subscription events are deliberately
// absent: the Growth Engine receives this Stripe account's webhooks (filtered by
// app_id=flacron-sport), so sending them here would double count.

// The key is the Growth Engine's publishable key: it is meant to ship to the browser
// (like a Stripe publishable key) and grants no server-side access.
export const GROWTH_ENGINE = {
  appId: "cmujjiled00lijy1je65xn4sn",
  key: "pk_live_026f46e1d9671ec4bb3db275dbe0692710dff748d0baa1b4",
  endpoint: "https://dleleyb9ufrgz.cloudfront.net",
  sdkUrl: "https://dleleyb9ufrgz.cloudfront.net/sdk/fcge.min.js",
} as const

// `NEXT_PUBLIC_FCGE_DISABLED=true` keeps a local or staging build from reporting into the live app.
export const growthEngineEnabled = process.env.NEXT_PUBLIC_FCGE_DISABLED !== "true"

const METHODS = ["identify", "track", "registerWebinar", "page", "showForm", "reset"] as const
type Method = (typeof METHODS)[number]

type FcgeClient = { appId: string; key: string; endpoint: string; q: unknown[] } & Record<Method, (...args: unknown[]) => void>

declare global {
  interface Window {
    FCGE?: FcgeClient
  }
}

/** The install snippet's first script: config plus a stub per method that queues its call. */
export function installGrowthEngineQueue(): void {
  if (!growthEngineEnabled || typeof window === "undefined" || window.FCGE) return
  const fcge = { appId: GROWTH_ENGINE.appId, key: GROWTH_ENGINE.key, endpoint: GROWTH_ENGINE.endpoint, q: [] as unknown[] } as FcgeClient
  for (const method of METHODS) {
    fcge[method] = (...args: unknown[]) => {
      fcge.q.push([method, args])
    }
  }
  window.FCGE = fcge
}

// Set from the consent context by the tracker. Kept here rather than read from storage,
// because a choice made with storage blocked still applies to the page view.
let analyticsAllowed = false

/** The tracker passes the current Analytics choice; nothing is reported without it. */
export function setGrowthConsent(allowed: boolean): void {
  analyticsAllowed = allowed
  if (!allowed) lastIdentity = null
}

export function growthConsentGiven(): boolean {
  return analyticsAllowed
}

function client(): FcgeClient | null {
  if (!growthEngineEnabled || !analyticsAllowed || typeof window === "undefined") return null
  const fcge = window.FCGE
  return fcge && typeof fcge.track === "function" ? fcge : null
}

/** Loads the SDK into <head>, once, and only with Analytics consent. */
export function loadGrowthEngineSdk(): boolean {
  if (!growthEngineEnabled || !analyticsAllowed || typeof document === "undefined") return false
  try {
    if (document.querySelector(`script[src="${GROWTH_ENGINE.sdkUrl}"]`)) return false
    const script = document.createElement("script")
    script.src = GROWTH_ENGINE.sdkUrl
    script.async = true
    document.head.appendChild(script)
    return true
  } catch {
    return false
  }
}

/**
 * Lifecycle events the Growth Engine's journeys are keyed on: user_registered,
 * email_verified, onboarding_completed, feature_used, pricing_page_visited,
 * upgrade_clicked, checkout_started.
 */
export function trackGrowthEvent(event: string, properties?: Record<string, unknown>): void {
  try {
    client()?.track(event, properties ?? {})
  } catch {
    // Analytics must never be the reason an action fails.
  }
}

/**
 * The actions that count as using the product, the meaningful ones only so
 * `feature_used` reads as adoption rather than noise. Call after the action succeeded.
 */
export type GrowthFeature =
  | "team_followed"
  | "alerts_enabled"
  | "assistant_question"
  | "compare_view_saved"
  | "report_exported"
  | "viewing_option_opened"

export function trackFeatureUsed(feature: GrowthFeature, properties?: Record<string, unknown>): void {
  trackGrowthEvent("feature_used", { ...properties, feature })
}

export interface GrowthIdentity {
  uid: string
  email: string | null
  name?: string | null
  plan?: string | null
  locale?: string
}

let lastIdentity: string | null = null
let known: GrowthIdentity | null = null

/** The traits sent to FCGE.identify: only fields the app really has. */
export function identityTraits(identity: GrowthIdentity): Record<string, unknown> | null {
  if (!identity.email) return null
  const traits: Record<string, unknown> = { email: identity.email, externalUserId: identity.uid }
  const name = identity.name?.trim()
  if (name && name !== identity.email) traits.name = name
  if (identity.plan) traits.plan = identity.plan
  if (identity.locale) traits.properties = { locale: identity.locale }
  // No marketingConsent: FlacronSport has no account-level marketing opt-in.
  return traits
}

/**
 * FCGE.identify for the signed-in, verified user. Fields merge with what is already
 * known about the same user (the plan arrives later, from the dashboard), and a call
 * with identical traits is dropped.
 */
export function identifyGrowthUser(identity: Partial<GrowthIdentity> & { uid: string }): void {
  const merged: GrowthIdentity = known?.uid === identity.uid ? { ...known, ...strip(identity) } : { email: null, ...strip(identity) }
  known = merged
  const fcge = client()
  const traits = identityTraits(merged)
  if (!fcge || !traits) return
  const fingerprint = JSON.stringify(traits)
  if (fingerprint === lastIdentity) return
  try {
    fcge.identify(traits)
    lastIdentity = fingerprint
  } catch {
    // As above.
  }
}

function strip<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T
}

/** Forget the last identify, so a later consent (or the same user again) identifies afresh. */
export function resetGrowthIdentity(): void {
  lastIdentity = null
}

/**
 * Sign-out, or a different user signing in: forget the identity here and in the SDK
 * so the next person on this browser isn't attributed to the last one. Not
 * consent-gated: forgetting someone is always allowed, and without the SDK the call
 * only lands in the queue.
 */
export function signOutGrowthUser(): void {
  lastIdentity = null
  known = null
  if (!growthEngineEnabled || typeof window === "undefined") return
  try {
    window.FCGE?.reset?.()
  } catch {
    // As above.
  }
}

const VERIFIED_KEY = "fs-fcge-verified"

/** email_verified once per user per browser: the code page and the waiting tab both see it. */
export function trackEmailVerified(uid: string): void {
  if (!client()) return
  try {
    if (localStorage.getItem(VERIFIED_KEY) === uid) return
    localStorage.setItem(VERIFIED_KEY, uid)
  } catch {
    // Storage blocked: report it anyway.
  }
  trackGrowthEvent("email_verified")
}

/** /pricing and /fr/pricing. */
export function isPricingPath(path: string): boolean {
  return /^(\/fr)?\/pricing\/?$/.test(path)
}

// ── Offer hand-off ──────────────────────────────────────────────────────────
// Growth Engine webinar / giveaway links open FlacronSport with ?code=&fcge_ref=.
// They're kept for the session (surviving sign-up and sign-in) and sent with the
// checkout request; the server applies the code and stamps fcge_ref on the Stripe
// session so the engine credits the offer. Needed to honour the offer the visitor
// clicked, so it isn't consent-gated, and it never leaves this app except in the
// visitor's own checkout request.

const HANDOFF_KEY = "fs-fcge-offer"
export const FCGE_REF_PATTERN = /^[A-Za-z0-9_\-.]{10,400}$/
export const PROMO_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,39}$/

export interface OfferHandoff {
  promoCode?: string
  fcgeRef?: string
}

/** The valid parts of an offer link's query string. */
export function parseOfferHandoff(search: string): OfferHandoff {
  let params: URLSearchParams
  try {
    params = new URLSearchParams(search)
  } catch {
    return {}
  }
  const code = params.get("code")?.trim().toUpperCase()
  const ref = params.get("fcge_ref")?.trim()
  return cleanHandoff({ promoCode: code, fcgeRef: ref })
}

export function cleanHandoff(value: unknown): OfferHandoff {
  const input = (value ?? {}) as Record<string, unknown>
  return {
    ...(typeof input.promoCode === "string" && PROMO_CODE_PATTERN.test(input.promoCode) ? { promoCode: input.promoCode } : {}),
    ...(typeof input.fcgeRef === "string" && FCGE_REF_PATTERN.test(input.fcgeRef) ? { fcgeRef: input.fcgeRef } : {}),
  }
}

export function captureOfferHandoff(search: string): void {
  const next = parseOfferHandoff(search)
  if (!next.promoCode && !next.fcgeRef) return
  try {
    sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ ...getOfferHandoff(), ...next }))
  } catch {
    // Storage blocked: the offer just won't survive a reload.
  }
}

export function getOfferHandoff(): OfferHandoff {
  try {
    return cleanHandoff(JSON.parse(sessionStorage.getItem(HANDOFF_KEY) ?? "null"))
  } catch {
    return {}
  }
}
