// Counters for the Operations screen. Each one is a number in memory, added to one
// document per day, so counting a provider call or an email costs no read and no
// write of its own. Up to one flush window is lost if a task stops.

import { FieldValue, type Firestore } from "firebase-admin/firestore"
import { getAdminDb } from "@/lib/firebase-admin"

export const OPS_DAILY = "ops_daily"
const FLUSH_MS = 5 * 60_000

const pending = new Map<string, number>()
let timer: ReturnType<typeof setTimeout> | null = null

export function countMetric(name: string, by = 1): void {
  pending.set(name, (pending.get(name) ?? 0) + by)
  if (timer || !getAdminDb()) return
  timer = setTimeout(() => {
    timer = null
    void flushMetrics()
  }, FLUSH_MS)
  timer.unref?.()
}

/** Counts that fail to store go back in the queue for the next flush. */
export async function flushMetrics(db: Firestore | null = getAdminDb(), now: Date = new Date()): Promise<void> {
  if (!db || pending.size === 0) return
  const batch = [...pending]
  pending.clear()
  const date = now.toISOString().slice(0, 10)
  const counters = Object.fromEntries(batch.map(([name, value]) => [name, FieldValue.increment(value)]))
  try {
    await db.collection(OPS_DAILY).doc(date).set({ date, counters }, { merge: true })
  } catch (error) {
    for (const [name, value] of batch) pending.set(name, (pending.get(name) ?? 0) + value)
    console.error("Metrics not stored", error instanceof Error ? error.message : "unknown")
  }
}

export function pendingMetrics(): Record<string, number> {
  return Object.fromEntries(pending)
}

export function clearMetrics(): void {
  pending.clear()
}
