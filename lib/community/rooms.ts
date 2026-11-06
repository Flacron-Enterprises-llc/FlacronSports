// Private watch rooms. A room shares conversation only: it never rebroadcasts
// video or stands in for anyone's own right to watch.
//
// Every limit is checked inside a transaction. room_hosts/{uid} is written on each
// creation so that concurrent creates by one host conflict and retry.

import { createHash, randomBytes } from "node:crypto"
import { ApiError } from "@/lib/api-auth"
import { purchaseLive, ROOM_PASS_PARTICIPANTS, type BillingPurchase } from "@/lib/billing/addons"
import { spendableCredits } from "@/lib/billing/allowance"
import { PLANS, type PlanId } from "@/lib/billing/plans"
import type { DocDb, DocTx, Row } from "@/lib/doc-db"
import { assertNotSanctioned, newMessageId, messagesPath, readSanction, type StoredMessage } from "./chat"
import { opaqueRef } from "./content"
import { requireAccepted } from "./gate"

const ROOM_LIFETIME_HOURS = 24

export type MemberStatus = "active" | "removed" | "left"

export interface Room {
  matchId: string
  hostUid: string
  name: string
  participantCap: number
  memberCount: number
  status: "active" | "closed"
  locked: boolean
  passPurchaseId: string | null
  inviteHash: string | null
  createdAtUTC: string
  expiresAtUTC: string
  /** Set on a fan club, which is a room so that chat, reports and moderation all apply. */
  kind?: "club"
  slowModeSeconds?: number
}

export interface Member {
  roomId: string
  uid: string
  displayName: string
  role: "host" | "member"
  status: MemberStatus
  joinedAtUTC: string
  kind?: "club"
  lastPostMs?: number
}

export const roomPath = (id: string) => `rooms/${id}`
export const memberPath = (roomId: string, uid: string) => `room_members/${roomId}_${uid}`
export const invitePath = (hash: string) => `room_invites/${hash}`
const notFound = () => new ApiError(404, "not_found", "Not found")

export const hashInvite = (token: string) => createHash("sha256").update(token).digest("hex")

function newInvite() {
  const token = randomBytes(32).toString("base64url")
  return { token, hash: hashInvite(token) }
}

/** Free hosts have no base slots, so a room pass is their only way to create a room. */
export function decideRoomSlot(plan: PlanId, activeBaseRooms: number, passes: Row<BillingPurchase>[]) {
  const limits = PLANS[plan].privateRooms
  if (limits && activeBaseRooms < limits.active) return { cap: limits.participantsPerRoom, pass: null }
  const pass = passes[0]
  if (pass) return { cap: ROOM_PASS_PARTICIPANTS, pass }
  throw limits
    ? new ApiError(403, "room_limit", "You have reached your active room limit")
    : new ApiError(403, "plan_required", "Your plan can join rooms but not create them")
}

export async function createRoom(
  db: DocDb,
  input: { uid: string; displayName: string; plan: PlanId; matchId: string; name: string; participantLimit?: number; kickoffUTC: string | null },
  now: Date,
) {
  const { uid, displayName, plan, matchId, name, participantLimit, kickoffUTC } = input
  const nowMs = now.getTime()

  return db.transaction(async (tx) => {
    const host = await tx.get<{ updatedAtMs: number }>(`room_hosts/${uid}`)
    const sanction = await readSanction(tx, uid)
    const hosted = await tx.query<Room>("rooms", { where: [["hostUid", uid], ["status", "active"]] })
    const purchases = await tx.query<BillingPurchase>("billing_purchases", { where: [["uid", uid], ["unit", "room"]] })

    await requireAccepted(tx, uid)
    assertNotSanctioned(sanction, now, "participate")
    const activeBase = hosted.filter((room) => !room.passPurchaseId && nowMs < Date.parse(room.expiresAtUTC)).length
    const slot = decideRoomSlot(plan, activeBase, spendableCredits(purchases, nowMs))

    const id = randomBytes(12).toString("hex")
    const invite = newInvite()
    const baseExpiry = Math.max(nowMs, kickoffUTC ? Date.parse(kickoffUTC) : nowMs) + ROOM_LIFETIME_HOURS * 3_600_000
    const room: Room = {
      matchId, hostUid: uid, name,
      participantCap: Math.min(participantLimit ?? slot.cap, slot.cap),
      memberCount: 1,
      status: "active",
      locked: false,
      passPurchaseId: slot.pass?.id ?? null,
      inviteHash: invite.hash,
      createdAtUTC: now.toISOString(),
      expiresAtUTC: slot.pass ? slot.pass.expiresAtUTC : new Date(baseExpiry).toISOString(),
    }
    const member: Member = { roomId: id, uid, displayName, role: "host", status: "active", joinedAtUTC: now.toISOString() }

    tx.set(roomPath(id), room)
    tx.set(memberPath(id, uid), member)
    tx.set(invitePath(invite.hash), { roomId: id, revoked: false })
    tx.set(`room_hosts/${uid}`, { updatedAtMs: Math.max(nowMs, (host?.updatedAtMs ?? 0) + 1) })
    if (slot.pass) tx.set(`billing_purchases/${slot.pass.id}`, { consumed: slot.pass.consumed + 1, roomId: id }, { merge: true })
    return { id, room, inviteToken: invite.token }
  })
}

/** A refunded or expired pass closes its room to new joins and messages. */
export async function assertRoomOpen(tx: Pick<DocTx, "get">, room: Room | null, now: Date): Promise<Room> {
  if (!room || room.status !== "active") throw notFound()
  if (now.getTime() >= Date.parse(room.expiresAtUTC)) throw new ApiError(410, "room_expired", "This room has expired")
  if (room.locked) throw new ApiError(423, "room_locked", "This room is locked")
  if (room.passPurchaseId) {
    const pass = await tx.get<BillingPurchase>(`billing_purchases/${room.passPurchaseId}`)
    if (!pass || !purchaseLive(pass, now.getTime())) throw new ApiError(410, "room_expired", "This room has expired")
  }
  return room
}

/** The host's current plan applies, so a downgrade lowers the cap for new joins only. */
export function joinCap(room: Pick<Room, "participantCap" | "passPurchaseId">, hostPlan: PlanId): number {
  const limit = room.passPurchaseId ? ROOM_PASS_PARTICIPANTS : PLANS[hostPlan].privateRooms?.participantsPerRoom ?? 0
  return Math.min(room.participantCap, limit)
}

export async function joinRoom(
  db: DocDb,
  input: { uid: string; displayName: string; token: string; hostPlan(hostUid: string): Promise<PlanId> },
  now: Date,
): Promise<{ id: string }> {
  const hash = hashInvite(input.token)
  const preview = await db.get<{ roomId: string; revoked: boolean }>(invitePath(hash))
  if (!preview || preview.revoked) throw new ApiError(404, "invite_invalid", "This invitation is not valid")
  const previewRoom = await db.get<Room>(roomPath(preview.roomId))
  if (!previewRoom) throw new ApiError(404, "invite_invalid", "This invitation is not valid")
  const hostPlan = await input.hostPlan(previewRoom.hostUid)

  return db.transaction(async (tx) => {
    const invite = await tx.get<{ roomId: string; revoked: boolean }>(invitePath(hash))
    if (!invite || invite.revoked) throw new ApiError(404, "invite_invalid", "This invitation is not valid")
    const roomId = invite.roomId
    const current = await tx.get<Room>(roomPath(roomId))
    const existing = await tx.get<Member>(memberPath(roomId, input.uid))
    const sanction = await readSanction(tx, input.uid)
    await requireAccepted(tx, input.uid)
    const room = await assertRoomOpen(tx, current, now)

    assertNotSanctioned(sanction, now, "participate")
    if (existing?.status === "active") return { id: roomId }
    if (existing?.status === "removed") throw new ApiError(403, "removed_from_room", "You were removed from this room")
    if (room.memberCount >= joinCap(room, hostPlan)) throw new ApiError(409, "room_full", "This room is full")

    const member: Member = { roomId, uid: input.uid, displayName: input.displayName, role: "member", status: "active", joinedAtUTC: now.toISOString() }
    tx.set(memberPath(roomId, input.uid), member)
    tx.set(roomPath(roomId), { memberCount: room.memberCount + 1 }, { merge: true })
    return { id: roomId }
  })
}

/** Nonmembers get the same 404 as a room that does not exist. */
export async function getRoomAsMember(db: Pick<DocDb, "get" | "query">, roomId: string, uid: string) {
  const member = await db.get<Member>(memberPath(roomId, uid))
  if (member?.status !== "active") throw notFound()
  const room = await db.get<Room>(roomPath(roomId))
  if (!room) throw notFound()

  const isHost = room.hostUid === uid
  const members = isHost ? await db.query<Member>("room_members", { where: [["roomId", roomId], ["status", "active"]] }) : []
  const { name, participantCap, memberCount, status, locked, expiresAtUTC, inviteHash } = room
  return {
    id: roomId,
    room: { name, participantCap, memberCount, status, locked, expiresAtUTC, inviteActive: Boolean(inviteHash) },
    isHost,
    members: members.map(({ uid: memberUid, displayName, role }) => ({ ref: memberRef(roomId, memberUid), displayName, role })),
  }
}

const memberRef = (roomId: string, uid: string) => opaqueRef(`room:${roomId}`, uid)

export async function resolveMemberRef(db: Pick<DocDb, "query">, roomId: string, ref: string): Promise<string> {
  const members = await db.query<Member>("room_members", { where: [["roomId", roomId], ["status", "active"]] })
  const member = members.find((row) => memberRef(roomId, row.uid) === ref)
  if (!member) throw notFound()
  return member.uid
}

export async function listMyRooms(db: Pick<DocDb, "get" | "query">, uid: string) {
  const memberships = await db.query<Member>("room_members", { where: [["uid", uid], ["status", "active"]] })
  const rooms = await Promise.all(memberships.map(async (member) => ({ id: member.roomId, role: member.role, room: await db.get<Room>(roomPath(member.roomId)) })))
  return rooms.flatMap(({ id, role, room }) =>
    room && room.status === "active" && room.kind !== "club"
      ? [{ id, role, name: room.name, matchId: room.matchId, memberCount: room.memberCount, expiresAtUTC: room.expiresAtUTC }]
      : [],
  )
}

async function hostRoom(tx: Pick<DocTx, "get">, roomId: string, uid: string): Promise<Room> {
  await requireAccepted(tx, uid)
  const room = await tx.get<Room>(roomPath(roomId))
  const member = await tx.get<Member>(memberPath(roomId, uid))
  if (!room || member?.status !== "active") throw notFound()
  if (room.hostUid !== uid) throw new ApiError(403, "forbidden", "Only the host can do this")
  return room
}

/** Rotates the link when replace is true; otherwise the room simply has none. */
export function revokeInvite(db: DocDb, input: { roomId: string; uid: string; replace: boolean }) {
  return db.transaction(async (tx) => {
    const room = await hostRoom(tx, input.roomId, input.uid)
    if (room.inviteHash) tx.set(invitePath(room.inviteHash), { roomId: input.roomId, revoked: true })
    if (!input.replace) {
      tx.set(roomPath(input.roomId), { inviteHash: null }, { merge: true })
      return { inviteToken: null }
    }
    const invite = newInvite()
    tx.set(invitePath(invite.hash), { roomId: input.roomId, revoked: false })
    tx.set(roomPath(input.roomId), { inviteHash: invite.hash }, { merge: true })
    return { inviteToken: invite.token }
  })
}

/** A removed participant stays out, even with a fresh invitation. Leaving is reversible. */
export function removeMember(db: DocDb, input: { roomId: string; actorUid: string; targetUid: string }) {
  const { roomId, actorUid, targetUid } = input
  return db.transaction(async (tx) => {
    const room = await tx.get<Room>(roomPath(roomId))
    const actor = await tx.get<Member>(memberPath(roomId, actorUid))
    const target = await tx.get<Member>(memberPath(roomId, targetUid))
    await requireAccepted(tx, actorUid)
    if (!room || actor?.status !== "active") throw notFound()
    const leaving = actorUid === targetUid
    if (!leaving && room.hostUid !== actorUid) throw new ApiError(403, "forbidden", "Only the host can do this")
    if (room.hostUid === targetUid) throw new ApiError(400, "invalid_request", "The host cannot leave. Close the room instead.")
    if (target?.status !== "active") throw notFound()

    tx.set(memberPath(roomId, targetUid), { status: leaving ? "left" : "removed" }, { merge: true })
    tx.set(roomPath(roomId), { memberCount: Math.max(1, room.memberCount - 1) }, { merge: true })
  })
}

export function closeRoom(db: DocDb, input: { roomId: string; uid: string }) {
  return db.transaction(async (tx) => {
    const room = await hostRoom(tx, input.roomId, input.uid)
    const host = await tx.get<{ updatedAtMs: number }>(`room_hosts/${input.uid}`)
    if (room.inviteHash) tx.set(invitePath(room.inviteHash), { roomId: input.roomId, revoked: true })
    tx.set(roomPath(input.roomId), { status: "closed", inviteHash: null }, { merge: true })
    tx.set(`room_hosts/${input.uid}`, { updatedAtMs: (host?.updatedAtMs ?? 0) + 1 })
  })
}

export function postRoomMessage(db: DocDb, input: { roomId: string; uid: string; text: string }, now: Date): Promise<{ id: string }> {
  const { roomId, uid, text } = input
  return db.transaction(async (tx) => {
    const member = await tx.get<Member>(memberPath(roomId, uid))
    if (member?.status !== "active") throw notFound()
    await requireAccepted(tx, uid)
    const current = await tx.get<Room>(roomPath(roomId))
    const sanction = await readSanction(tx, uid)
    const room = await assertRoomOpen(tx, current, now)
    assertNotSanctioned(sanction, now, "post")
    if (room.slowModeSeconds && member.lastPostMs && now.getTime() - member.lastPostMs < room.slowModeSeconds * 1000) {
      throw new ApiError(429, "slow_mode", "Slow mode is on. Wait a moment before posting again.")
    }

    const id = newMessageId(now)
    const message: StoredMessage = { sortKey: id, uid, displayName: member.displayName, text, createdAtUTC: now.toISOString(), removed: false }
    tx.set(`${messagesPath("room", roomId)}/${id}`, message)
    if (room.slowModeSeconds) tx.set(memberPath(roomId, uid), { lastPostMs: now.getTime() }, { merge: true })
    return { id }
  })
}

export async function assertRoomMember(db: Pick<DocDb, "get">, roomId: string, uid: string): Promise<void> {
  const member = await db.get<Member>(memberPath(roomId, uid))
  if (member?.status !== "active") throw notFound()
}
