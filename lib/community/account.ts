// Community side of data rights. Nothing here needs a collection-group query: each
// person's chats are found from match_chat_participants and room_members, then each
// chat is read by uid on its automatic single-field index.

import type { DocDb } from "@/lib/doc-db"
import { messagesPath, matchParticipantPath, reactionPath, type ReportScope, type StoredMessage } from "./chat"
import { FORMER_MEMBER } from "./content"
import type { PollVote, StoredReaction } from "./engagement"
import { acceptancePath, type Acceptance } from "./gate"
import type { CommunityReport } from "./moderation"
import type { Prediction } from "./predictions"
import { invitePath, memberPath, roomPath, type Member, type Room } from "./rooms"

type Chat = { scope: ReportScope; scopeId: string }
type BlockDoc = { blocked: string[]; names?: Record<string, string> }

async function chatsOf(db: Pick<DocDb, "query">, uid: string) {
  const matches = await db.query<{ matchId: string }>("match_chat_participants", { where: [["uid", uid]] })
  const memberships = await db.query<Member>("room_members", { where: [["uid", uid]] })
  const chats: Chat[] = [
    ...matches.map((row) => ({ scope: "match" as const, scopeId: row.matchId })),
    ...memberships.map((row) => ({ scope: "room" as const, scopeId: row.roomId })),
  ]
  return { matches, memberships, chats }
}

async function messagesIn(db: Pick<DocDb, "query">, chats: Chat[], uid: string) {
  const perChat = await Promise.all(
    chats.map(async (chat) => {
      const rows = await db.query<StoredMessage>(messagesPath(chat.scope, chat.scopeId), { where: [["uid", uid]] })
      return rows.map((row) => ({ ...chat, row }))
    }),
  )
  return perChat.flat()
}

export async function exportCommunityData(db: Pick<DocDb, "get" | "query">, uid: string) {
  const { memberships, chats } = await chatsOf(db, uid)
  const messages = await messagesIn(db, chats, uid)
  const rooms = await Promise.all(memberships.map(async (member) => ({ member, room: await db.get<Room>(roomPath(member.roomId)) })))
  const predictions = await db.query<Prediction>("predictions", { where: [["uid", uid]] })
  const reactions = await db.query<StoredReaction>("message_reactions", { where: [["uid", uid]] })
  const pollVotes = await db.query<PollVote>("poll_votes", { where: [["uid", uid]] })
  const blocks = await db.get<BlockDoc>(`user_blocks/${uid}`)
  const acceptance = await db.get<Acceptance>(acceptancePath(uid))

  return {
    messages: messages.map(({ scope, scopeId, row }) => ({ scope, scopeId, text: row.text, createdAtUTC: row.createdAtUTC, removedByModerator: row.removed })),
    rooms: rooms.map(({ member, room }) => ({
      name: room?.name ?? null,
      matchId: room?.matchId ?? null,
      role: member.role,
      membership: member.status,
      joinedAtUTC: member.joinedAtUTC,
    })),
    predictions: predictions.map(({ matchId, home, away, createdAtUTC, settled, voided, points }) => ({ matchId, home, away, createdAtUTC, settled, voided, points })),
    reactions: reactions.map(({ scope, scopeId, reaction, createdAtUTC }) => ({ scope, scopeId, reaction, createdAtUTC })),
    pollVotes: pollVotes.map(({ matchId, option, createdAtUTC }) => ({ matchId, option, createdAtUTC })),
    blockedPeople: (blocks?.blocked ?? []).map((blockedUid) => blocks?.names?.[blockedUid] ?? "Fan"),
    guidelinesAcceptance: acceptance && { version: acceptance.guidelinesVersion, acceptedAtUTC: acceptance.acceptedAtUTC },
  }
}

/**
 * Safe to run again after a partial failure. Messages come first because the
 * memberships deleted later are how they are found. Reports and sanctions stay as
 * enforcement records under Privacy Policy section 2.9.
 */
export async function eraseCommunityData(db: DocDb, uid: string): Promise<void> {
  const { matches, memberships, chats } = await chatsOf(db, uid)

  const reports = await db.query<CommunityReport>("community_reports", { where: [["targetUid", uid], ["status", "open"]] })
  const underReview = new Set(reports.map((report) => report.messageId))
  for (const { scope, scopeId, row } of await messagesIn(db, chats, uid)) {
    const keepText = row.removed || underReview.has(row.id)
    await db.set(`${messagesPath(scope, scopeId)}/${row.id}`, { uid: "", displayName: FORMER_MEMBER, formerMember: true, text: keepText ? row.text : "" }, { merge: true })
  }

  const reactions = await db.query<StoredReaction>("message_reactions", { where: [["uid", uid]] })
  for (const row of reactions) {
    await db.transaction(async (tx) => {
      const path = `${messagesPath(row.scope, row.scopeId)}/${row.messageId}`
      const message = await tx.get<StoredMessage>(path)
      if (message) {
        const counts = { ...message.reactionCounts, [row.reaction]: Math.max(0, (message.reactionCounts?.[row.reaction] ?? 0) - 1) }
        tx.set(path, { reactionCounts: counts }, { merge: true })
      }
      tx.delete(reactionPath(row.scopeId, row.messageId, uid))
    })
  }

  const hosted = await db.query<Room>("rooms", { where: [["hostUid", uid]] })
  for (const room of hosted) {
    await db.transaction(async (tx) => {
      if (room.inviteHash) tx.set(invitePath(room.inviteHash), { roomId: room.id, revoked: true })
      tx.set(roomPath(room.id), { hostUid: "", name: "", status: "closed", inviteHash: null }, { merge: true })
    })
  }

  for (const member of memberships) {
    await db.transaction(async (tx) => {
      const room = await tx.get<Room>(roomPath(member.roomId))
      const current = await tx.get<Member>(memberPath(member.roomId, uid))
      if (room?.status === "active" && current?.status === "active") {
        tx.set(roomPath(member.roomId), { memberCount: Math.max(1, room.memberCount - 1) }, { merge: true })
      }
      tx.delete(memberPath(member.roomId, uid))
    })
  }

  const blockedBy = await db.query<BlockDoc>("user_blocks", { arrayContains: ["blocked", uid] })
  for (const row of blockedBy) {
    const { [uid]: _removed, ...names } = row.names ?? {}
    await db.set(`user_blocks/${row.id}`, { blocked: row.blocked.filter((blockedUid) => blockedUid !== uid), names })
  }

  const predictions = await db.query<Prediction>("predictions", { where: [["uid", uid]] })
  const votes = await db.query<PollVote>("poll_votes", { where: [["uid", uid]] })
  await Promise.all([
    ...predictions.map((row) => db.delete(`predictions/${row.id}`)),
    ...votes.map((row) => db.delete(`poll_votes/${row.id}`)),
    ...matches.map((row) => db.delete(matchParticipantPath(row.matchId, uid))),
    db.delete(`prediction_points/${uid}`),
    db.delete(`user_blocks/${uid}`),
    db.delete(`room_hosts/${uid}`),
    db.delete(acceptancePath(uid)),
  ])
}
