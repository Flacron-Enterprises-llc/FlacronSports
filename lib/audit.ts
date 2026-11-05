import { getAdminDb } from "@/lib/firebase-admin"

/** Append-only record of privileged and account-level actions. Never store secrets here. */
export async function audit(action: string, actorUid: string, detail: Record<string, string | number | boolean | null> = {}) {
  await getAdminDb()?.collection("audit_logs").add({ action, actorUid, detail, at: new Date().toISOString() })
}
