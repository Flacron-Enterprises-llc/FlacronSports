// Stripe event processing, kept free of Firestore and Stripe SDK singletons so
// that isolation, idempotency and ordering can be tested deterministically.
//
// The Stripe account is shared between Flacron apps, so the endpoint receiving
// an event proves nothing about ownership: every grant needs app metadata AND a
// price from this app's own catalog.

import type Stripe from "stripe"
import type { EntitlementRecord, StripeSubscriptionStatus } from "./entitlements"
import { APP_ID, planForPriceId } from "./plans"

export type QuarantineReason =
  | "livemode_event_rejected"
  | "other_application"
  | "missing_app_id"
  | "missing_firebase_uid"
  | "unknown_price"

export interface LedgerEntry {
  collection: "billing_payments" | "billing_refunds"
  id: string
  data: Record<string, unknown>
}

export interface EventMutation {
  entitlement?: EntitlementRecord
  ledger?: LedgerEntry
  quarantine?: { reason: QuarantineReason; objectId: string | null }
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
  /** Resolves ownership for objects that carry no app metadata, such as refunded charges. */
  ownsInvoice?(invoiceId: string): Promise<boolean>
  allowLivemode?: boolean
  env?: Record<string, string | undefined>
}

export type WebhookOutcome = "applied" | "duplicate" | "ignored" | "quarantined"

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null
  return typeof value === "string" ? value : value.id
}

function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  // API 2025-03-31 and later moved this under parent.subscription_details.
  const details = invoice.parent?.subscription_details
  return details ? idOf(details.subscription) : null
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
    // Subscription charges carry no metadata; ownership comes from our own ledger.
    const invoiceId = idOf((charge as Stripe.Charge & { invoice?: string | { id: string } | null }).invoice)
    const owned = metadataApp === APP_ID || (invoiceId && deps.ownsInvoice ? await deps.ownsInvoice(invoiceId) : false)
    if (!owned) {
      return finish({ quarantine: { reason: "missing_app_id", objectId: charge.id } }, "quarantined")
    }
    return finish(
      {
        ledger: {
          collection: "billing_refunds",
          id: charge.id,
          data: {
            application_id: APP_ID,
            stripeChargeId: charge.id,
            stripeInvoiceId: invoiceId,
            amountRefunded: charge.amount_refunded,
            currency: charge.currency,
            livemode: event.livemode,
            refundedAt: event.created,
          },
        },
      },
      "applied",
    )
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

  return finish(
    { entitlement: projected.record, ledger: paymentLedger(event, projected.record) },
    "applied",
  )
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
