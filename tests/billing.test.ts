// Synthetic Stripe objects for isolated tests only.
import { describe, expect, it } from "vitest"
import type Stripe from "stripe"
import { computeAccess, type EntitlementRecord } from "@/lib/billing/entitlements"
import { PLANS, planForPriceId, priceIdFor } from "@/lib/billing/plans"
import { assertAllowedStripeKey } from "@/lib/billing/stripe-client"
import {
  processStripeEvent,
  shouldReplaceEntitlement,
  type BillingStore,
  type EventMutation,
} from "@/lib/billing/webhook-core"

const env = {
  STRIPE_PRICE_PLUS_MONTHLY: "price_plus_m",
  STRIPE_PRICE_PLUS_ANNUAL: "price_plus_y",
  STRIPE_PRICE_PREMIUM_MONTHLY: "price_prem_m",
  STRIPE_PRICE_PREMIUM_ANNUAL: "price_prem_y",
}

function memoryStore() {
  const processed = new Set<string>()
  const entitlements = new Map<string, EntitlementRecord>()
  const quarantine: EventMutation["quarantine"][] = []
  const ledger: NonNullable<EventMutation["ledger"]>[] = []
  const store: BillingStore = {
    async commitEvent(event, mutation) {
      if (processed.has(event.id)) return { duplicate: true }
      processed.add(event.id)
      if (mutation.entitlement) {
        const current = entitlements.get(mutation.entitlement.uid)
        if (shouldReplaceEntitlement(current, mutation.entitlement)) entitlements.set(mutation.entitlement.uid, mutation.entitlement)
      }
      if (mutation.quarantine) quarantine.push(mutation.quarantine)
      if (mutation.ledger) ledger.push(mutation.ledger)
      return { duplicate: false }
    },
  }
  return { store, entitlements, quarantine, ledger, processed }
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

const deps = (store: BillingStore, sub: Stripe.Subscription) => ({ store, retrieveSubscription: async () => sub, env })

describe("plan matrix", () => {
  it("matches the specification prices and limits", () => {
    expect(PLANS.plus).toMatchObject({ monthlyPriceUsd: 6.99, annualPriceUsd: 59.99, assistantRequestsPerMonth: 100 })
    expect(PLANS.premium).toMatchObject({ monthlyPriceUsd: 12.99, annualPriceUsd: 119.99, assistantRequestsPerMonth: 300 })
    expect(PLANS.free).toMatchObject({ monthlyPriceUsd: 0, favoritesLimit: 5, assistantRequestsPerMonth: 5 })
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

  it("records a refund only for an invoice this app owns", async () => {
    const charge = { id: "ch_1", metadata: {}, amount_refunded: 699, currency: "usd", invoice: "in_1" }
    const owned = memoryStore()
    const a = await processStripeEvent(event("charge.refunded", charge), { ...deps(owned.store, subscription()), ownsInvoice: async () => true })
    expect(a).toBe("applied")
    const foreign = memoryStore()
    const b = await processStripeEvent(event("charge.refunded", charge), { ...deps(foreign.store, subscription()), ownsInvoice: async () => false })
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
    expect(computeAccess(null).plan).toBe("free")
  })
  it("keeps access until the end of a canceled period, then ends it", () => {
    expect(computeAccess(record({ cancelAtPeriodEnd: true }), 999)).toMatchObject({ plan: "plus", state: "canceling" })
    expect(computeAccess(record({ cancelAtPeriodEnd: true }), 1000).plan).toBe("free")
  })
  it("applies the past-due grace cutoff", () => {
    expect(computeAccess(record({ status: "past_due" }), 1000 + day).state).toBe("past_due")
    expect(computeAccess(record({ status: "past_due" }), 1000 + 4 * day).plan).toBe("free")
  })
  it.each(["unpaid", "canceled", "incomplete", "incomplete_expired", "paused"] as const)("gives no paid access for %s", (status) => {
    expect(computeAccess(record({ status }), 500).plan).toBe("free")
  })
  it("expires an active record whose renewal never arrived", () => {
    expect(computeAccess(record({}), 1000 + 4 * day).plan).toBe("free")
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
