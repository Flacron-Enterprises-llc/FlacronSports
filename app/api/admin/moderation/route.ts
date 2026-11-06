import { NextResponse } from "next/server"
import { z } from "zod"
import { ApiError, apiErrorResponse, requireRole } from "@/lib/api-auth"
import { staffRevokeInvite } from "@/lib/admin/rooms"
import { audit } from "@/lib/audit"
import { assertId, MATCH_ID, MESSAGE_ID, ROOM_ID } from "@/lib/community/content"
import { closePoll, createPoll, MAX_POLL_OPTIONS, setPinnedNotice } from "@/lib/community/engagement"
import { listOpenReports, removeMessage, resolveReport, sanctionUser, setLock } from "@/lib/community/moderation"
import { firestoreDocDb } from "@/lib/doc-db"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const REASON = z.string().trim().min(3).max(500)
const REPORT_ID = z.string().max(200).optional()
const SCOPE = z.enum(["match", "room"])
const MATCH = z.string().max(64)
const scopeId = (scope: "match" | "room", id: string) => assertId(id, scope === "match" ? MATCH_ID : ROOM_ID)

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("remove_message"), scope: SCOPE, scopeId: z.string().max(64), messageId: z.string().max(64), reason: REASON, reportId: REPORT_ID }),
  z.object({ action: z.literal("sanction"), uid: z.string().min(1).max(128).regex(/^[\w-]+$/), type: z.enum(["mute", "suspend"]), hours: z.number().int().min(1).max(8760), reason: REASON }),
  z.object({ action: z.literal("lock"), scope: SCOPE, scopeId: z.string().max(64), locked: z.boolean(), reason: REASON }),
  z.object({ action: z.literal("revoke_invite"), roomId: z.string().max(64), reason: REASON }),
  z.object({ action: z.literal("resolve_report"), reportId: z.string().min(1).max(200), reason: REASON }),
  z.object({ action: z.literal("pin_notice"), matchId: MATCH, text: z.string().trim().min(1).max(500), reason: REASON }),
  z.object({ action: z.literal("clear_notice"), matchId: MATCH, reason: REASON }),
  z.object({ action: z.literal("create_poll"), matchId: MATCH, question: z.string().trim().min(1).max(140), options: z.array(z.string().trim().min(1).max(80)).min(2).max(MAX_POLL_OPTIONS), reason: REASON }),
  z.object({ action: z.literal("close_poll"), matchId: MATCH, reason: REASON }),
])

export async function GET(request: Request) {
  try {
    await requireRole(request, "moderator")
    return NextResponse.json({ reports: await listOpenReports(firestoreDocDb()) })
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRole(request, "moderator")
    rateLimit(`moderation:${user.uid}`, 60, 60_000)
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new ApiError(400, "invalid_request", "A valid action and reason are required")

    const body = parsed.data
    const db = firestoreDocDb()
    const now = new Date()
    const safeReportId = (id: string) => assertId(id, /^[\w-]{1,200}$/)

    if (body.action === "remove_message") {
      const id = scopeId(body.scope, body.scopeId)
      const messageId = assertId(body.messageId, MESSAGE_ID)
      await removeMessage(db, { scope: body.scope, scopeId: id, messageId, reason: body.reason, actorUid: user.uid, reportId: body.reportId ? safeReportId(body.reportId) : undefined }, now)
      await audit("moderation.message_removed", user.uid, { scope: body.scope, scopeId: id, messageId, reason: body.reason })
    } else if (body.action === "sanction") {
      const { untilUTC } = await sanctionUser(db, { uid: body.uid, type: body.type, hours: body.hours, reason: body.reason, actorUid: user.uid }, now)
      await audit(`moderation.user_${body.type}`, user.uid, { targetUid: body.uid, untilUTC, reason: body.reason })
    } else if (body.action === "lock") {
      const id = scopeId(body.scope, body.scopeId)
      await setLock(db, { scope: body.scope, scopeId: id, locked: body.locked, reason: body.reason, actorUid: user.uid }, now)
      await audit(body.locked ? "moderation.room_locked" : "moderation.room_unlocked", user.uid, { scope: body.scope, scopeId: id, reason: body.reason })
    } else if (body.action === "revoke_invite") {
      const roomId = assertId(body.roomId, ROOM_ID)
      const { revoked } = await staffRevokeInvite(db, { roomId, actorUid: user.uid, reason: body.reason }, now)
      await audit("moderation.invite_revoked", user.uid, { roomId, revoked, reason: body.reason })
    } else if (body.action === "pin_notice" || body.action === "clear_notice") {
      const matchId = assertId(body.matchId, MATCH_ID)
      await setPinnedNotice(db, user, { matchId, text: body.action === "pin_notice" ? body.text : null }, now)
      await audit(`moderation.${body.action}`, user.uid, { matchId, reason: body.reason })
    } else if (body.action === "create_poll") {
      const matchId = assertId(body.matchId, MATCH_ID)
      const { id } = await createPoll(db, user, { matchId, question: body.question, options: body.options }, now)
      await audit("moderation.poll_created", user.uid, { matchId, pollId: id, reason: body.reason })
    } else if (body.action === "close_poll") {
      const matchId = assertId(body.matchId, MATCH_ID)
      await closePoll(db, user, { matchId })
      await audit("moderation.poll_closed", user.uid, { matchId, reason: body.reason })
    } else {
      await resolveReport(db, { reportId: safeReportId(body.reportId), actorUid: user.uid, note: body.reason }, now)
      await audit("moderation.report_resolved", user.uid, { reportId: body.reportId, reason: body.reason })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
