// Public match chat. Moderation data stays server side: readers get a display
// name and a "mine" flag, never another user's uid or email.

import { randomBytes } from "node:crypto"
import { ApiError } from "@/lib/api-auth"
import type { DocDb, DocTx } from "@/lib/doc-db"
import { badgesFor, type Badge } from "./badges"
import { assertId, MATCH_ID, MESSAGE_ID, opaqueRef, ROOM_ID } from "./content"
import { requireAccepted } from "./gate"

export const DEFAULT_SLOW_MODE_SECONDS = 5
export const PAGE_SIZE = 30
const MAX_BLOCKS = 500

export interface ChatRoomState {
  locked?: boolean
  slowModeSeconds?: number
  notice?: { text: string; by: string; pinnedAtUTC: string } | null
}

interface BlockList {
  blocked: string[]
  names?: Record<string, string>
}

export interface StoredMessage {
  sortKey: string
  uid: string
  displayName: string
  text: string
  createdAtUTC: string
  removed: boolean
  removedReason?: string
  reactionCounts?: Record<string, number>
  /** Set when the author deleted their account: uid is empty and text may be too. */
  formerMember?: boolean
}

export interface Sanction {
  type: "mute" | "suspend"
  untilUTC: string
  reason: string
}

export type ReportScope = "match" | "room"

export const chatPath = (matchId: string) => `match_chats/${matchId}`
export const messagesPath = (scope: ReportScope, scopeId: string) =>
  scope === "match" ? `${chatPath(scopeId)}/messages` : `rooms/${scopeId}/messages`

export function newMessageId(now: Date): string {
  return `${String(now.getTime()).padStart(13, "0")}-${randomBytes(4).toString("hex")}`
}

/** Suspension stops all community writes; a mute stops messages only. */
export function assertNotSanctioned(sanction: Sanction | null, now: Date, action: "post" | "participate"): void {
  if (!sanction || now.getTime() >= Date.parse(sanction.untilUTC)) return
  if (sanction.type === "suspend" || action === "post") {
    throw new ApiError(403, "sanctioned", "Your account cannot do this right now")
  }
}

export const readSanction = (tx: Pick<DocTx, "get">, uid: string) => tx.get<Sanction>(`community_sanctions/${uid}`)

export const reactionPath = (scopeId: string, messageId: string, uid: string) => `message_reactions/${scopeId}_${messageId}_${uid}`
export const matchParticipantPath = (matchId: string, uid: string) => `match_chat_participants/${matchId}_${uid}`

export async function postMatchMessage(
  db: DocDb,
  input: { matchId: string; uid: string; displayName: string; text: string },
  now: Date,
): Promise<{ id: string }> {
  const { matchId, uid, displayName, text } = input
  const participantPath = matchParticipantPath(matchId, uid)

  return db.transaction(async (tx) => {
    const room = await tx.get<ChatRoomState>(chatPath(matchId))
    const sanction = await readSanction(tx, uid)
    const participant = await tx.get<{ lastPostMs: number }>(participantPath)

    await requireAccepted(tx, uid)
    if (room?.locked) throw new ApiError(423, "room_locked", "This chat is locked")
    assertNotSanctioned(sanction, now, "post")
    const slowModeMs = (room?.slowModeSeconds ?? DEFAULT_SLOW_MODE_SECONDS) * 1000
    if (participant && now.getTime() - participant.lastPostMs < slowModeMs) {
      throw new ApiError(429, "slow_mode", "Slow mode is on. Wait a moment before posting again.")
    }

    const id = newMessageId(now)
    const message: StoredMessage = { sortKey: id, uid, displayName, text, createdAtUTC: now.toISOString(), removed: false }
    tx.set(`${messagesPath("match", matchId)}/${id}`, message)
    tx.set(participantPath, { uid, matchId, lastPostMs: now.getTime() })
    return { id }
  })
}

export function toPublicMessage(id: string, message: StoredMessage, viewerUid: string | null, myReaction: string | null = null, badges: Badge[] = []) {
  return {
    id,
    displayName: message.displayName,
    badges: message.formerMember ? [] : badges,
    text: message.removed || message.formerMember ? "" : message.text,
    createdAtUTC: message.createdAtUTC,
    removed: message.removed,
    formerMember: message.formerMember === true,
    mine: viewerUid === message.uid,
    reactions: Object.fromEntries(Object.entries(message.reactionCounts ?? {}).filter(([, count]) => count > 0)),
    myReaction,
  }
}

export async function listMessages(
  db: Pick<DocDb, "get" | "query">,
  input: { scope: ReportScope; scopeId: string; viewerUid: string | null; cursor?: string | null },
) {
  const { scope, scopeId, viewerUid, cursor } = input
  if (cursor) assertId(cursor, MESSAGE_ID)
  const rows = await db.query<StoredMessage>(messagesPath(scope, scopeId), {
    orderBy: { field: "sortKey", direction: "desc" },
    limit: PAGE_SIZE,
    startAfter: cursor ?? undefined,
  })
  const blocked = viewerUid ? (await db.get<BlockList>(`user_blocks/${viewerUid}`))?.blocked ?? [] : []
  const mine = viewerUid
    ? await db.query<{ messageId: string; reaction: string }>("message_reactions", { where: [["uid", viewerUid], ["scopeId", scopeId]] })
    : []
  const myReactions = new Map(mine.map((row) => [row.messageId, row.reaction]))
  const shown = rows.filter((row) => !blocked.includes(row.uid))
  const badges = await badgesFor(db, shown.map((row) => row.uid))
  return {
    messages: shown.map((row) => toPublicMessage(row.id, row, viewerUid, myReactions.get(row.id) ?? null, badges.get(row.uid))),
    nextCursor: rows.length === PAGE_SIZE ? rows[rows.length - 1].id : null,
  }
}

function scopePattern(scope: ReportScope) {
  return scope === "match" ? MATCH_ID : ROOM_ID
}

export async function assertScopeAccess(db: Pick<DocDb, "get">, scope: ReportScope, scopeId: string, uid: string) {
  if (scope !== "room") return
  const member = await db.get<{ status: string }>(`room_members/${scopeId}_${uid}`)
  if (member?.status !== "active") throw new ApiError(404, "not_found", "Not found")
}

async function findMessage(db: Pick<DocDb, "get">, scope: ReportScope, scopeId: string, messageId: string) {
  assertId(scopeId, scopePattern(scope))
  assertId(messageId, MESSAGE_ID)
  const message = await db.get<StoredMessage>(`${messagesPath(scope, scopeId)}/${messageId}`)
  if (!message || message.formerMember) throw new ApiError(404, "not_found", "Not found")
  return message
}

/** Author and text are copied from the stored message, so a report cannot name a false target. */
export async function reportMessage(
  db: DocDb,
  input: { scope: ReportScope; scopeId: string; messageId: string; reporterUid: string; reason: string },
  now: Date,
): Promise<{ id: string }> {
  const { scope, scopeId, messageId, reporterUid, reason } = input
  await assertScopeAccess(db, scope, scopeId, reporterUid)
  const message = await findMessage(db, scope, scopeId, messageId)
  const id = `${messageId}_${reporterUid}`
  await db.transaction(async (tx) => {
    await requireAccepted(tx, reporterUid)
    if (await tx.get(`community_reports/${id}`)) return
    tx.set(`community_reports/${id}`, {
      scope, scopeId, messageId, reporterUid, reason,
      targetUid: message.uid,
      messageText: message.text,
      status: "open",
      createdAtUTC: now.toISOString(),
    })
  })
  return { id }
}

export async function blockAuthor(
  db: DocDb,
  input: { scope: ReportScope; scopeId: string; messageId: string; uid: string },
): Promise<void> {
  const { scope, scopeId, messageId, uid } = input
  await assertScopeAccess(db, scope, scopeId, uid)
  const message = await findMessage(db, scope, scopeId, messageId)
  if (message.uid === uid) throw new ApiError(400, "invalid_request", "You cannot block yourself")

  await db.transaction(async (tx) => {
    await requireAccepted(tx, uid)
    const list = await tx.get<BlockList>(`user_blocks/${uid}`)
    const blocked = list?.blocked ?? []
    if (blocked.includes(message.uid)) return
    if (blocked.length >= MAX_BLOCKS) throw new ApiError(409, "block_limit", "Your block list is full")
    tx.set(`user_blocks/${uid}`, { blocked: [...blocked, message.uid], names: { ...list?.names, [message.uid]: message.displayName } })
  })
}

const blockRef = (viewerUid: string, blockedUid: string) => opaqueRef(`block:${viewerUid}`, blockedUid)

export async function listBlocked(db: Pick<DocDb, "get">, uid: string) {
  const list = await db.get<BlockList>(`user_blocks/${uid}`)
  return (list?.blocked ?? []).map((blockedUid) => ({ ref: blockRef(uid, blockedUid), displayName: list?.names?.[blockedUid] ?? "Fan" }))
}

export async function unblockAuthor(db: DocDb, input: { uid: string; ref: string }): Promise<void> {
  const { uid, ref } = input
  await db.transaction(async (tx) => {
    await requireAccepted(tx, uid)
    const list = await tx.get<BlockList>(`user_blocks/${uid}`)
    const target = list?.blocked.find((blockedUid) => blockRef(uid, blockedUid) === ref)
    if (!list || !target) throw new ApiError(404, "not_found", "Not found")
    const { [target]: _removed, ...names } = list.names ?? {}
    tx.set(`user_blocks/${uid}`, { blocked: list.blocked.filter((blockedUid) => blockedUid !== target), names })
  })
}
