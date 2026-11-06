// One-time add-ons (spec section 14). None renews and none grants broadcast rights.
// A purchase document is both the proof of payment and the running credit balance.

import { APP_ID } from "./plans"

export type AddonSku = "assistant_100" | "day_pass" | "room_pass" | "export_pack"
export type AllowanceUnit = "assistant" | "room" | "export"

export interface AddonDefinition {
  sku: AddonSku
  priceUsd: number
  priceEnv: string
  unit: AllowanceUnit
  allowance: number
  validityHours: number
}

export const ADDONS: Record<AddonSku, AddonDefinition> = {
  assistant_100: { sku: "assistant_100", priceUsd: 4.99, priceEnv: "STRIPE_PRICE_ASSISTANT_100", unit: "assistant", allowance: 100, validityHours: 720 },
  day_pass: { sku: "day_pass", priceUsd: 1.99, priceEnv: "STRIPE_PRICE_DAY_PASS", unit: "assistant", allowance: 10, validityHours: 24 },
  room_pass: { sku: "room_pass", priceUsd: 2.99, priceEnv: "STRIPE_PRICE_ROOM_PASS", unit: "room", allowance: 1, validityHours: 168 },
  export_pack: { sku: "export_pack", priceUsd: 2.99, priceEnv: "STRIPE_PRICE_EXPORT_PACK", unit: "export", allowance: 10, validityHours: 720 },
}

export const ROOM_PASS_PARTICIPANTS = 50

// pdf-lib is not a dependency, so exports cannot run and the pack must not be sold.
export const PDF_EXPORTS_LIVE = true

type Env = Record<string, string | undefined>

export function isAddonSku(value: unknown): value is AddonSku {
  return typeof value === "string" && value in ADDONS
}

export function priceIdForAddon(sku: AddonSku, env: Env = process.env): string | null {
  return env[ADDONS[sku].priceEnv] || null
}

/** Reverse lookup. A price outside this app's catalog returns null and grants nothing. */
export function addonForPriceId(priceId: string | null | undefined, env: Env = process.env): AddonDefinition | null {
  if (!priceId) return null
  return Object.values(ADDONS).find((addon) => env[addon.priceEnv] === priceId) ?? null
}

/**
 * Gates new sales only. A paid purchase is still honored by the webhook if a flag
 * was turned off between checkout and payment.
 */
export function addonOnSale(sku: AddonSku, env: Env = process.env): boolean {
  if (!priceIdForAddon(sku, env)) return false
  if (sku === "room_pass") return env.COMMUNITY_ENABLED === "true"
  if (sku === "export_pack") return PDF_EXPORTS_LIVE
  return true
}

/** flagged = refunded after some use; conflict = paid while another day pass was active. */
export type PurchaseStatus = "active" | "revoked" | "flagged" | "conflict"

/** Stored at billing_purchases/{purchaseId}, where purchaseId is the Checkout Session id. */
export interface BillingPurchase {
  application_id: string
  purchaseId: string
  verifiedPaymentId: string
  stripeChargeId: string | null
  sku: AddonSku
  uid: string
  unit: AllowanceUnit
  allowance: number
  consumed: number
  validFromUTC: string
  expiresAtUTC: string
  status: PurchaseStatus
  supportReview: boolean
  refundedAtUTC: string | null
  roomId: string | null
  livemode: boolean
}

export function buildPurchase(input: {
  purchaseId: string
  verifiedPaymentId: string
  stripeChargeId: string | null
  addon: AddonDefinition
  uid: string
  paidAtSeconds: number
  livemode: boolean
}): BillingPurchase {
  const { addon, paidAtSeconds } = input
  return {
    application_id: APP_ID,
    purchaseId: input.purchaseId,
    verifiedPaymentId: input.verifiedPaymentId,
    stripeChargeId: input.stripeChargeId,
    sku: addon.sku,
    uid: input.uid,
    unit: addon.unit,
    allowance: addon.allowance,
    consumed: 0,
    validFromUTC: new Date(paidAtSeconds * 1000).toISOString(),
    expiresAtUTC: new Date((paidAtSeconds + addon.validityHours * 3600) * 1000).toISOString(),
    status: "active",
    supportReview: false,
    refundedAtUTC: null,
    roomId: null,
    livemode: input.livemode,
  }
}

type Validity = Pick<BillingPurchase, "status" | "expiresAtUTC">

export function purchaseLive(purchase: Validity, nowMs: number): boolean {
  return purchase.status === "active" && nowMs < Date.parse(purchase.expiresAtUTC)
}

export function creditsLeft(purchase: BillingPurchase, nowMs: number): number {
  return purchaseLive(purchase, nowMs) ? Math.max(0, purchase.allowance - purchase.consumed) : 0
}

export function activeDayPass(purchases: BillingPurchase[], nowMs: number): BillingPurchase | null {
  return purchases.find((purchase) => purchase.sku === "day_pass" && purchaseLive(purchase, nowMs)) ?? null
}

export function hasLivePurchase(purchases: BillingPurchase[], unit: AllowanceUnit, nowMs: number): boolean {
  return purchases.some((purchase) => purchase.unit === unit && purchaseLive(purchase, nowMs))
}

export interface PurchaseRefund {
  full: boolean
  refundedAtUTC: string
}

/** A day pass spends time, not credits: Premium was open from payment even with no assistant request. */
function alreadyUsed(purchase: BillingPurchase, refundedAtUTC: string): boolean {
  if (purchase.consumed > 0) return true
  return purchase.sku === "day_pass" && purchase.status === "active" && Date.parse(refundedAtUTC) > Date.parse(purchase.validFromUTC)
}

/** Idempotent. A partial refund keeps the purchase usable and asks support to decide. */
export function applyPurchaseRefund(purchase: BillingPurchase, refund: PurchaseRefund): BillingPurchase {
  if (purchase.status === "revoked" || purchase.status === "flagged") return purchase
  if (!refund.full) return { ...purchase, supportReview: true, refundedAtUTC: refund.refundedAtUTC }
  const used = alreadyUsed(purchase, refund.refundedAtUTC)
  return { ...purchase, status: used ? "flagged" : "revoked", supportReview: used, refundedAtUTC: refund.refundedAtUTC }
}

/** Decides what a paid session writes. Runs inside the store's transaction. */
export function resolvePurchaseGrant(
  existing: BillingPurchase | null | undefined,
  incoming: BillingPurchase,
  context: { refund?: PurchaseRefund | null; otherDayPasses?: BillingPurchase[] } = {},
): BillingPurchase | null {
  if (existing) return null
  const overlap =
    incoming.sku === "day_pass" &&
    (context.otherDayPasses ?? []).some(
      (other) => other.purchaseId !== incoming.purchaseId && purchaseLive(other, Date.parse(incoming.validFromUTC)),
    )
  const granted: BillingPurchase = overlap ? { ...incoming, status: "conflict", supportReview: true } : incoming
  return context.refund ? applyPurchaseRefund(granted, context.refund) : granted
}
