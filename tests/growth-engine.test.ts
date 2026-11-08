// Flacron Growth Engine: the offer funnel at checkout and the consent gate in the browser.
import { readFileSync } from "node:fs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  belongsToApp,
  funnelMetadata,
  isDiscountRejection,
  isValidFcgeRef,
  normalizePromoCode,
  resolveCheckoutDiscount,
} from "@/lib/billing/growth-engine-funnel"
import {
  GROWTH_ENGINE,
  identifyGrowthUser,
  installGrowthEngineQueue,
  isPricingPath,
  loadGrowthEngineSdk,
  parseOfferHandoff,
  setGrowthConsent,
  signOutGrowthUser,
  trackFeatureUsed,
  trackGrowthEvent,
} from "@/lib/growth-engine"
import { getDictionary } from "@/lib/i18n"
import { DEFAULT_PREFERENCES, setupChecklist } from "@/lib/me/preferences-defaults"

const APP = "flacron-sport"
const REF = "wbn_cmabc123.xyz-9"

describe("offer funnel validation", () => {
  it("accepts only well-formed references and codes", () => {
    expect(isValidFcgeRef(REF)).toBe(true)
    expect(isValidFcgeRef("short")).toBe(false)
    expect(isValidFcgeRef("has space in it")).toBe(false)
    expect(isValidFcgeRef("x".repeat(401))).toBe(false)
    expect(isValidFcgeRef(42)).toBe(false)
    expect(normalizePromoCode("  pilot50 ")).toBe("PILOT50")
    expect(normalizePromoCode("A")).toBeNull()
    expect(normalizePromoCode("-BAD")).toBeNull()
    expect(normalizePromoCode("NO SPACE")).toBeNull()
    expect(normalizePromoCode(null)).toBeNull()
  })

  it("parses an offer link's query string", () => {
    expect(parseOfferHandoff(`?code= webinar797 &fcge_ref=${REF}&utm_source=x`)).toEqual({ promoCode: "WEBINAR797", fcgeRef: REF })
    expect(parseOfferHandoff("?code=bad code&fcge_ref=no")).toEqual({})
    expect(parseOfferHandoff("")).toEqual({})
  })
})

describe("checkout metadata and discounts", () => {
  it("stamps fcge_ref and the applied code only", () => {
    expect(funnelMetadata({ fcgeRef: REF, appliedCode: "PILOT50" })).toEqual({ fcge_ref: REF, promo_code: "PILOT50" })
    expect(funnelMetadata({ fcgeRef: "bad", appliedCode: null })).toEqual({})
    expect(funnelMetadata()).toEqual({})
  })

  it("applies a code only when every tag names this app", () => {
    expect(belongsToApp({ metadata: { app_id: APP }, coupon: { metadata: {} } }, APP)).toBe(true)
    expect(belongsToApp({ metadata: {}, coupon: { metadata: { app_id: APP } } }, APP)).toBe(true)
    expect(belongsToApp({ metadata: { app_id: APP }, coupon: { metadata: { app_id: "flacron-ai" } } }, APP)).toBe(false)
    expect(belongsToApp({ metadata: {}, coupon: { metadata: {} } }, APP)).toBe(false)
    expect(belongsToApp(null, APP)).toBe(false)
  })

  const stripeWith = (data: unknown[] | Error) => ({
    promotionCodes: {
      list: vi.fn(async () => {
        if (data instanceof Error) throw data
        return { data }
      }),
    },
  })

  it("applies a live code of this app up front", async () => {
    const stripe = stripeWith([{ id: "promo_1", metadata: { app_id: APP }, coupon: { valid: true, metadata: {} } }])
    const result = await resolveCheckoutDiscount(stripe as never, " pilot50", APP)
    expect(result).toEqual({ options: { discounts: [{ promotion_code: "promo_1" }] }, appliedCode: "PILOT50" })
    expect(stripe.promotionCodes.list).toHaveBeenCalledWith(expect.objectContaining({ code: "PILOT50", active: true }))
  })

  it("falls back to Stripe's code field otherwise, and never throws", async () => {
    const field = { options: { allow_promotion_codes: true }, appliedCode: null }
    expect(await resolveCheckoutDiscount(stripeWith([]) as never, "PILOT50", APP)).toEqual(field)
    expect(await resolveCheckoutDiscount(stripeWith([{ id: "p", metadata: { app_id: "flacron-ai" }, coupon: { valid: true } }]) as never, "PILOT50", APP)).toEqual(field)
    expect(await resolveCheckoutDiscount(stripeWith([{ id: "p", metadata: { app_id: APP }, coupon: { valid: false } }]) as never, "PILOT50", APP)).toEqual(field)
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    expect(await resolveCheckoutDiscount(stripeWith(new Error("down")) as never, "PILOT50", APP)).toEqual(field)
    warn.mockRestore()
    const unused = stripeWith([])
    expect(await resolveCheckoutDiscount(unused as never, "bad code", APP)).toEqual(field)
    expect(unused.promotionCodes.list).not.toHaveBeenCalled()
  })

  it("recognises Stripe refusing the up-front discount", () => {
    expect(isDiscountRejection({ type: "StripeInvalidRequestError", param: "discounts[0][promotion_code]" })).toBe(true)
    expect(isDiscountRejection({ type: "StripeInvalidRequestError", param: "line_items" })).toBe(false)
    expect(isDiscountRejection({ type: "StripeCardError", param: "discounts" })).toBe(false)
    expect(isDiscountRejection(null)).toBe(false)
  })

  it("keeps app_id on the session and the subscription, with the funnel fields", () => {
    const route = readFileSync("app/api/billing/checkout/route.ts", "utf8")
    expect(route).toMatch(/app_id: APP_ID/)
    expect(route).toMatch(/funnelMetadata\(/)
    expect(route).toMatch(/subscription_data: \{ metadata \}/)
    expect(route).toMatch(/allow_promotion_codes: true/)
  })
})

describe("consent gate", () => {
  let appended: { src: string; async: boolean }[]

  beforeEach(() => {
    appended = []
    const memory = new Map<string, string>()
    const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => void memory.set(key, value), removeItem: (key: string) => void memory.delete(key) }
    vi.stubGlobal("window", { location: { pathname: "/" } })
    vi.stubGlobal("localStorage", storage)
    vi.stubGlobal("sessionStorage", storage)
    vi.stubGlobal("document", {
      querySelector: (selector: string) => (appended.some((script) => selector.includes(script.src)) ? {} : null),
      createElement: () => ({ src: "", async: false }),
      head: { appendChild: (script: { src: string; async: boolean }) => appended.push(script) },
    })
    installGrowthEngineQueue()
  })

  afterEach(() => {
    setGrowthConsent(false)
    signOutGrowthUser()
    vi.unstubAllGlobals()
  })

  const queued = () => (window.FCGE?.q ?? []) as [string, unknown[]][]

  it("creates the queue with this app's config and sends nothing", () => {
    expect(window.FCGE).toMatchObject({ appId: GROWTH_ENGINE.appId, key: GROWTH_ENGINE.key, endpoint: GROWTH_ENGINE.endpoint })
    expect(appended).toEqual([])
  })

  it("does nothing without Analytics consent", () => {
    setGrowthConsent(false)
    expect(loadGrowthEngineSdk()).toBe(false)
    trackGrowthEvent("pricing_page_visited")
    trackFeatureUsed("team_followed")
    identifyGrowthUser({ uid: "u1", email: "a@example.com" })
    expect(appended).toEqual([])
    expect(queued()).toEqual([])
  })

  it("loads the SDK once after consent and reports from then on", () => {
    setGrowthConsent(true)
    expect(loadGrowthEngineSdk()).toBe(true)
    expect(loadGrowthEngineSdk()).toBe(false)
    expect(appended).toEqual([{ src: GROWTH_ENGINE.sdkUrl, async: true }])
    trackFeatureUsed("assistant_question")
    expect(queued()).toEqual([["track", ["feature_used", { feature: "assistant_question" }]]])
  })

  it("identifies once per set of traits, merges the plan, and never sends marketing consent", () => {
    setGrowthConsent(true)
    identifyGrowthUser({ uid: "u1", email: "a@example.com", name: "a@example.com", locale: "fr" })
    identifyGrowthUser({ uid: "u1", email: "a@example.com", name: "a@example.com", locale: "fr" })
    identifyGrowthUser({ uid: "u1", plan: "plus" })
    const identifies = queued().filter(([method]) => method === "identify").map(([, args]) => args[0])
    expect(identifies).toEqual([
      { email: "a@example.com", externalUserId: "u1", properties: { locale: "fr" } },
      { email: "a@example.com", externalUserId: "u1", plan: "plus", properties: { locale: "fr" } },
    ])
    expect(JSON.stringify(identifies)).not.toMatch(/marketingConsent/)
  })

  it("resets on sign-out even without consent", () => {
    signOutGrowthUser()
    expect(queued()).toEqual([["reset", []]])
  })

  it("never throws when the SDK misbehaves", () => {
    setGrowthConsent(true)
    window.FCGE!.track = () => {
      throw new Error("boom")
    }
    expect(() => trackGrowthEvent("checkout_started")).not.toThrow()
  })
})

describe("app moments", () => {
  it("knows the pricing page in both languages", () => {
    expect(isPricingPath("/pricing")).toBe(true)
    expect(isPricingPath("/fr/pricing")).toBe(true)
    expect(isPricingPath("/app/billing")).toBe(false)
    expect(isPricingPath("/pricing-old")).toBe(false)
  })

  it("finishes setup with a team, chosen alerts and a spoiler decision", () => {
    const fresh = setupChecklist(DEFAULT_PREFERENCES, false)
    expect(Object.values(fresh).every(Boolean)).toBe(false)
    const done = setupChecklist({ ...DEFAULT_PREFERENCES, favorites: ["Arsenal"], alerts: { ...DEFAULT_PREFERENCES.alerts, email: !DEFAULT_PREFERENCES.alerts.email } }, true)
    expect(done).toEqual({ team: true, alerts: true, spoiler: true })
  })

  it("names the Growth Engine in the Analytics choice, in both languages", () => {
    expect(getDictionary("en").consent.analyticsNote).toMatch(/Flacron Growth Engine/)
    expect(getDictionary("fr").consent.analyticsNote).toMatch(/Flacron Growth Engine/)
  })

  it("allows the Growth Engine origin in the CSP", () => {
    const config = readFileSync("next.config.mjs", "utf8")
    expect(config).toContain(`const GROWTH_ENGINE = "${GROWTH_ENGINE.endpoint}"`)
    expect(config).toMatch(/script-src[^\n]*\$\{GROWTH_ENGINE\}/)
    expect(config).toMatch(/connect-src[^\n]*\$\{GROWTH_ENGINE\}/)
  })
})
