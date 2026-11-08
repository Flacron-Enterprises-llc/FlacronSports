import type Stripe from "stripe"

// Flacron Growth Engine (FCGE) funnel hand-off for subscription checkout.
//
// Webinar and giveaway offers live in the Growth Engine, not in this app. An offer
// link opens FlacronSport with `?code=<OFFER>&fcge_ref=<ref>`; the browser keeps both
// for the session and sends them with the checkout request. Here we:
//   - stamp `fcge_ref` on the Checkout Session and subscription metadata, so the
//     Growth Engine (which receives this account's Stripe webhooks and filters them by
//     app_id) credits the webinar or giveaway that made the sale;
//   - apply the offer code when it is a live Stripe promotion code that belongs to
//     this app (FCGE mirrors its offer codes into Stripe tagged with our app_id);
//     otherwise let the buyer type a code on the Stripe Checkout page.
// Nothing about a specific offer is configured in this app.

const FCGE_REF = /^[A-Za-z0-9_\-.]{10,400}$/
const PROMO_CODE = /^[A-Z0-9][A-Z0-9_-]{1,39}$/

export function isValidFcgeRef(value: unknown): value is string {
  return typeof value === "string" && FCGE_REF.test(value)
}

export function normalizePromoCode(value: unknown): string | null {
  if (typeof value !== "string") return null
  const code = value.trim().toUpperCase()
  return PROMO_CODE.test(code) ? code : null
}

type Tagged = { metadata?: Stripe.Metadata | null } | null | undefined

/** Tagged for another product on the shared account (or not tagged at all): never apply it here. */
export function belongsToApp(promotionCode: Tagged & { coupon?: Tagged }, appId: string): boolean {
  const tagged = [promotionCode?.metadata, promotionCode?.coupon?.metadata].map((metadata) => metadata?.app_id || null).filter(Boolean)
  return tagged.length > 0 && tagged.every((id) => id === appId)
}

export type CheckoutDiscount =
  | { options: { discounts: { promotion_code: string }[] }; appliedCode: string }
  | { options: { allow_promotion_codes: true }; appliedCode: null }

const OPEN_FIELD: CheckoutDiscount = { options: { allow_promotion_codes: true }, appliedCode: null }

/**
 * Checkout options for an optional offer code: either the code applied up front, or
 * Stripe's own code field. Stripe accepts only one of the two. A lookup failure never
 * breaks checkout.
 */
export async function resolveCheckoutDiscount(stripe: Pick<Stripe, "promotionCodes">, rawCode: unknown, appId: string): Promise<CheckoutDiscount> {
  const code = normalizePromoCode(rawCode)
  if (!code) return OPEN_FIELD
  try {
    const { data } = await stripe.promotionCodes.list({ code, active: true, limit: 1, expand: ["data.coupon"] })
    const promotionCode = data?.[0] as (Stripe.PromotionCode & { coupon?: Stripe.Coupon }) | undefined
    if (promotionCode?.coupon?.valid && belongsToApp(promotionCode, appId)) {
      return { options: { discounts: [{ promotion_code: promotionCode.id }] }, appliedCode: code }
    }
  } catch (error) {
    console.warn("[checkout] promotion code lookup failed:", (error as Error)?.message)
  }
  return OPEN_FIELD
}

/** Metadata fields the Growth Engine reads from the session and the subscription. */
export function funnelMetadata({ fcgeRef, appliedCode }: { fcgeRef?: unknown; appliedCode?: string | null } = {}): Record<string, string> {
  return {
    ...(isValidFcgeRef(fcgeRef) ? { fcge_ref: fcgeRef } : {}),
    ...(appliedCode ? { promo_code: appliedCode } : {}),
  }
}

/**
 * Stripe rejects a session whose up-front discount doesn't fit the price (a coupon
 * limited to other products, say); checkout then falls back to the plain code field.
 */
export function isDiscountRejection(error: unknown): boolean {
  const { type, param } = (error ?? {}) as { type?: string; param?: string }
  return type === "StripeInvalidRequestError" && typeof param === "string" && param.startsWith("discounts")
}
