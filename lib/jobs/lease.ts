// Every task behind the service receives ticks, so this is what lets only one run at a
// time. It is never renewed: a crashed or hung run simply stops holding it once the
// time is up, and the next tick carries on from another task.

import { randomUUID } from "node:crypto"
import type { DocDb } from "@/lib/doc-db"

const LEASE_PATH = "job_leases/tick"
// Well past a normal tick, and short enough that a crash costs at most two of them.
export const TICK_LEASE_MS = 30 * 60_000

interface Lease {
  owner: string
  expiresAt: string
}

/** The owner to release with, or null while another run holds a lease that has not expired. */
export function takeTickLease(db: Pick<DocDb, "transaction">, now: Date): Promise<string | null> {
  return db.transaction(async (tx) => {
    const held = await tx.get<Lease>(LEASE_PATH)
    if (held && Date.parse(held.expiresAt) > now.getTime()) return null
    const owner = randomUUID()
    tx.set(LEASE_PATH, { owner, expiresAt: new Date(now.getTime() + TICK_LEASE_MS).toISOString() })
    return owner
  })
}

/** A run that outlasted its lease leaves alone the one that took over. */
export function releaseTickLease(db: Pick<DocDb, "transaction">, owner: string): Promise<void> {
  return db.transaction(async (tx) => {
    if ((await tx.get<Lease>(LEASE_PATH))?.owner === owner) tx.delete(LEASE_PATH)
  })
}
