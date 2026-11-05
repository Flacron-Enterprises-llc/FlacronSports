import { BILLING_COLLECTIONS } from "@/lib/billing/firestore-store"
import { APP_ID } from "@/lib/billing/plans"
import { getAdminDb } from "@/lib/firebase-admin"
import { ApiError } from "@/lib/api-auth"

const SCAN_LIMIT = 5000

interface MoneyRow {
  amountPaid?: number | null
  amountRefunded?: number | null
  currency?: string | null
  livemode?: boolean
  kind?: string
}

export interface MoneyLine {
  currency: string
  livemode: boolean
  minorUnits: number
  count: number
}

/** Totals never merge currencies or test and live money. */
export function sumMoney(rows: MoneyRow[], amount: (row: MoneyRow) => number | null | undefined): MoneyLine[] {
  const lines = new Map<string, MoneyLine>()
  for (const row of rows) {
    const value = amount(row)
    if (typeof value !== "number") continue
    const currency = (row.currency ?? "unknown").toLowerCase()
    const livemode = row.livemode === true
    const key = `${currency}:${livemode}`
    const line = lines.get(key) ?? { currency, livemode, minorUnits: 0, count: 0 }
    line.minorUnits += value
    line.count += 1
    lines.set(key, line)
  }
  return [...lines.values()].sort((a, b) => a.currency.localeCompare(b.currency) || Number(b.livemode) - Number(a.livemode))
}

/** Gross counts paid invoices only. Add-on sales and refunds are always separate lines. */
export async function billingHealth() {
  const db = getAdminDb()
  if (!db) throw new ApiError(503, "storage_unavailable", "Billing data is temporarily unavailable")

  const [processed, quarantined, purchases, payments, refunds] = await Promise.all([
    db.collection(BILLING_COLLECTIONS.processedEvents).count().get(),
    db.collection(BILLING_COLLECTIONS.quarantine).count().get(),
    db.collection(BILLING_COLLECTIONS.purchases).where("supportReview", "==", true).count().get(),
    db.collection(BILLING_COLLECTIONS.payments).where("application_id", "==", APP_ID).select("amountPaid", "currency", "livemode", "kind").limit(SCAN_LIMIT).get(),
    db.collection(BILLING_COLLECTIONS.refunds).where("application_id", "==", APP_ID).select("amountRefunded", "currency", "livemode").limit(SCAN_LIMIT).get(),
  ])

  const paymentRows = payments.docs.map((doc) => doc.data() as MoneyRow)
  const refundRows = refunds.docs.map((doc) => doc.data() as MoneyRow)
  return {
    processedEvents: processed.data().count,
    quarantinedEvents: quarantined.data().count,
    purchasesNeedingReview: purchases.data().count,
    grossInvoices: sumMoney(paymentRows.filter((row) => row.kind !== "addon"), (row) => row.amountPaid),
    addonSales: sumMoney(paymentRows.filter((row) => row.kind === "addon"), (row) => row.amountPaid),
    refunds: sumMoney(refundRows, (row) => row.amountRefunded),
    truncated: payments.size === SCAN_LIMIT || refunds.size === SCAN_LIMIT,
  }
}
