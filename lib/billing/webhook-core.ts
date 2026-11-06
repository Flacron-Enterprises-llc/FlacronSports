// Stripe event processing, kept free of Firestore and Stripe SDK singletons so
// that isolation, idempotency and ordering can be tested deterministically.
//
// The Stripe account is shared between Flacron apps, so the endpoint receiving
// an event proves nothing about ownership: every grant needs app metadata AND a
// price from this app's own catalog.

import type Stripe from "stripe"
import { addonForPriceId, buildPurchase, type BillingPurchase } from "./addons"
import type { EntitlementRecord, StripeSubscriptionStatus } from "./entitlements"
import { APP_ID, planForPriceId } from "./plans"

export type QuarantineReason =
  | "livemode_event_rejected"
  | "other_application"
  | "missing_app_id"
  | "missing_firebase_uid"
  | "unknown_price"
  | "missing_payment"
  | "duplicate_subscription"
  | "unlinked_refund"
  | "refund_needs_review"

export interface LedgerEntry {
  collection: "billing_payments" | "billing_refunds"
  id: string
  data: Record<string, unknown>
}

export interface EventMutation {
  entitlement?: EntitlementRecord
  ledger?: LedgerEntry
  quarantine?: { reason: QuarantineReason; objectId: string | null }
  /** Written only if billing_purchases has no document for this session yet. */
  purchase?: BillingPurchase
  /** Applied to the purchase paid by this payment, if there is one. */
  purchaseRefund?: { paymentId: string; full: boolean; refundedAtUTC: string }
  /** Written with the event claim, so an access change is never left unrecorded. */
  audit?: { action: string; actorUid: string; detail: Record<string, string | number | boolean | null> }
}

export interface CommitResult {
  duplicate: boolean
}

export interface BillingStore {
  /**
   * Atomically claims event.id and applies the mutation. Must return
   * { duplicate: true } and write nothing if the event was already claimed.
   */
  commitEvent(event: { id: string; type: string; created: number }, mutation: EventMutation): Promise<CommitResult>
}

export interface WebhookDeps {
  store: BillingStore
  retrieveSubscription(id: string): Promise<Stripe.Subscription>
  /** Must expand line_items and payment_intent: Stripe leaves line items out of the event payload. */
  retrieveCheckoutSession(id: string): Promise<Stripe.Checkout.Session>
  /** Resolves ownership for objects that carry no app metadata, such as refunded charges. */
  ownsCustomer?(customerId: string): Promise<boolean>
  /** Charges no longer name their invoice, so a refund finds it through the payment. */
  invoiceForPayment?(paymentIntentId: string): Promise<Stripe.Invoice | null>
  listSubscriptions?(customerId: string): Promise<Stripe.Subscription[]>
  cancelSubscription?(id: string): Promise<void>
  /** Runs after the payment is on record, and again on redelivery, so it must be idempotent. */
  onPaidInvoice?(uid: string, invoiceId: string): Promise<unknown>
  /** Runs after a full refund is on record, and again on redelivery, so it must be idempotent. */
  onRefundedInvoice?(invoiceId: string): Promise<unknown>
  allowLivemode?: boolean
  env?: Record<string, string | undefined>
}

export type WebhookOutcome = "applied" | "duplicate" | "ignored" | "quarantined"

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null
  return typeof value === "string" ? value : value.id
}

function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  // API 2025-03-31 and later moved this under parent.subscription_details. The
  // account limits test endpoints to three API versions, so accept both shapes.
  const legacy = (invoice as Stripe.Invoice & { subscription?: string | { id: string } | null }).subscription
  return idOf(invoice.parent?.subscription_details?.subscription ?? legacy)
}

export function projectSubscription(
  subscription: Stripe.Subscription,
  eventCreated: number,
  env?: Record<string, string | undefined>,
): { record: EntitlementRecord } | { quarantine: QuarantineReason } {
  const appId = subscription.metadata?.app_id
  if (!appId) return { quarantine: "missing_app_id" }
  if (appId !== APP_ID) return { quarantine: "other_application" }

  const uid = subscription.metadata?.firebase_uid
  if (!uid) return { quarantine: "missing_firebase_uid" }

  const item = subscription.items.data[0]
  const mapped = planForPriceId(item?.price?.id, env)
  if (!item || !mapped) return { quarantine: "unknown_price" }

  return {
    record: {
      application_id: APP_ID,
      uid,
      plan: mapped.plan,
      interval: mapped.interval,
      status: subscription.status as StripeSubscriptionStatus,
      stripeCustomerId: idOf(subscription.customer) as string,
      stripeSubscriptionId: subscription.id,
      currentPeriodStart: item.current_period_start,
      currentPeriodEnd: item.current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      lastEventCreated: eventCreated,
    },
  }
}

function subscriptionIdFor(event: Stripe.Event): string | null {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode !== "subscription" || session.payment_status !== "paid") return null
      return idOf(session.subscription)
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return (event.data.object as Stripe.Subscription).id
    case "invoice.paid":
    case "invoice.payment_failed":
      return subscriptionIdFromInvoice(event.data.object as Stripe.Invoice)
    default:
      return null
  }
}

function paymentLedger(event: Stripe.Event, record: EntitlementRecord): LedgerEntry | undefined {
  if (event.type !== "invoice.paid") return undefined
  const invoice = event.data.object as Stripe.Invoice
  return {
    collection: "billing_payments",
    id: invoice.id as string,
    data: {
      application_id: APP_ID,
      uid: record.uid,
      stripeInvoiceId: invoice.id,
      stripeSubscriptionId: record.stripeSubscriptionId,
      amountPaid: invoice.amount_paid,
      currency: invoice.currency,
      livemode: event.livemode,
      paidAt: event.created,
    },
  }
}

/** Grants from the verified session, never from the browser or from metadata alone. */
async function projectPurchase(
  object: Stripe.Checkout.Session,
  event: Stripe.Event,
  deps: WebhookDeps,
): Promise<{ purchase: BillingPurchase; ledger: LedgerEntry } | { quarantine: QuarantineReason }> {
  const appId = object.metadata?.app_id
  if (!appId) return { quarantine: "missing_app_id" }
  if (appId !== APP_ID) return { quarantine: "other_application" }
  const uid = object.metadata?.firebase_uid
  if (!uid) return { quarantine: "missing_firebase_uid" }

  const session = await deps.retrieveCheckoutSession(object.id)
  const lines = session.line_items?.data ?? []
  const addon = lines.length === 1 && lines[0].quantity === 1 ? addonForPriceId(lines[0].price?.id, deps.env) : null
  if (!addon || object.metadata?.sku !== addon.sku) return { quarantine: "unknown_price" }

  const verifiedPaymentId = idOf(session.payment_intent)
  if (!verifiedPaymentId) return { quarantine: "missing_payment" }
  const intent = typeof session.payment_intent === "string" ? null : session.payment_intent
  const stripeChargeId = idOf(intent?.latest_charge)

  return {
    purchase: buildPurchase({ purchaseId: session.id, verifiedPaymentId, stripeChargeId, addon, uid, paidAtSeconds: event.created, livemode: event.livemode }),
    ledger: {
      collection: "billing_payments",
      id: session.id,
      data: {
        application_id: APP_ID,
        kind: "addon",
        uid,
        sku: addon.sku,
        stripePaymentIntentId: verifiedPaymentId,
        amountPaid: session.amount_total,
        currency: session.currency,
        livemode: event.livemode,
        paidAt: event.created,
      },
    },
  }
}

const SYSTEM_ACTOR = "system:stripe"

// Only these invoices pay for a whole period. A proration or manual invoice covers part
// of one, so refunding it says nothing about the period the member already paid for.
const PERIOD_INVOICES = new Set<string | null>(["subscription_create", "subscription_cycle"])

/**
 * Only a charge for time still running ends access: refunding last month's invoice
 * leaves the paid current period alone. Canceling in Stripe, not just here, is what
 * stops the next webhook from restoring the subscription or a renewal from charging.
 */
async function endRefundedSubscription(
  charge: Stripe.Charge,
  invoice: Stripe.Invoice | null,
  event: Stripe.Event,
  deps: WebhookDeps,
): Promise<Pick<EventMutation, "entitlement" | "audit" | "quarantine">> {
  if (!deps.invoiceForPayment || !deps.cancelSubscription) return {}
  const subscriptionId = invoice ? subscriptionIdFromInvoice(invoice) : null
  if (!invoice || !subscriptionId) return { quarantine: { reason: "unlinked_refund", objectId: charge.id } }

  const subscription = await deps.retrieveSubscription(subscriptionId)
  const projected = projectSubscription(subscription, event.created, deps.env)
  if ("quarantine" in projected) return { quarantine: { reason: projected.quarantine, objectId: subscription.id } }

  const { record } = projected
  const detail = { targetUid: record.uid, stripeSubscriptionId: subscription.id, stripeChargeId: charge.id, stripeInvoiceId: invoice.id ?? null }
  if (!PERIOD_INVOICES.has(invoice.billing_reason)) {
    return {
      quarantine: { reason: "refund_needs_review", objectId: charge.id },
      audit: { action: "billing.refund_needs_review", actorUid: SYSTEM_ACTOR, detail: { ...detail, billingReason: invoice.billing_reason } },
    }
  }
  if (!invoice.lines.data.some((line) => line.period.end > event.created)) {
    return { audit: { action: "billing.refund_past_period", actorUid: SYSTEM_ACTOR, detail } }
  }
  if (subscription.status !== "canceled" && subscription.status !== "incomplete_expired") await deps.cancelSubscription(subscription.id)
  return {
    entitlement: { ...record, status: "canceled", cancelAtPeriodEnd: false },
    audit: { action: "billing.refund_ended_access", actorUid: SYSTEM_ACTOR, detail },
  }
}

const paying = (subscription: Stripe.Subscription) => subscription.status === "active" || subscription.status === "trialing"

/**
 * Two checkouts can both be paid. Every webhook keeps the oldest paying subscription,
 * so both deliveries agree whichever order they arrive in. The charge stands until
 * support refunds it, which the quarantine record is there to prompt.
 */
async function settleDuplicate(
  subscription: Stripe.Subscription,
  record: EntitlementRecord,
  deps: WebhookDeps,
): Promise<Pick<EventMutation, "entitlement" | "audit" | "quarantine"> | null> {
  if (!deps.listSubscriptions || !deps.cancelSubscription) return null
  const rivals = (await deps.listSubscriptions(record.stripeCustomerId)).filter(
    (item) => item.id !== subscription.id && paying(item) && item.metadata?.app_id === APP_ID && item.metadata?.firebase_uid === record.uid,
  )
  const candidates = paying(subscription) ? [subscription, ...rivals] : rivals
  const keeper = candidates.sort((a, b) => a.created - b.created || a.id.localeCompare(b.id))[0]
  if (!keeper || keeper.id === subscription.id) return null

  if (subscription.status !== "canceled") await deps.cancelSubscription(subscription.id)
  // Stamped now, not with this event's time: the cancellation's own webhook may land first.
  const kept = projectSubscription(keeper, Math.floor(Date.now() / 1000), deps.env)
  return {
    entitlement: "record" in kept ? kept.record : undefined,
    quarantine: { reason: "duplicate_subscription", objectId: subscription.id },
    audit: {
      action: "billing.duplicate_subscription_canceled",
      actorUid: SYSTEM_ACTOR,
      detail: { targetUid: record.uid, canceled: subscription.id, kept: keeper.id },
    },
  }
}

export async function processStripeEvent(event: Stripe.Event, deps: WebhookDeps): Promise<WebhookOutcome> {
  const meta = { id: event.id, type: event.type, created: event.created }

  const finish = async (mutation: EventMutation, outcome: WebhookOutcome): Promise<WebhookOutcome> => {
    const { duplicate } = await deps.store.commitEvent(meta, mutation)
    return duplicate ? "duplicate" : outcome
  }

  if (event.livemode && !deps.allowLivemode) {
    const object = event.data.object as { id?: string }
    return finish({ quarantine: { reason: "livemode_event_rejected", objectId: object.id ?? null } }, "quarantined")
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge
    const metadataApp = charge.metadata?.app_id
    if (metadataApp && metadataApp !== APP_ID) {
      return finish({ quarantine: { reason: "other_application", objectId: charge.id } }, "quarantined")
    }
    // Add-on charges inherit metadata from payment_intent_data. Subscription charges
    // carry none, so their ownership comes from our customer table.
    const customerId = idOf(charge.customer)
    const owned = metadataApp === APP_ID || (customerId && deps.ownsCustomer ? await deps.ownsCustomer(customerId) : false)
    if (!owned) {
      return finish({ quarantine: { reason: "missing_app_id", objectId: charge.id } }, "quarantined")
    }
    const paymentId = idOf(charge.payment_intent)
    const full = charge.refunded === true || (charge.amount > 0 && charge.amount_refunded >= charge.amount)
    const refundedAtUTC = new Date(event.created * 1000).toISOString()
    // Add-on charges carry their sku. Anything else from an owned customer is a subscription charge.
    const subscriptionCharge = full && !charge.metadata?.sku
    const invoice = subscriptionCharge && paymentId && deps.invoiceForPayment ? await deps.invoiceForPayment(paymentId) : null
    const ended = subscriptionCharge ? await endRefundedSubscription(charge, invoice, event, deps) : {}
    const outcome = await finish(
      {
        ...ended,
        purchaseRefund: paymentId ? { paymentId, full, refundedAtUTC } : undefined,
        ledger: {
          collection: "billing_refunds",
          id: charge.id,
          data: {
            application_id: APP_ID,
            stripeChargeId: charge.id,
            stripeCustomerId: customerId,
            stripePaymentIntentId: paymentId,
            amountRefunded: charge.amount_refunded,
            fullyRefunded: full,
            currency: charge.currency,
            livemode: event.livemode,
            refundedAt: event.created,
          },
        },
      },
      "applied",
    )
    if (invoice?.id) await deps.onRefundedInvoice?.(invoice.id)
    return outcome
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session
    if (session.mode === "payment") {
      if (session.payment_status !== "paid") return finish({}, "ignored")
      const projected = await projectPurchase(session, event, deps)
      if ("quarantine" in projected) {
        return finish({ quarantine: { reason: projected.quarantine, objectId: session.id } }, "quarantined")
      }
      return finish(projected, "applied")
    }
  }

  const subscriptionId = subscriptionIdFor(event)
  if (!subscriptionId) return finish({}, "ignored")

  // Always project Stripe's current state rather than the event payload, so
  // retried and out-of-order deliveries converge on the same result.
  const subscription = await deps.retrieveSubscription(subscriptionId)
  const projected = projectSubscription(subscription, event.created, deps.env)

  if ("quarantine" in projected) {
    return finish({ quarantine: { reason: projected.quarantine, objectId: subscription.id } }, "quarantined")
  }

  if (event.type === "checkout.session.completed") {
    const settled = await settleDuplicate(subscription, projected.record, deps)
    if (settled) return finish(settled, "applied")
  }

  const ledger = paymentLedger(event, projected.record)
  const outcome = await finish({ entitlement: projected.record, ledger }, "applied")
  if (ledger) await deps.onPaidInvoice?.(projected.record.uid, ledger.id)
  return outcome
}

/**
 * Decides whether an incoming projection may replace the stored entitlement.
 * Runs inside the store's transaction. Older events lose, and an ended
 * subscription cannot overwrite a different one that is still live.
 */
export function shouldReplaceEntitlement(
  existing: EntitlementRecord | null | undefined,
  incoming: EntitlementRecord,
): boolean {
  if (!existing) return true
  if (incoming.lastEventCreated < existing.lastEventCreated) return false
  if (existing.stripeSubscriptionId === incoming.stripeSubscriptionId) return true

  const live = (status: StripeSubscriptionStatus) =>
    status === "active" || status === "trialing" || status === "past_due"
  return live(incoming.status) || !live(existing.status)
}
