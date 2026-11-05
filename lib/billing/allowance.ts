// Metered allowances (spec sections 12 and 14). Plan requests reset each UTC
// calendar month, for annual subscribers too: the key depends only on the clock,
// so no billing anchor is needed and a missed webhook cannot block a reset.
// Purchased credits live on their billing_purchases document and never reset.

import { ApiError } from "@/lib/api-auth"
import type { DocDb, DocTx, Row } from "@/lib/doc-db"
import { creditsLeft, type AllowanceUnit, type BillingPurchase } from "./addons"

const USAGE = "assistant_usage"
const PURCHASES = "billing_purchases"

interface UsageDoc {
  uid: string
  period: string
  used: number
}

export interface ConsumptionTicket {
  uid: string
  source: "plan" | "purchase"
  period: string
  purchaseId: string | null
}

export interface AllowanceBalance {
  period: string
  included: { limit: number; used: number; remaining: number }
  purchased: number
  remaining: number
  credits: { purchaseId: string; sku: BillingPurchase["sku"]; remaining: number; expiresAtUTC: string }[]
}

export function allowancePeriod(now: Date): string {
  return now.toISOString().slice(0, 7)
}

const usagePath = (uid: string, period: string) => `${USAGE}/${uid}_${period}`

/** Spendable purchases, soonest expiry first so that nothing lapses unnecessarily. */
export function spendableCredits<T extends BillingPurchase>(purchases: T[], nowMs: number): T[] {
  return purchases
    .filter((purchase) => creditsLeft(purchase, nowMs) > 0)
    .sort((a, b) => a.expiresAtUTC.localeCompare(b.expiresAtUTC) || a.purchaseId.localeCompare(b.purchaseId))
}

function balanceOf(limit: number, used: number, purchases: BillingPurchase[], period: string, nowMs: number): AllowanceBalance {
  const credits = spendableCredits(purchases, nowMs).map((purchase) => ({
    purchaseId: purchase.purchaseId,
    sku: purchase.sku,
    remaining: creditsLeft(purchase, nowMs),
    expiresAtUTC: purchase.expiresAtUTC,
  }))
  const included = Math.max(0, limit - used)
  const purchased = credits.reduce((sum, credit) => sum + credit.remaining, 0)
  return { period, included: { limit, used, remaining: included }, purchased, remaining: included + purchased, credits }
}

const unitPurchases = (reader: Pick<DocTx, "query">, uid: string, unit: AllowanceUnit): Promise<Row<BillingPurchase>[]> =>
  reader.query<BillingPurchase>(PURCHASES, { where: [["uid", uid], ["unit", unit]] })

export async function readAssistantBalance(db: DocDb, uid: string, limit: number, now: Date): Promise<AllowanceBalance> {
  const period = allowancePeriod(now)
  const [usage, purchases] = await Promise.all([db.get<UsageDoc>(usagePath(uid, period)), unitPurchases(db, uid, "assistant")])
  return balanceOf(limit, usage?.used ?? 0, purchases, period, now.getTime())
}

/** Included plan requests first, then purchased credits in expiry order. No overage is ever charged. */
export function consumeAssistantRequest(db: DocDb, uid: string, limit: number, now: Date) {
  const period = allowancePeriod(now)
  const nowMs = now.getTime()
  return db.transaction(async (tx) => {
    const usage = await tx.get<UsageDoc>(usagePath(uid, period))
    const purchases = await unitPurchases(tx, uid, "assistant")
    const used = usage?.used ?? 0

    if (used < limit) {
      tx.set(usagePath(uid, period), { uid, period, used: used + 1 })
      const ticket: ConsumptionTicket = { uid, source: "plan", period, purchaseId: null }
      return { ticket, balance: balanceOf(limit, used + 1, purchases, period, nowMs) }
    }

    const next = spendableCredits(purchases, nowMs)[0]
    if (!next) throw new ApiError(403, "allowance_exhausted", "You have used all your requests for this month")
    tx.set(`${PURCHASES}/${next.id}`, { consumed: next.consumed + 1 }, { merge: true })
    const ticket: ConsumptionTicket = { uid, source: "purchase", period, purchaseId: next.id }
    const updated = purchases.map((purchase) => (purchase.id === next.id ? { ...purchase, consumed: purchase.consumed + 1 } : purchase))
    return { ticket, balance: balanceOf(limit, used, updated, period, nowMs) }
  })
}

/** For allowances with no plan portion, such as PDF exports. */
export function consumePurchasedCredit(db: DocDb, uid: string, unit: AllowanceUnit, now: Date): Promise<ConsumptionTicket> {
  return db.transaction(async (tx) => {
    const next = spendableCredits(await unitPurchases(tx, uid, unit), now.getTime())[0]
    if (!next) throw new ApiError(403, "allowance_exhausted", "You have no credits left")
    tx.set(`${PURCHASES}/${next.id}`, { consumed: next.consumed + 1 }, { merge: true })
    return { uid, source: "purchase" as const, period: allowancePeriod(now), purchaseId: next.id }
  })
}

export async function hasPurchasedCredit(db: DocDb, uid: string, unit: AllowanceUnit, now: Date): Promise<boolean> {
  return spendableCredits(await unitPurchases(db, uid, unit), now.getTime()).length > 0
}

/** Gives back exactly what the ticket took, to the same period or purchase. Call once per ticket. */
export function restoreCredit(db: DocDb, ticket: ConsumptionTicket): Promise<void> {
  return db.transaction(async (tx) => {
    if (ticket.source === "plan") {
      const usage = await tx.get<UsageDoc>(usagePath(ticket.uid, ticket.period))
      if (usage) tx.set(usagePath(ticket.uid, ticket.period), { used: Math.max(0, usage.used - 1) }, { merge: true })
      return
    }
    const path = `${PURCHASES}/${ticket.purchaseId}`
    const purchase = await tx.get<BillingPurchase>(path)
    if (purchase) tx.set(path, { consumed: Math.max(0, purchase.consumed - 1) }, { merge: true })
  })
}
