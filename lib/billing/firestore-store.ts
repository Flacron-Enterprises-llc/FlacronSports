import type { Transaction } from "firebase-admin/firestore"
import { getAdminDb } from "@/lib/firebase-admin"
import { activeDayPass, applyPurchaseRefund, resolvePurchaseGrant, type BillingPurchase } from "./addons"
import { computeAccess, withDayPass, type EffectiveAccess, type EntitlementRecord } from "./entitlements"
import { APP_ID } from "./plans"
import { shouldReplaceEntitlement, type BillingStore } from "./webhook-core"

export const BILLING_COLLECTIONS = {
  entitlements: "billing_entitlements",
  customers: "billing_customers",
  processedEvents: "processed_stripe_events",
  quarantine: "billing_quarantine",
  payments: "billing_payments",
  refunds: "billing_refunds",
  purchases: "billing_purchases",
} as const

function db() {
  const instance = getAdminDb()
  if (!instance) throw new Error("Firestore is not configured")
  return instance
}

export const firestoreBillingStore: BillingStore = {
  async commitEvent(event, mutation) {
    const firestore = db()
    const processedRef = firestore.collection(BILLING_COLLECTIONS.processedEvents).doc(event.id)

    return firestore.runTransaction(async (tx: Transaction) => {
      // Firestore transactions require every read before the first write.
      const processed = await tx.get(processedRef)
      if (processed.exists) return { duplicate: true }

      const entitlementRef = mutation.entitlement
        ? firestore.collection(BILLING_COLLECTIONS.entitlements).doc(mutation.entitlement.uid)
        : null
      const existing = entitlementRef ? await tx.get(entitlementRef) : null

      const purchases = firestore.collection(BILLING_COLLECTIONS.purchases)
      const { purchase, purchaseRefund } = mutation
      const purchaseRef = purchase ? purchases.doc(purchase.purchaseId) : null
      const storedPurchase = purchaseRef ? await tx.get(purchaseRef) : null
      // Reading the refund ledger here closes the race with a refund delivered first.
      const earlierRefund = purchase?.stripeChargeId
        ? await tx.get(firestore.collection(BILLING_COLLECTIONS.refunds).doc(purchase.stripeChargeId))
        : null
      const otherDayPasses = purchase?.sku === "day_pass"
        ? await tx.get(purchases.where("uid", "==", purchase.uid).where("sku", "==", "day_pass"))
        : null
      const refundTarget = purchaseRefund
        ? await tx.get(purchases.where("verifiedPaymentId", "==", purchaseRefund.paymentId).limit(1))
        : null

      if (mutation.entitlement && entitlementRef) {
        const current = existing?.exists ? (existing.data() as EntitlementRecord) : null
        if (shouldReplaceEntitlement(current, mutation.entitlement)) {
          tx.set(entitlementRef, mutation.entitlement)
        }
      }
      if (purchase && purchaseRef) {
        const refund = earlierRefund?.exists ? earlierRefund.data() : null
        const granted = resolvePurchaseGrant(storedPurchase?.exists ? (storedPurchase.data() as BillingPurchase) : null, purchase, {
          refund: refund ? { full: refund.fullyRefunded === true, refundedAtUTC: new Date(refund.refundedAt * 1000).toISOString() } : null,
          otherDayPasses: otherDayPasses?.docs.map((doc) => doc.data() as BillingPurchase),
        })
        if (granted) tx.set(purchaseRef, granted)
      }
      if (purchaseRefund && refundTarget && !refundTarget.empty) {
        const doc = refundTarget.docs[0]
        tx.set(doc.ref, applyPurchaseRefund(doc.data() as BillingPurchase, purchaseRefund))
      }
      if (mutation.ledger) {
        tx.set(firestore.collection(mutation.ledger.collection).doc(mutation.ledger.id), mutation.ledger.data, {
          merge: true,
        })
      }
      if (mutation.audit) {
        tx.set(firestore.collection("audit_logs").doc(), { ...mutation.audit, at: new Date().toISOString() })
      }
      if (mutation.quarantine) {
        tx.set(firestore.collection(BILLING_COLLECTIONS.quarantine).doc(event.id), {
          ...mutation.quarantine,
          eventType: event.type,
          eventCreated: event.created,
        })
      }
      tx.set(processedRef, {
        application_id: APP_ID,
        type: event.type,
        created: event.created,
        processedAt: Date.now(),
      })
      return { duplicate: false }
    })
  },
}

export async function ownsCustomer(customerId: string): Promise<boolean> {
  const found = await db()
    .collection(BILLING_COLLECTIONS.customers)
    .where("stripeCustomerId", "==", customerId)
    .where("application_id", "==", APP_ID)
    .limit(1)
    .get()
  return !found.empty
}

export async function getEntitlementRecord(uid: string): Promise<EntitlementRecord | null> {
  const doc = await db().collection(BILLING_COLLECTIONS.entitlements).doc(uid).get()
  return doc.exists ? (doc.data() as EntitlementRecord) : null
}

/** Subscription only. Allowances and billing screens must not treat a day pass as a plan. */
export async function getSubscriptionAccess(uid: string): Promise<EffectiveAccess> {
  try {
    return computeAccess(await getEntitlementRecord(uid))
  } catch (error) {
    console.error("Entitlement lookup failed", error instanceof Error ? error.message : "unknown")
    return computeAccess(null)
  }
}

export async function getUserPurchases(uid: string): Promise<BillingPurchase[]> {
  const found = await db().collection(BILLING_COLLECTIONS.purchases).where("uid", "==", uid).get()
  return found.docs.map((doc) => doc.data() as BillingPurchase)
}

/** Benefit check, day pass included. Anything unreadable resolves downward, never to paid. */
export async function getEffectiveAccess(uid: string): Promise<EffectiveAccess> {
  const subscription = await getSubscriptionAccess(uid)
  try {
    return withDayPass(subscription, activeDayPass(await getUserPurchases(uid), Date.now()))
  } catch (error) {
    console.error("Day pass lookup failed", error instanceof Error ? error.message : "unknown")
    return subscription
  }
}

export async function getStoredCustomerId(uid: string): Promise<string | null> {
  const doc = await db().collection(BILLING_COLLECTIONS.customers).doc(uid).get()
  return doc.exists ? ((doc.data()?.stripeCustomerId as string) ?? null) : null
}

export async function storeCustomerId(uid: string, stripeCustomerId: string): Promise<void> {
  await db().collection(BILLING_COLLECTIONS.customers).doc(uid).set({
    application_id: APP_ID,
    stripeCustomerId,
    updatedAt: Date.now(),
  })
}
