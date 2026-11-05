// Moderator actions. Routes audit each one; this module only changes state.

import { ApiError } from "@/lib/api-auth"
import type { DocDb } from "@/lib/doc-db"
import { chatPath, messagesPath, type ReportScope, type Sanction, type StoredMessage } from "./chat"

export interface CommunityReport {
  scope: ReportScope
  scopeId: string
  messageId: string
  reporterUid: string
  targetUid: string
  messageText: string
  reason: string
  status: "open" | "resolved"
  createdAtUTC: string
}

export async function listOpenReports(db: Pick<DocDb, "query">) {
  const rows = await db.query<CommunityReport>("community_reports", { where: [["status", "open"]], limit: 200 })
  return rows.sort((a, b) => a.createdAtUTC.localeCompare(b.createdAtUTC))
}

export function removeMessage(db: DocDb, input: { scope: ReportScope; scopeId: string; messageId: string; reason: string; actorUid: string; reportId?: string }, now: Date) {
  const path = `${messagesPath(input.scope, input.scopeId)}/${input.messageId}`
  return db.transaction(async (tx) => {
    const message = await tx.get<StoredMessage>(path)
    if (!message) throw new ApiError(404, "not_found", "Message not found")
    tx.set(path, { removed: true, removedReason: input.reason, removedBy: input.actorUid, removedAtUTC: now.toISOString() }, { merge: true })
    if (input.reportId) tx.set(`community_reports/${input.reportId}`, { status: "resolved", resolvedBy: input.actorUid, resolvedAtUTC: now.toISOString() }, { merge: true })
  })
}

export async function sanctionUser(db: DocDb, input: { uid: string; type: Sanction["type"]; hours: number; reason: string; actorUid: string }, now: Date) {
  const untilUTC = new Date(now.getTime() + input.hours * 3_600_000).toISOString()
  await db.set(`community_sanctions/${input.uid}`, { type: input.type, untilUTC, reason: input.reason, by: input.actorUid, createdAtUTC: now.toISOString() })
  return { untilUTC }
}

export async function setLock(db: DocDb, input: { scope: ReportScope; scopeId: string; locked: boolean; reason: string; actorUid: string }, now: Date) {
  const path = input.scope === "match" ? chatPath(input.scopeId) : `rooms/${input.scopeId}`
  if (input.scope === "room" && !(await db.get(path))) throw new ApiError(404, "not_found", "Room not found")
  await db.set(path, { locked: input.locked, lockReason: input.reason, lockedBy: input.actorUid, lockedAtUTC: now.toISOString() }, { merge: true })
}

export async function resolveReport(db: DocDb, input: { reportId: string; actorUid: string; note: string }, now: Date) {
  const path = `community_reports/${input.reportId}`
  if (!(await db.get(path))) throw new ApiError(404, "not_found", "Report not found")
  await db.set(path, { status: "resolved", resolvedBy: input.actorUid, resolution: input.note, resolvedAtUTC: now.toISOString() }, { merge: true })
}
