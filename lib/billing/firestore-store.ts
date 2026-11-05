import type { Transaction } from "firebase-admin/firestore"
import { getAdminDb } from "@/lib/firebase-admin"
import { computeAccess, type EffectiveAccess, type EntitlementRecord } from "./entitlements"
import { APP_ID } from "./plans"
import { shouldReplaceEntitlement, type BillingStore } from "./webhook-core"

export const BILLING_COLLECTIONS = {
  entitlements: "billing_entitlements",
  customers: "billing_customers",
  processedEvents: "processed_stripe_events",
  quarantine: "billing_quarantine",
  payments: "billing_payments",
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

      if (mutation.entitlement && entitlementRef) {
        const current = existing?.exists ? (existing.data() as EntitlementRecord) : null
        if (shouldReplaceEntitlement(current, mutation.entitlement)) {
          tx.set(entitlementRef, mutation.entitlement)
        }
      }
      if (mutation.ledger) {
        tx.set(firestore.collection(mutation.ledger.collection).doc(mutation.ledger.id), mutation.ledger.data, {
          merge: true,
        })
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

/** Server-side access check. Anything unreadable resolves to Free, never to paid. */
export async function getEffectiveAccess(uid: string): Promise<EffectiveAccess> {
  try {
    return computeAccess(await getEntitlementRecord(uid))
  } catch (error) {
    console.error("Entitlement lookup failed", error instanceof Error ? error.message : "unknown")
    return computeAccess(null)
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
