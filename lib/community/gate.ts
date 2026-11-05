// Age and rules gate. The record lives only on the server, so nothing a client
// sends can stand in for it; every community write reads it in its transaction.

import { ApiError } from "@/lib/api-auth"
import type { DocDb, DocTx } from "@/lib/doc-db"

export const GUIDELINES_VERSION = "2026-11-05"
export const GATE_CODE = "guidelines_required"

export interface Acceptance {
  uid: string
  ageConfirmed: true
  guidelinesVersion: string
  acceptedAtUTC: string
}

export const acceptancePath = (uid: string) => `community_acceptance/${uid}`

export async function requireAccepted(tx: Pick<DocTx, "get">, uid: string): Promise<void> {
  const acceptance = await tx.get<Acceptance>(acceptancePath(uid))
  if (acceptance?.ageConfirmed !== true) {
    throw new ApiError(403, GATE_CODE, "Confirm your age and accept the Community Guidelines to continue")
  }
}

/** The first acceptance stands as the record; repeating it changes nothing. */
export function acceptGuidelines(db: DocDb, uid: string, now: Date): Promise<void> {
  return db.transaction(async (tx) => {
    if (await tx.get(acceptancePath(uid))) return
    const acceptance: Acceptance = { uid, ageConfirmed: true, guidelinesVersion: GUIDELINES_VERSION, acceptedAtUTC: now.toISOString() }
    tx.set(acceptancePath(uid), acceptance)
  })
}
