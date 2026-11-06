// Synthetic Stripe objects for isolated tests only.
import { afterEach, describe, expect, it, vi } from "vitest"
import type Stripe from "stripe"

vi.mock("@/lib/firebase-admin", () => ({ getAdminAuth: () => null, getAdminDb: () => null }))

import { askAssistant } from "@/lib/assistant/service"
import { answerQuestion, normalize, type AssistantSources } from "@/lib/assistant/engine"
import {
  addonForPriceId, addonOnSale, ADDONS, applyPurchaseRefund, buildPurchase, creditsLeft, priceIdForAddon, resolvePurchaseGrant,
  type AddonSku, type BillingPurchase,
} from "@/lib/billing/addons"
import { allowancePeriod, consumeAssistantRequest, consumePurchasedCredit, readAssistantBalance, restoreCredit } from "@/lib/billing/allowance"
import { computeAccess, withDayPass, type EntitlementRecord } from "@/lib/billing/entitlements"
import { PLANS, planForPriceId, priceIdFor } from "@/lib/billing/plans"
import { assertAllowedStripeKey } from "@/lib/billing/stripe-client"
import {
  processStripeEvent,
  shouldReplaceEntitlement,
  type BillingStore,
  type EventMutation,
} from "@/lib/billing/webhook-core"
import { exportMatchSummary } from "@/lib/exports/service"
import type { EventFeed, SportEvent } from "@/lib/sports/types"
import { fakeDb } from "./fake-db"

const env = {
  STRIPE_PRICE_PLUS_MONTHLY: "price_plus_m",
  STRIPE_PRICE_PLUS_ANNUAL: "price_plus_y",
  STRIPE_PRICE_PREMIUM_MONTHLY: "price_prem_m",
  STRIPE_PRICE_PREMIUM_ANNUAL: "price_prem_y",
  STRIPE_PRICE_ASSISTANT_100: "price_assistant",
  STRIPE_PRICE_DAY_PASS: "price_day",
  STRIPE_PRICE_ROOM_PASS: "price_room",
  STRIPE_PRICE_EXPORT_PACK: "price_export",
}

function memoryStore() {
  const processed = new Set<string>()
  const entitlements = new Map<string, EntitlementRecord>()
  const quarantine: EventMutation["quarantine"][] = []
  const ledger: NonNullable<EventMutation["ledger"]>[] = []
  const purchases = new Map<string, BillingPurchase>()
  const refunds = new Map<string, { full: boolean; refundedAtUTC: string }>()
  const store: BillingStore = {
    async commitEvent(event, mutation) {
      if (processed.has(event.id)) return { duplicate: true }
      processed.add(event.id)
      if (mutation.entitlement) {
        const current = entitlements.get(mutation.entitlement.uid)
        if (shouldReplaceEntitlement(current, mutation.entitlement)) entitlements.set(mutation.entitlement.uid, mutation.entitlement)
      }
      const { purchase, purchaseRefund } = mutation
      if (purchase) {
        const granted = resolvePurchaseGrant(purchases.get(purchase.purchaseId), purchase, {
          refund: refunds.get(purchase.stripeChargeId ?? ""),
          otherDayPasses: [...purchases.values()].filter((item) => item.sku === "day_pass"),
        })
        if (granted) purchases.set(granted.purchaseId, granted)
      }
      if (purchaseRefund) {
        const target = [...purchases.values()].find((item) => item.verifiedPaymentId === purchaseRefund.paymentId)
        if (target) purchases.set(target.purchaseId, applyPurchaseRefund(target, purchaseRefund))
      }
      if (mutation.quarantine) quarantine.push(mutation.quarantine)
      if (mutation.ledger) {
        ledger.push(mutation.ledger)
        if (mutation.ledger.collection === "billing_refunds") {
          const { fullyRefunded, refundedAt } = mutation.ledger.data as { fullyRefunded: boolean; refundedAt: number }
          refunds.set(mutation.ledger.id, { full: fullyRefunded, refundedAtUTC: new Date(refundedAt * 1000).toISOString() })
        }
      }
      return { duplicate: false }
    },
  }
  return { store, entitlements, quarantine, ledger, processed, purchases }
}

function subscription(overrides: Record<string, unknown> = {}): Stripe.Subscription {
  return {
    id: "sub_1",
    customer: "cus_1",
    status: "active",
    cancel_at_period_end: false,
    metadata: { app_id: "flacron-sport", firebase_uid: "user-a" },
    items: { data: [{ price: { id: "price_plus_m" }, current_period_end: 2_000_000 }] },
    ...overrides,
  } as unknown as Stripe.Subscription
}

function event(type: string, object: unknown, overrides: Record<string, unknown> = {}): Stripe.Event {
  return { id: "evt_1", type, created: 1000, livemode: false, data: { object }, ...overrides } as unknown as Stripe.Event
}

const retrieveCheckoutSession = async (id: string) =>
  ({
    id,
    amount_total: 499,
    currency: "usd",
    payment_intent: { id: "pi_1", latest_charge: "ch_1" },
    line_items: { data: [{ quantity: 1, price: { id: "price_assistant" } }] },
  }) as unknown as Stripe.Checkout.Session

const deps = (store: BillingStore, sub: Stripe.Subscription) => ({ store, retrieveSubscription: async () => sub, retrieveCheckoutSession, env })

describe("plan matrix", () => {
  it("matches the specification prices and limits", () => {
    expect(PLANS.plus).toMatchObject({ monthlyPriceUsd: 29.99, annualPriceUsd: 299.99, assistantRequestsPerMonth: 100 })
    expect(PLANS.premium).toMatchObject({ monthlyPriceUsd: 49.99, annualPriceUsd: 499.99, assistantRequestsPerMonth: 300 })
    expect(PLANS.basic).toMatchObject({ monthlyPriceUsd: 19.99, favoritesLimit: 5, assistantRequestsPerMonth: 5 })
  })

  it("maps only this app's prices", () => {
    expect(priceIdFor("plus", "annual", env)).toBe("price_plus_y")
    expect(planForPriceId("price_prem_m", env)).toEqual({ plan: "premium", interval: "monthly" })
    expect(planForPriceId("price_other_app", env)).toBeNull()
  })
})

describe("webhook isolation", () => {
  it("grants access for a verified subscription of this app", async () => {
    const m = memoryStore()
    const outcome = await processStripeEvent(event("customer.subscription.updated", subscription()), deps(m.store, subscription()))
    expect(outcome).toBe("applied")
    expect(m.entitlements.get("user-a")).toMatchObject({ plan: "plus", application_id: "flacron-sport" })
  })

  it.each([
    ["other app", { metadata: { app_id: "flacron-intel", firebase_uid: "user-a" } }, "other_application"],
    ["missing app id", { metadata: { firebase_uid: "user-a" } }, "missing_app_id"],
    ["missing uid", { metadata: { app_id: "flacron-sport" } }, "missing_firebase_uid"],
    ["foreign price", { items: { data: [{ price: { id: "price_x" }, current_period_end: 1 }] } }, "unknown_price"],
  ])("quarantines %s and grants nothing", async (_name, overrides, reason) => {
    const m = memoryStore()
    const sub = subscription(overrides)
    const outcome = await processStripeEvent(event("customer.subscription.updated", sub), deps(m.store, sub))
    expect(outcome).toBe("quarantined")
    expect(m.quarantine[0]?.reason).toBe(reason)
    expect(m.entitlements.size).toBe(0)
  })

  it("rejects live events while live billing is not approved", async () => {
    const m = memoryStore()
    const outcome = await processStripeEvent(event("customer.subscription.updated", subscription(), { livemode: true }), deps(m.store, subscription()))
    expect(outcome).toBe("quarantined")
    expect(m.entitlements.size).toBe(0)
  })

  it("does not grant from an unpaid checkout session", async () => {
    const m = memoryStore()
    const session = { mode: "subscription", payment_status: "unpaid", subscription: "sub_1" }
    const outcome = await processStripeEvent(event("checkout.session.completed", session), deps(m.store, subscription()))
    expect(outcome).toBe("ignored")
    expect(m.entitlements.size).toBe(0)
  })
})

describe("webhook idempotency and ordering", () => {
  it("treats a replayed event as a no-op", async () => {
    const m = memoryStore()
    const e = event("invoice.paid", { id: "in_1", amount_paid: 699, currency: "usd", parent: { subscription_details: { subscription: "sub_1" } } })
    expect(await processStripeEvent(e, deps(m.store, subscription()))).toBe("applied")
    expect(await processStripeEvent(e, deps(m.store, subscription()))).toBe("duplicate")
    expect(m.ledger).toHaveLength(1)
  })

  it("reads the subscription from older invoice payloads too", async () => {
    const m = memoryStore()
    const e = event("invoice.payment_failed", { id: "in_2", subscription: "sub_1" })
    expect(await processStripeEvent(e, deps(m.store, subscription()))).toBe("applied")
  })

  it("ignores an older event that arrives late", () => {
    const newer = { lastEventCreated: 2000, stripeSubscriptionId: "sub_1", status: "canceled" } as EntitlementRecord
    const older = { lastEventCreated: 1000, stripeSubscriptionId: "sub_1", status: "active" } as EntitlementRecord
    expect(shouldReplaceEntitlement(newer, older)).toBe(false)
  })

  it("does not let an ended subscription replace a different live one", () => {
    const live = { lastEventCreated: 1000, stripeSubscriptionId: "sub_new", status: "active" } as EntitlementRecord
    const ended = { lastEventCreated: 2000, stripeSubscriptionId: "sub_old", status: "canceled" } as EntitlementRecord
    expect(shouldReplaceEntitlement(live, ended)).toBe(false)
  })

  it("records a refund only for a customer this app owns", async () => {
    const charge = { id: "ch_1", metadata: {}, amount_refunded: 699, currency: "usd", customer: "cus_1" }
    const owned = memoryStore()
    const a = await processStripeEvent(event("charge.refunded", charge), { ...deps(owned.store, subscription()), ownsCustomer: async () => true })
    expect(a).toBe("applied")
    const foreign = memoryStore()
    const b = await processStripeEvent(event("charge.refunded", charge), { ...deps(foreign.store, subscription()), ownsCustomer: async () => false })
    expect(b).toBe("quarantined")
    expect(foreign.ledger).toHaveLength(0)
  })
})

describe("access computation", () => {
  const record = (overrides: Partial<EntitlementRecord>): EntitlementRecord => ({
    application_id: "flacron-sport", uid: "u", plan: "plus", interval: "monthly", status: "active",
    stripeCustomerId: "c", stripeSubscriptionId: "s", currentPeriodEnd: 1000, cancelAtPeriodEnd: false, lastEventCreated: 1,
    ...overrides,
  })
  const day = 86_400

  it("gives free access without a record", () => {
    expect(computeAccess(null).plan).toBe("none")
  })
  it("keeps access until the end of a canceled period, then ends it", () => {
    expect(computeAccess(record({ cancelAtPeriodEnd: true }), 999)).toMatchObject({ plan: "plus", state: "canceling" })
    expect(computeAccess(record({ cancelAtPeriodEnd: true }), 1000).plan).toBe("none")
  })
  it("applies the past-due grace cutoff", () => {
    expect(computeAccess(record({ status: "past_due" }), 1000 + day).state).toBe("past_due")
    expect(computeAccess(record({ status: "past_due" }), 1000 + 4 * day).plan).toBe("none")
  })
  it.each(["unpaid", "canceled", "incomplete", "incomplete_expired", "paused"] as const)("gives no paid access for %s", (status) => {
    expect(computeAccess(record({ status }), 500).plan).toBe("none")
  })
  it("expires an active record whose renewal never arrived", () => {
    expect(computeAccess(record({}), 1000 + 4 * day).plan).toBe("none")
  })
})

describe("stripe key guard", () => {
  it("accepts test keys and refuses live keys without approval", () => {
    expect(assertAllowedStripeKey("rk_test_x", {})).toBe("rk_test_x")
    expect(() => assertAllowedStripeKey("rk_live_x", {})).toThrow(/live/)
    expect(() => assertAllowedStripeKey("sk_live_x", {})).toThrow(/live/)
    expect(() => assertAllowedStripeKey(undefined, {})).toThrow()
  })
})

describe("add-on catalog", () => {
  it("matches the specification", () => {
    expect(ADDONS.assistant_100).toMatchObject({ priceUsd: 4.99, allowance: 100, validityHours: 720, unit: "assistant" })
    expect(ADDONS.day_pass).toMatchObject({ priceUsd: 1.99, allowance: 10, validityHours: 24, unit: "assistant" })
    expect(ADDONS.room_pass).toMatchObject({ priceUsd: 2.99, allowance: 1, validityHours: 168, unit: "room" })
    expect(ADDONS.export_pack).toMatchObject({ priceUsd: 2.99, allowance: 10, validityHours: 720, unit: "export" })
  })

  it("maps only this app's prices", () => {
    expect(priceIdForAddon("day_pass", env)).toBe("price_day")
    expect(addonForPriceId("price_room", env)?.sku).toBe("room_pass")
    expect(addonForPriceId("price_other_app", env)).toBeNull()
  })

  it("sells an add-on only when its feature is live", () => {
    expect(addonOnSale("assistant_100", env)).toBe(true)
    expect(addonOnSale("room_pass", env)).toBe(false)
    expect(addonOnSale("room_pass", { ...env, COMMUNITY_ENABLED: "true" })).toBe(true)
    expect(addonOnSale("export_pack", env)).toBe(true)
    expect(addonOnSale("assistant_100", {})).toBe(false)
  })
})

describe("add-on purchases", () => {
  const metadata = { app_id: "flacron-sport", firebase_uid: "user-a", sku: "assistant_100" }
  const session = (overrides: Record<string, unknown> = {}) => ({ id: "cs_1", mode: "payment", payment_status: "paid", metadata, ...overrides })
  const refund = (overrides: Record<string, unknown> = {}) => ({
    id: "ch_1", payment_intent: "pi_1", metadata, amount: 499, amount_refunded: 499, refunded: true, currency: "usd", customer: "cus_1", ...overrides,
  })
  const pay = (m: ReturnType<typeof memoryStore>, id = "evt_paid", overrides = {}) =>
    processStripeEvent(event("checkout.session.completed", session(overrides), { id }), deps(m.store, subscription()))
  const refundEvent = (m: ReturnType<typeof memoryStore>, overrides = {}, id = "evt_refund") =>
    processStripeEvent(event("charge.refunded", refund(overrides), { id, created: 2000 }), deps(m.store, subscription()))

  it("grants from the verified session and records the payment", async () => {
    const m = memoryStore()
    expect(await pay(m)).toBe("applied")
    expect(m.purchases.get("cs_1")).toMatchObject({
      purchaseId: "cs_1", verifiedPaymentId: "pi_1", stripeChargeId: "ch_1", sku: "assistant_100", uid: "user-a", allowance: 100, consumed: 0, status: "active",
      validFromUTC: new Date(1000 * 1000).toISOString(), expiresAtUTC: new Date((1000 + 720 * 3600) * 1000).toISOString(),
    })
    expect(m.ledger[0]).toMatchObject({ collection: "billing_payments", id: "cs_1", data: { kind: "addon", amountPaid: 499 } })
  })

  it("grants one purchase for a replayed event and for a second event on the same session", async () => {
    const m = memoryStore()
    await pay(m)
    expect(await pay(m)).toBe("duplicate")
    expect(await pay(m, "evt_paid_again")).toBe("applied")
    expect(m.purchases.size).toBe(1)
    expect(m.purchases.get("cs_1")?.consumed).toBe(0)
  })

  it("does not reset consumption when the same session is delivered again", () => {
    const addon = ADDONS.assistant_100
    const incoming = buildPurchase({ purchaseId: "cs_1", verifiedPaymentId: "pi_1", stripeChargeId: null, addon, uid: "u", paidAtSeconds: 1, livemode: false })
    expect(resolvePurchaseGrant({ ...incoming, consumed: 7 }, incoming)).toBeNull()
  })

  it("ignores an unpaid session", async () => {
    const m = memoryStore()
    expect(await pay(m, "evt_unpaid", { payment_status: "unpaid" })).toBe("ignored")
    expect(m.purchases.size).toBe(0)
  })

  it.each([
    ["other app", { metadata: { ...metadata, app_id: "flacron-intel" } }, "other_application"],
    ["missing app id", { metadata: { firebase_uid: "user-a", sku: "assistant_100" } }, "missing_app_id"],
    ["missing uid", { metadata: { app_id: "flacron-sport", sku: "assistant_100" } }, "missing_firebase_uid"],
    ["mismatched sku", { metadata: { ...metadata, sku: "day_pass" } }, "unknown_price"],
  ])("quarantines %s and grants nothing", async (_name, overrides, reason) => {
    const m = memoryStore()
    expect(await pay(m, "evt_bad", overrides)).toBe("quarantined")
    expect(m.quarantine[0]?.reason).toBe(reason)
    expect(m.purchases.size).toBe(0)
  })

  it.each([
    ["unknown price", { line_items: { data: [{ quantity: 1, price: { id: "price_other" } }] } }, "unknown_price"],
    ["wrong quantity", { line_items: { data: [{ quantity: 2, price: { id: "price_assistant" } }] } }, "unknown_price"],
    ["no payment", { payment_intent: null }, "missing_payment"],
  ])("quarantines a session with %s", async (_name, overrides, reason) => {
    const m = memoryStore()
    const retrieve = async (id: string) => ({ ...(await retrieveCheckoutSession(id)), ...overrides }) as Stripe.Checkout.Session
    const outcome = await processStripeEvent(event("checkout.session.completed", session()), { ...deps(m.store, subscription()), retrieveCheckoutSession: retrieve })
    expect(outcome).toBe("quarantined")
    expect(m.quarantine[0]?.reason).toBe(reason)
    expect(m.purchases.size).toBe(0)
  })

  it("revokes an unused purchase on a full refund, using charge metadata for ownership", async () => {
    const m = memoryStore()
    await pay(m)
    expect(await refundEvent(m)).toBe("applied")
    expect(m.purchases.get("cs_1")).toMatchObject({ status: "revoked", supportReview: false })
    expect(creditsLeft(m.purchases.get("cs_1") as BillingPurchase, 1000)).toBe(0)
    expect(m.ledger.at(-1)).toMatchObject({ collection: "billing_refunds", id: "ch_1" })
  })

  it("flags a part-used purchase for support and blocks its remaining credits", async () => {
    const m = memoryStore()
    await pay(m)
    m.purchases.set("cs_1", { ...(m.purchases.get("cs_1") as BillingPurchase), consumed: 3 })
    await refundEvent(m)
    expect(m.purchases.get("cs_1")).toMatchObject({ status: "flagged", supportReview: true, consumed: 3 })
    expect(creditsLeft(m.purchases.get("cs_1") as BillingPurchase, 1000)).toBe(0)
  })

  it("keeps a purchase usable on a partial refund but asks support to look", async () => {
    const m = memoryStore()
    await pay(m)
    await refundEvent(m, { refunded: false, amount_refunded: 100 })
    expect(m.purchases.get("cs_1")).toMatchObject({ status: "active", supportReview: true })
  })

  it("is unchanged by a repeated refund event", async () => {
    const m = memoryStore()
    await pay(m)
    await refundEvent(m)
    const first = m.purchases.get("cs_1")
    await refundEvent(m, {}, "evt_refund_again")
    expect(m.purchases.get("cs_1")).toEqual(first)
  })

  it("does not grant usable credits when the refund event arrives first", async () => {
    const m = memoryStore()
    await refundEvent(m)
    await pay(m)
    expect(m.purchases.get("cs_1")?.status).toBe("revoked")
  })

  it("quarantines a refund for another app's charge", async () => {
    const m = memoryStore()
    await pay(m)
    expect(await refundEvent(m, { metadata: { app_id: "flacron-intel" } })).toBe("quarantined")
    expect(m.purchases.get("cs_1")?.status).toBe("active")
  })

  it("marks a second overlapping day pass for support instead of stacking it", async () => {
    const m = memoryStore()
    const dayPassLine = { line_items: { data: [{ quantity: 1, price: { id: "price_day" } }] } }
    const retrieve = async (id: string) => ({ ...(await retrieveCheckoutSession(id)), ...dayPassLine }) as Stripe.Checkout.Session
    const dep = { ...deps(m.store, subscription()), retrieveCheckoutSession: retrieve }
    const dayMeta = { ...metadata, sku: "day_pass" }
    await processStripeEvent(event("checkout.session.completed", session({ id: "cs_a", metadata: dayMeta }), { id: "e_a" }), dep)
    await processStripeEvent(event("checkout.session.completed", session({ id: "cs_b", metadata: dayMeta }), { id: "e_b", created: 1500 }), dep)
    expect(m.purchases.get("cs_a")?.status).toBe("active")
    expect(m.purchases.get("cs_b")).toMatchObject({ status: "conflict", supportReview: true })
  })
})

const purchase = (id: string, sku: AddonSku, paidAtSeconds: number, overrides: Partial<BillingPurchase> = {}): BillingPurchase => ({
  ...buildPurchase({ purchaseId: id, verifiedPaymentId: `pi_${id}`, stripeChargeId: null, addon: ADDONS[sku], uid: "u", paidAtSeconds, livemode: false }),
  ...overrides,
})

describe("day pass access", () => {
  const pass = purchase("p", "day_pass", 1000)
  const expiry = 1000 + 24 * 3600
  const free = computeAccess(null)

  it("gives Premium until expiry and then falls back", () => {
    expect(withDayPass(free, pass, expiry - 1)).toMatchObject({ plan: "premium", dayPassExpiresAtUTC: pass.expiresAtUTC, currentPeriodEnd: null })
    expect(withDayPass(free, pass, expiry).plan).toBe("none")
  })
  it("gives nothing for a revoked pass or another product", () => {
    expect(withDayPass(free, { ...pass, status: "revoked" }, 1500).plan).toBe("none")
    expect(withDayPass(free, purchase("q", "assistant_100", 1000), 1500).plan).toBe("none")
  })
  it("lifts Plus to Premium without touching a Premium subscription", () => {
    const paid = { plan: "premium", state: "active", interval: "monthly", currentPeriodEnd: 9, cancelAtPeriodEnd: false } as const
    expect(withDayPass(paid, pass, 1500)).toEqual(paid)
    expect(withDayPass({ ...paid, plan: "plus" }, pass, 1500).plan).toBe("premium")
  })
})

describe("allowances", () => {
  const nov = new Date("2026-11-05T12:00:00Z")
  const novSeconds = Math.floor(nov.getTime() / 1000)
  const seed = (...purchases: BillingPurchase[]) => {
    const fake = fakeDb()
    for (const item of purchases) fake.put(`billing_purchases/${item.purchaseId}`, item)
    return fake
  }

  it("spends plan requests first, then the credit that expires soonest", async () => {
    const { db, docs } = seed(purchase("later", "assistant_100", novSeconds), purchase("sooner", "day_pass", novSeconds))
    const sources = []
    for (let index = 0; index < 13; index += 1) {
      const { ticket } = await consumeAssistantRequest(db, "u", 2, nov)
      sources.push(ticket.purchaseId ?? ticket.source)
    }
    expect(sources.slice(0, 2)).toEqual(["plan", "plan"])
    expect(sources.slice(2, 12)).toEqual(Array(10).fill("sooner"))
    expect(sources[12]).toBe("later")
    expect(docs.get("billing_purchases/later")?.consumed).toBe(1)
  })

  it("skips expired and revoked credits", async () => {
    const expired = purchase("old", "assistant_100", novSeconds - 31 * 86_400)
    const revoked = purchase("gone", "assistant_100", novSeconds, { status: "revoked" })
    const { db } = seed(expired, revoked)
    await expect(consumeAssistantRequest(db, "u", 0, nov)).rejects.toMatchObject({ code: "allowance_exhausted" })
    expect((await readAssistantBalance(db, "u", 0, nov)).remaining).toBe(0)
  })

  it("reports remaining requests", async () => {
    const { db } = seed(purchase("p", "assistant_100", novSeconds))
    const { balance } = await consumeAssistantRequest(db, "u", 5, nov)
    expect(balance).toMatchObject({ included: { limit: 5, used: 1, remaining: 4 }, purchased: 100, remaining: 104 })
    expect(balance.credits[0]).toMatchObject({ purchaseId: "p", remaining: 100 })
  })

  it("cannot go negative under concurrent use", async () => {
    const { db, docs } = seed(purchase("p", "assistant_100", novSeconds, { allowance: 3 }))
    const results = await Promise.allSettled(Array.from({ length: 25 }, () => consumeAssistantRequest(db, "u", 5, nov)))
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(8)
    expect(docs.get(`assistant_usage/u_${allowancePeriod(nov)}`)?.used).toBe(5)
    expect(docs.get("billing_purchases/p")?.consumed).toBe(3)
  })

  it("resets monthly for an annual subscriber without any billing event", async () => {
    const { db } = seed()
    const annualPlus = computeAccess({
      application_id: "flacron-sport", uid: "u", plan: "plus", interval: "annual", status: "active", stripeCustomerId: "c",
      stripeSubscriptionId: "s", currentPeriodEnd: novSeconds + 200 * 86_400, cancelAtPeriodEnd: false, lastEventCreated: 1,
    }, novSeconds)
    const limit = PLANS[annualPlus.plan].assistantRequestsPerMonth
    expect(limit).toBe(100)
    for (let index = 0; index < limit; index += 1) await consumeAssistantRequest(db, "u", limit, nov)
    await expect(consumeAssistantRequest(db, "u", limit, nov)).rejects.toMatchObject({ code: "allowance_exhausted" })

    const dec = new Date("2026-12-01T00:00:00Z")
    expect(allowancePeriod(dec)).toBe("2026-12")
    const { balance } = await consumeAssistantRequest(db, "u", limit, dec)
    expect(balance.included).toEqual({ limit: 100, used: 1, remaining: 99 })
  })

  it("restores to the period the request came from", async () => {
    const { db, docs } = seed()
    const { ticket } = await consumeAssistantRequest(db, "u", 5, nov)
    await restoreCredit(db, ticket)
    expect(docs.get("assistant_usage/u_2026-11")?.used).toBe(0)
  })

  it("restores a purchased credit to its own purchase", async () => {
    const { db, docs } = seed(purchase("p", "assistant_100", novSeconds))
    const { ticket } = await consumeAssistantRequest(db, "u", 0, nov)
    expect(docs.get("billing_purchases/p")?.consumed).toBe(1)
    await restoreCredit(db, ticket)
    expect(docs.get("billing_purchases/p")?.consumed).toBe(0)
  })

  it("keeps unexpired purchases after a plan ends", async () => {
    const { db } = seed(purchase("p", "assistant_100", novSeconds))
    const lapsed = PLANS[computeAccess(null).plan].assistantRequestsPerMonth
    expect((await readAssistantBalance(db, "u", lapsed, nov)).remaining).toBe(100)
  })

  it("does not let a downgrade report negative plan requests", async () => {
    const { db, put } = fakeDb()
    put("assistant_usage/u_2026-11", { uid: "u", period: "2026-11", used: 150 })
    expect((await readAssistantBalance(db, "u", 100, nov)).included.remaining).toBe(0)
  })

  it("spends one export credit only after generation succeeds", async () => {
    const { db, docs } = seed(purchase("p", "export_pack", novSeconds))
    const fixture = { id: "tsdb-1", participants: [{ name: "A" }, { name: "B" }], competition: { name: "L" }, score: { kind: "none" }, status: "scheduled", scheduledStartUTC: null, venue: null } as unknown as SportEvent
    await expect(exportMatchSummary(db, { uid: "u", event: fixture, render: async () => { throw new Error("render failed") } }, nov)).rejects.toThrow("render failed")
    expect(docs.get("billing_purchases/p")?.consumed).toBe(0)
    await exportMatchSummary(db, { uid: "u", event: fixture, render: async () => new Uint8Array([1]) }, nov)
    expect(docs.get("billing_purchases/p")?.consumed).toBe(1)
  })

  it("refuses an export without credits and never renders", async () => {
    const { db } = seed()
    let rendered = false
    const render = async () => { rendered = true; return new Uint8Array() }
    await expect(exportMatchSummary(db, { uid: "u", event: {} as SportEvent, render }, nov)).rejects.toMatchObject({ code: "allowance_exhausted" })
    expect(rendered).toBe(false)
    await expect(consumePurchasedCredit(db, "u", "export", nov)).rejects.toMatchObject({ code: "allowance_exhausted" })
  })
})

describe("sports assistant", () => {
  const now = new Date("2026-11-05T12:00:00Z")
  const match = (overrides: Partial<SportEvent> = {}) => ({
    id: "tsdb-1", sportId: "football", eventType: "match", participantType: "team",
    participants: [{ id: "1", name: "Arsenal", role: "home", badgeUrl: null }, { id: "2", name: "Chelsea", role: "away", badgeUrl: null }],
    competition: { id: "9", name: "English Premier League", country: "England" },
    scheduledStartUTC: "2026-11-05T18:00:00.000Z", status: "scheduled", providerStatus: "NS", score: { kind: "none" }, venue: null,
    provider: { name: "TheSportsDB", eventId: "1" }, sourceUpdatedAt: null, coverageFlags: { liveScores: false, statistics: false, video: false },
    ...overrides,
  }) as SportEvent
  const feed = (events: SportEvent[], overrides: Partial<EventFeed> = {}): EventFeed => ({ state: "ok", events, source: "TheSportsDB", fetchedAt: now.toISOString(), limited: false, ...overrides })
  const sources = (events: SportEvent[], overrides: Partial<EventFeed> = {}): AssistantSources => ({
    getEvents: async () => feed(events, overrides),
    getTeamFixtures: async () => ({ team: null, recent: [], feed: feed([]) }),
  })
  const finished = match({ status: "finished", score: { kind: "team", home: 2, away: 1 } })

  it("answers today's fixtures for a team and a competition, with source and time", async () => {
    const team = await answerQuestion("Arsenal fixtures today", "en", sources([match()]), now)
    expect(team).toMatchObject({ kind: "fixtures", charged: true, asOfUTC: now.toISOString() })
    expect(team.items[0]).toMatchObject({ matchId: "tsdb-1", score: null })
    expect(team.sources[0].label).toBe("Verified match data")
    expect((await answerQuestion("matchs du jour premier league", "fr", sources([match()]), now)).kind).toBe("fixtures")
  })

  it("answers a team's latest result from the team lookup", async () => {
    const lookup = { ...sources([]), getTeamFixtures: async () => ({ team: { name: "Arsenal" }, recent: [finished], feed: feed([]) }) }
    const answer = await answerQuestion("Arsenal latest result", "en", lookup, now)
    expect(answer).toMatchObject({ kind: "result", charged: true })
    expect(answer.items[0].score).toBe("2 - 1")
  })

  it("falls back to recent daily feeds for a partial team name", async () => {
    expect((await answerQuestion("resultat arsenal", "fr", sources([finished]), now)).kind).toBe("result")
  })

  it("never shows a live or missing score as a result", async () => {
    const answer = await answerQuestion("Arsenal last result", "en", sources([match({ status: "live", score: { kind: "team", home: 1, away: 0 } })]), now)
    expect(answer.kind).toBe("no_data")
    expect(answer.items).toHaveLength(0)
    const scoreless = await answerQuestion("Arsenal last result", "en", sources([match({ status: "finished" })]), now)
    expect(scoreless.items[0].score).toBeNull()
  })

  it("explains a rule from the curated reference in both languages", async () => {
    const en = await answerQuestion("What is offside?", "en", sources([]), now)
    expect(en).toMatchObject({ kind: "rule", charged: true })
    expect(en.sources[0].url).toMatch(/^https:/)
    expect((await answerQuestion("C'est quoi le hors-jeu ?", "fr", sources([]), now)).text).toContain("hors-jeu")
  })

  it.each(["Who will win Arsenal vs Chelsea?", "Give me betting tips", "Will Arsenal win tonight", "qui va gagner ce soir", "un pronostic pour Arsenal"])("refuses to predict: %s", async (question) => {
    expect(await answerQuestion(question, "en", sources([match()]), now)).toMatchObject({ kind: "declined", charged: false, items: [] })
  })

  it.each(["Paris Saint-Germain fixtures today", "Cote d'Ivoire latest result"])("does not read a team name as betting: %s", async (question) => {
    expect((await answerQuestion(question, "en", sources([]), now)).kind).not.toBe("declined")
  })

  it("admits what it does not know, and discloses a limited feed", async () => {
    expect(await answerQuestion("meaning of life", "en", sources([]), now)).toMatchObject({ kind: "unknown", charged: false })
    const none = await answerQuestion("Barcelona fixtures today", "en", sources([match()], { limited: true }), now)
    expect(none).toMatchObject({ kind: "no_data", charged: true, items: [] })
    expect(none.notes[0]).toMatch(/Only some fixtures/)
  })

  it("does not mistake a stale or failed feed for an answer", async () => {
    const down = await answerQuestion("Arsenal fixtures today", "en", sources([], { state: "unavailable" }), now)
    expect(down).toMatchObject({ kind: "unavailable", charged: false })
  })

  it("normalizes accents and punctuation", () => {
    expect(normalize("Qu'est-ce que le HORS-JEU ?")).toBe("qu'est-ce que le hors-jeu")
  })

  const ask = (db: ReturnType<typeof fakeDb>["db"], question: string, source: AssistantSources) =>
    askAssistant({ db, uid: "u", includedLimit: 5, question, locale: "en", sources: source, now })

  it("charges an answered question", async () => {
    const { db, docs } = fakeDb()
    await ask(db, "What is offside?", sources([]))
    expect(docs.get("assistant_usage/u_2026-11")?.used).toBe(1)
  })

  it("restores the credit when processing fails", async () => {
    const { db, docs } = fakeDb()
    const broken = { ...sources([]), getEvents: async () => { throw new Error("provider down") } }
    await expect(ask(db, "Arsenal fixtures today", broken)).rejects.toMatchObject({ code: "assistant_unavailable" })
    expect(docs.get("assistant_usage/u_2026-11")?.used).toBe(0)
  })

  it("does not count a question it could not answer", async () => {
    const { db } = fakeDb()
    const result = await ask(db, "Who will win tonight?", sources([]))
    expect(result.balance.included.used).toBe(0)
  })

  it("does not lift a day pass holder to Premium's 300 requests", async () => {
    const { db, put } = fakeDb()
    put("billing_purchases/p", purchase("p", "day_pass", Math.floor(now.getTime() / 1000)))
    const result = await askAssistant({ db, uid: "u", includedLimit: PLANS.basic.assistantRequestsPerMonth, question: "What is offside?", locale: "en", sources: sources([]), now })
    expect(result.balance).toMatchObject({ included: { limit: 5, remaining: 4 }, purchased: 10 })
  })
})

afterEach(() => vi.unstubAllEnvs())
