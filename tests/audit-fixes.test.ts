// Synthetic Stripe objects, requests and stores for isolated tests only.
import { afterEach, describe, expect, it, vi } from "vitest"
import type Stripe from "stripe"
import { NextRequest } from "next/server"

const purchases: BillingPurchase[] = []
let plan = "none"

vi.mock("@/lib/firebase-admin", () => ({ getAdminAuth: () => null, getAdminDb: () => null }))
vi.mock("@/lib/billing/firestore-store", () => ({ getEffectiveAccess: async () => ({ plan }), getUserPurchases: async () => purchases }))

import { ApiError } from "@/lib/api-auth"
import { ADDONS, applyPurchaseRefund, buildPurchase, hasLivePurchase, type AddonSku, type BillingPurchase } from "@/lib/billing/addons"
import { computeAccess, type EntitlementRecord } from "@/lib/billing/entitlements"
import { settleOpenSessions } from "@/lib/billing/open-sessions"
import { applyPlanChange, planChangeChargesNow } from "@/lib/billing/plan-change"
import { requireSubscriber, requireSubscriberOrPurchase } from "@/lib/billing/require-plan"
import { processStripeEvent, type EventMutation } from "@/lib/billing/webhook-core"
import { sanctionUser } from "@/lib/community/moderation"
import { readSanction } from "@/lib/community/chat"
import { provenUnsent } from "@/lib/newsletter/digest"
import { clientIp, rateLimitClient } from "@/lib/rate-limit"
import { clearFeedCache, getEvent, getEvents } from "@/lib/sports/service"
import { GET as matchesRoute } from "@/app/api/matches/route"
import { middleware } from "@/middleware"
import { fakeDb } from "./fake-db"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  clearFeedCache()
  purchases.length = 0
  plan = "none"
})

const DAY = 86_400
const env = { STRIPE_PRICE_PLUS_MONTHLY: "price_plus_m" }

function subscription(id: string, overrides: Record<string, unknown> = {}): Stripe.Subscription {
  return {
    id, customer: "cus_1", status: "active", created: 100, cancel_at_period_end: false,
    metadata: { app_id: "flacron-sport", firebase_uid: "user-a" },
    items: { data: [{ price: { id: "price_plus_m" }, current_period_start: 1000, current_period_end: 1000 + 30 * DAY }] },
    ...overrides,
  } as unknown as Stripe.Subscription
}

function harness(subs: Stripe.Subscription[], overrides: Record<string, unknown> = {}) {
  const commits: EventMutation[] = []
  const canceled: string[] = []
  return {
    commits,
    canceled,
    deps: {
      store: { commitEvent: async (_event: unknown, mutation: EventMutation) => (commits.push(mutation), { duplicate: false }) },
      retrieveSubscription: async (id: string) => subs.find((item) => item.id === id) as Stripe.Subscription,
      retrieveCheckoutSession: async () => ({}) as Stripe.Checkout.Session,
      listSubscriptions: async () => subs,
      cancelSubscription: async (id: string) => void canceled.push(id),
      ownsCustomer: async () => true,
      env,
      ...overrides,
    },
  }
}

const stripeEvent = (type: string, object: unknown, created = 5000) =>
  ({ id: `evt_${Math.random()}`, type, created, livemode: false, data: { object } }) as unknown as Stripe.Event

describe("failed renewal", () => {
  const record = (overrides: Partial<EntitlementRecord>): EntitlementRecord => ({
    application_id: "flacron-sport", uid: "u", plan: "plus", interval: "monthly", status: "past_due", stripeCustomerId: "c",
    stripeSubscriptionId: "s", currentPeriodStart: 1000, currentPeriodEnd: 1000 + 30 * DAY, cancelAtPeriodEnd: false, lastEventCreated: 1,
    ...overrides,
  })

  it("does not read Stripe's rolled-forward period end as paid time", () => {
    const access = computeAccess(record({}), 1000 + DAY)
    expect(access).toMatchObject({ plan: "none", state: "past_due" })
    expect(computeAccess(record({}), 999).plan).toBe("plus")
  })
  it("resolves downward for a stored record with no period start", () => {
    expect(computeAccess(record({ currentPeriodStart: undefined }), 1000).plan).toBe("none")
  })
  it("stores the period start from Stripe", async () => {
    const sub = subscription("sub_1")
    const { commits, deps } = harness([sub])
    await processStripeEvent(stripeEvent("customer.subscription.updated", sub), deps)
    expect(commits[0].entitlement?.currentPeriodStart).toBe(1000)
  })
})

describe("plan changes", () => {
  const monthly = (name: "basic" | "plus" | "premium") => ({ plan: name, interval: "monthly" as const })
  const fakeStripe = (update: (id: string, params: Stripe.SubscriptionUpdateParams) => Promise<unknown>) =>
    ({ subscriptions: { retrieve: async () => ({ id: "sub_1", metadata: { app_id: "flacron-sport" }, items: { data: [{ id: "si_1" }] } }), update } }) as unknown as Pick<Stripe, "subscriptions">
  const record = { ...monthly("plus"), stripeSubscriptionId: "sub_1" }

  it("charges for a higher plan or a new interval, not a lower plan", () => {
    expect(planChangeChargesNow(monthly("plus"), monthly("premium"))).toBe(true)
    expect(planChangeChargesNow(monthly("plus"), { plan: "plus", interval: "annual" })).toBe(true)
    expect(planChangeChargesNow({ plan: "premium", interval: "annual" }, { plan: "plus", interval: "monthly" })).toBe(true)
    expect(planChangeChargesNow(monthly("premium"), monthly("basic"))).toBe(false)
  })
  it("invoices an upgrade at once and refuses an unpaid one", async () => {
    const update = vi.fn(async () => ({}))
    await applyPlanChange(fakeStripe(update), record, monthly("premium"), "price_new")
    expect(update).toHaveBeenCalledWith("sub_1", expect.objectContaining({ proration_behavior: "always_invoice", payment_behavior: "error_if_incomplete" }))
  })
  it("leaves a downgrade as a credit on the next invoice", async () => {
    const update = vi.fn(async (_id: string, _params: Stripe.SubscriptionUpdateParams) => ({}))
    await applyPlanChange(fakeStripe(update), record, monthly("basic"), "price_new")
    expect(update.mock.calls[0][1]).toMatchObject({ proration_behavior: "create_prorations" })
    expect(update.mock.calls[0][1].payment_behavior).toBeUndefined()
  })
  it("reports a declined upgrade clearly", async () => {
    const declined = fakeStripe(async () => { throw Object.assign(new Error("declined"), { statusCode: 402, type: "StripeCardError" }) })
    await expect(applyPlanChange(declined, record, monthly("premium"), "price_new")).rejects.toMatchObject({ status: 402, code: "payment_failed" })
  })
  it("does not disguise other Stripe failures as a declined card", async () => {
    const broken = fakeStripe(async () => { throw Object.assign(new Error("boom"), { statusCode: 500 }) })
    await expect(applyPlanChange(broken, record, monthly("premium"), "price_new")).rejects.toThrow("boom")
  })
})

const purchase = (sku: AddonSku, overrides: Partial<BillingPurchase> = {}, paidAtSeconds = Math.floor(Date.now() / 1000)): BillingPurchase => ({
  ...buildPurchase({ purchaseId: `cs_${sku}`, verifiedPaymentId: `pi_${sku}`, stripeChargeId: null, addon: ADDONS[sku], uid: "u", paidAtSeconds, livemode: false }),
  ...overrides,
})

describe("add-on access without a plan", () => {
  it("lets a live purchase of the matching unit through", async () => {
    purchases.push(purchase("export_pack"))
    await expect(requireSubscriberOrPurchase("u", "export")).resolves.toBeUndefined()
    await expect(requireSubscriberOrPurchase("u", "room")).rejects.toMatchObject({ code: "subscription_required" })
    await expect(requireSubscriber("u")).rejects.toBeInstanceOf(ApiError)
  })
  it("keeps a room pass open after its one room was created", () => {
    expect(hasLivePurchase([purchase("room_pass", { consumed: 1 })], "room", Date.now())).toBe(true)
  })
  it("does not count an expired or refunded purchase", async () => {
    purchases.push(purchase("export_pack", { status: "revoked" }), purchase("export_pack", {}, 1000))
    await expect(requireSubscriberOrPurchase("u", "export")).rejects.toMatchObject({ status: 402 })
  })
})

describe("subscription refunds", () => {
  const charge = (overrides = {}) => ({ id: "ch_1", metadata: {}, customer: "cus_1", payment_intent: "pi_1", amount: 2999, amount_refunded: 2999, refunded: true, currency: "usd", ...overrides })
  const invoice = (lineEnd: number) => ({ id: "in_1", parent: { subscription_details: { subscription: "sub_1" } }, lines: { data: [{ period: { end: lineEnd } }] } }) as unknown as Stripe.Invoice

  it("ends access in Stripe and here, and audits it, for the charge paying the current period", async () => {
    const { commits, canceled, deps } = harness([subscription("sub_1")], { invoiceForPayment: async () => invoice(9000) })
    expect(await processStripeEvent(stripeEvent("charge.refunded", charge()), deps)).toBe("applied")
    expect(canceled).toEqual(["sub_1"])
    expect(commits[0].entitlement).toMatchObject({ status: "canceled", cancelAtPeriodEnd: false, uid: "user-a" })
    expect(computeAccess(commits[0].entitlement, 6000).plan).toBe("none")
    expect(commits[0].audit).toMatchObject({ action: "billing.refund_ended_access", detail: { targetUid: "user-a", stripeChargeId: "ch_1" } })
    expect(commits[0].ledger?.collection).toBe("billing_refunds")
  })
  it("does not cancel twice when Stripe has already canceled", async () => {
    const { canceled, commits, deps } = harness([subscription("sub_1", { status: "canceled" })], { invoiceForPayment: async () => invoice(9000) })
    await processStripeEvent(stripeEvent("charge.refunded", charge()), deps)
    expect(canceled).toEqual([])
    expect(commits[0].audit?.action).toBe("billing.refund_ended_access")
  })
  it("leaves the paid current period alone when an old invoice is refunded", async () => {
    const { canceled, commits, deps } = harness([subscription("sub_1")], { invoiceForPayment: async () => invoice(4000) })
    await processStripeEvent(stripeEvent("charge.refunded", charge()), deps)
    expect(canceled).toEqual([])
    expect(commits[0].entitlement).toBeUndefined()
    expect(commits[0].audit?.action).toBe("billing.refund_past_period")
  })
  it("changes nothing on a partial refund or an add-on refund", async () => {
    const lookup = vi.fn(async () => invoice(9000))
    const { canceled, deps } = harness([subscription("sub_1")], { invoiceForPayment: lookup })
    await processStripeEvent(stripeEvent("charge.refunded", charge({ refunded: false, amount_refunded: 100 })), deps)
    await processStripeEvent(stripeEvent("charge.refunded", charge({ metadata: { app_id: "flacron-sport", sku: "day_pass" } })), deps)
    expect(lookup).not.toHaveBeenCalled()
    expect(canceled).toEqual([])
  })
  it("sends a refund it cannot link to review", async () => {
    const { commits, deps } = harness([], { invoiceForPayment: async () => null })
    await processStripeEvent(stripeEvent("charge.refunded", charge()), deps)
    expect(commits[0].quarantine?.reason).toBe("unlinked_refund")
  })
})

describe("two paid checkouts", () => {
  const paid = (id: string) => stripeEvent("checkout.session.completed", { mode: "subscription", payment_status: "paid", subscription: id })

  it("cancels the newer subscription and keeps the older entitlement", async () => {
    const older = subscription("sub_old", { created: 100 })
    const newer = subscription("sub_new", { created: 200 })
    const { canceled, commits, deps } = harness([older, newer])
    await processStripeEvent(paid("sub_new"), deps)
    expect(canceled).toEqual(["sub_new"])
    expect(commits[0].entitlement?.stripeSubscriptionId).toBe("sub_old")
    expect(commits[0].quarantine).toEqual({ reason: "duplicate_subscription", objectId: "sub_new" })
    expect(commits[0].audit?.action).toBe("billing.duplicate_subscription_canceled")
  })
  it("agrees whichever delivery arrives first, so at most one is canceled", async () => {
    const subs = [subscription("sub_a", { created: 100 }), subscription("sub_b", { created: 100 })]
    const { canceled, deps } = harness(subs)
    await processStripeEvent(paid("sub_a"), deps)
    await processStripeEvent(paid("sub_b"), deps)
    expect(canceled).toEqual(["sub_b"])
  })
  it("ignores a past-due subscription and another person's subscription", async () => {
    const rivals = [subscription("sub_due", { created: 1, status: "past_due" }), subscription("sub_x", { created: 1, metadata: { app_id: "flacron-sport", firebase_uid: "other" } })]
    const { canceled, deps } = harness([...rivals, subscription("sub_new", { created: 200 })])
    await processStripeEvent(paid("sub_new"), deps)
    expect(canceled).toEqual([])
  })
})

describe("open checkout sessions", () => {
  const session = (id: string, metadata: Record<string, string>, extra = {}) => ({ id, metadata, url: `https://pay.test/${id}`, mode: "subscription", ...extra })
  const stripe = (data: unknown[]) => {
    const expire = vi.fn(async () => ({}))
    return { expire, client: { checkout: { sessions: { list: async () => ({ data }), expire } } } as unknown as Pick<Stripe, "checkout"> }
  }
  const options = { kind: (item: Stripe.Checkout.Session) => item.mode === "subscription", same: (item: Stripe.Checkout.Session) => item.metadata?.plan === "plus" }

  it("reuses the same purchase and expires a different one", async () => {
    const { client, expire } = stripe([session("a", { app_id: "flacron-sport", plan: "premium" }), session("b", { app_id: "flacron-sport", plan: "plus" })])
    expect(await settleOpenSessions(client, "cus", options)).toBe("https://pay.test/b")
    expect(expire).toHaveBeenCalledTimes(1)
    expect(expire).toHaveBeenCalledWith("a")
  })
  it("never touches another app's session on the shared account", async () => {
    const { client, expire } = stripe([session("a", { app_id: "flacron-intel", plan: "plus" })])
    expect(await settleOpenSessions(client, "cus", options)).toBeNull()
    expect(expire).not.toHaveBeenCalled()
  })
})

describe("refunded day pass", () => {
  const at = (seconds: number) => new Date(seconds * 1000).toISOString()

  it("is flagged even with no assistant use, because Premium was already open", () => {
    const refunded = applyPurchaseRefund(purchase("day_pass", {}, 1000), { full: true, refundedAtUTC: at(4600) })
    expect(refunded).toMatchObject({ status: "flagged", supportReview: true })
  })
  it("still revokes a conflict pass, which gave nothing", () => {
    const refunded = applyPurchaseRefund(purchase("day_pass", { status: "conflict", supportReview: true }, 1000), { full: true, refundedAtUTC: at(4600) })
    expect(refunded).toMatchObject({ status: "revoked", supportReview: false })
  })
  it("still revokes an unused credit pack", () => {
    expect(applyPurchaseRefund(purchase("assistant_100", {}, 1000), { full: true, refundedAtUTC: at(4600) }).status).toBe("revoked")
  })
})

describe("client address", () => {
  const request = (forwarded?: string) => new Request("https://api.test/x", { headers: forwarded ? { "x-forwarded-for": forwarded } : {} })

  it("uses the entry API Gateway added, not one the caller wrote", () => {
    expect(clientIp(request("6.6.6.6, 9.9.9.9"))).toBe("9.9.9.9")
    expect(clientIp(request())).toBe("unknown")
  })
  it("gives each visitor behind Amplify their own limit", () => {
    const limits = { visitor: 2, shared: 100 }
    rateLimitClient(request("1.1.1.1, 8.8.8.8"), "t1", limits, 1000, 0)
    rateLimitClient(request("1.1.1.1, 8.8.8.8"), "t1", limits, 1000, 0)
    expect(() => rateLimitClient(request("1.1.1.1, 8.8.8.8"), "t1", limits, 1000, 0)).toThrow(ApiError)
    expect(() => rateLimitClient(request("2.2.2.2, 8.8.8.8"), "t1", limits, 1000, 0)).not.toThrow()
  })
  it("caps a caller forging a new visitor on every request", () => {
    const limits = { visitor: 1, shared: 3 }
    for (let index = 0; index < 3; index += 1) rateLimitClient(request(`10.0.0.${index}, 7.7.7.7`), "t2", limits, 1000, 0)
    expect(() => rateLimitClient(request("10.0.0.99, 7.7.7.7"), "t2", limits, 1000, 0)).toThrow(ApiError)
  })
  it("lets a forged visitor spend only its own budget", () => {
    const limits = { visitor: 1, shared: 100 }
    rateLimitClient(request("1.1.1.1, 5.5.5.5"), "t3", limits, 1000, 0)
    expect(() => rateLimitClient(request("1.1.1.1, 8.8.8.8"), "t3", limits, 1000, 0)).not.toThrow()
  })
})

describe("public feed limits", () => {
  const day = (offset: number) => new Date(Date.now() + offset * DAY * 1000).toISOString().slice(0, 10)

  it.each([[-40], [40]])("refuses a date %i days away before any provider call", async (offset) => {
    const provider = vi.fn(async () => new Response("{}"))
    vi.stubGlobal("fetch", provider)
    expect((await matchesRoute(new Request(`https://api.test/api/matches?date=${day(offset)}`))).status).toBe(400)
    expect(provider).not.toHaveBeenCalled()
  })
  it("refuses a date that does not exist", async () => {
    expect((await matchesRoute(new Request("https://api.test/api/matches?date=2026-13-45"))).status).toBe(400)
  })
  it("accepts today and the edges of the window", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ events: [] })))
    expect((await matchesRoute(new Request(`https://api.test/api/matches?date=${day(-30)}&sport=football`))).status).toBe(200)
    expect((await matchesRoute(new Request(`https://api.test/api/matches?date=${day(30)}&sport=football`))).status).toBe(200)
  })
  it("answers 429 once a visitor passes the limit", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ events: [] })))
    const call = () => matchesRoute(new Request("https://api.test/api/matches?sport=football", { headers: { "x-forwarded-for": "3.3.3.3, 4.4.4.4" } }))
    for (let index = 0; index < 240; index += 1) await call()
    expect((await call()).status).toBe(429)
  })
})

describe("in-memory rows", () => {
  const raw = { idEvent: "7", strHomeTeam: "A", strAwayTeam: "B", strLeague: "L", strSport: "Soccer", strStatus: "NS", strTimestamp: "2026-11-05T18:00:00" }
  const hour = 3_600_000

  it("reports the time of the data and looks again once a row is old", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-11-05T10:00:00Z"))
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ events: [raw] })))
    await getEvents({ date: "2026-11-05", sport: "football" })

    vi.setSystemTime(Date.now() + hour)
    const lookup = vi.fn(async () => new Response(JSON.stringify({ events: [raw] })))
    vi.stubGlobal("fetch", lookup)
    expect((await getEvent("tsdb-7"))?.sourceUpdatedAt).toBe("2026-11-05T11:00:00.000Z")
    expect(lookup).toHaveBeenCalled()
  })
  it("keeps an old row, with its own time, when the lookup fails", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-11-05T10:00:00Z"))
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ events: [raw] })))
    await getEvents({ date: "2026-11-05", sport: "football" })

    vi.setSystemTime(Date.now() + hour)
    vi.stubGlobal("fetch", async () => new Response("", { status: 429 }))
    expect((await getEvent("tsdb-7"))?.sourceUpdatedAt).toBe("2026-11-05T10:00:00.000Z")
  })
  it("does not serve a row past the stale limit", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-11-05T10:00:00Z"))
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ events: [raw] })))
    await getEvents({ date: "2026-11-05", sport: "football" })

    vi.setSystemTime(Date.now() + 7 * hour)
    vi.stubGlobal("fetch", async () => new Response("", { status: 429 }))
    await expect(getEvent("tsdb-7")).rejects.toMatchObject({ status: 503 })
  })
})

describe("sanctions", () => {
  const now = new Date("2026-11-05T12:00:00Z")
  const sanction = (type: "mute" | "suspend", hours: number) => ({ uid: "u", type, hours, reason: "r", actorUid: "mod" })

  it("does not let a mute shorten a longer suspension", async () => {
    const { db } = fakeDb()
    const { untilUTC } = await sanctionUser(db, sanction("suspend", 100), now)
    expect((await sanctionUser(db, sanction("mute", 1), now)).untilUTC).toBe(untilUTC)
    expect(await db.transaction((tx) => readSanction(tx, "u"))).toMatchObject({ type: "suspend", untilUTC })
  })
  it("still applies a mute over an ended suspension or an earlier mute", async () => {
    const { db } = fakeDb()
    await sanctionUser(db, sanction("suspend", 1), now)
    await sanctionUser(db, sanction("mute", 5), new Date(now.getTime() + 2 * 3_600_000))
    expect(await db.transaction((tx) => readSanction(tx, "u"))).toMatchObject({ type: "mute" })
  })
})

describe("www redirect", () => {
  const visit = (host: string, forwarded?: string) =>
    middleware(new NextRequest("https://flacronsport.com/app/scores?x=1", { headers: { host, ...(forwarded ? { "x-forwarded-host": forwarded } : {}) } }))

  it("sends our own www host to the apex", () => {
    const response = visit("www.flacronsport.com")
    expect(response.status).toBe(308)
    expect(response.headers.get("location")).toBe("https://flacronsport.com/app/scores?x=1")
  })
  it.each(["www.evil.example", "www.flacronsport.com.evil.example", "constructor"])("never redirects to %s", (forwarded) => {
    expect(visit("flacronsport.com", forwarded).headers.get("location")).toBeNull()
  })
})

describe("digest failures", () => {
  it("treats only an answer from SES as proof nothing was sent", () => {
    expect(provenUnsent(Object.assign(new Error("throttled"), { $metadata: { httpStatusCode: 429 } }))).toBe(true)
    expect(provenUnsent(new Error("socket hang up"))).toBe(false)
  })
})
