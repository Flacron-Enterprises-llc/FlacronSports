// Private prediction groups. A group is only a shared view of its members' league
// points: there are no stakes, entry fees or prizes, and nothing is scored here, so
// a corrected result reaches every group through the league total.

import { createHash, randomBytes } from "node:crypto"
import { ApiError } from "@/lib/api-auth"
import type { DocDb, DocTx } from "@/lib/doc-db"
import { badgesFor } from "./badges"
import { assertNotSanctioned, readSanction } from "./chat"
import { opaqueRef } from "./content"
import { requireAccepted } from "./gate"
import { sharedRanks } from "./predictions"

export const MAX_GROUP_MEMBERS = 50
export const MAX_GROUPS_OWNED = 5

export interface Group {
  ownerUid: string
  name: string
  memberCount: number
  status: "active" | "closed"
  inviteHash: string | null
  createdAtUTC: string
}

export interface GroupMember {
  groupId: string
  uid: string
  displayName: string
  role: "owner" | "member"
  status: "active" | "removed" | "left"
  joinedAtUTC: string
}

interface GroupInvite {
  groupId: string
  revoked: boolean
}

export const groupPath = (id: string) => `prediction_groups/${id}`
export const groupMemberPath = (groupId: string, uid: string) => `prediction_group_members/${groupId}_${uid}`
export const groupInvitePath = (hash: string) => `prediction_group_invites/${hash}`
export const groupOwnerPath = (uid: string) => `prediction_group_owners/${uid}`
const memberRef = (groupId: string, uid: string) => opaqueRef(`group:${groupId}`, uid)
const notFound = () => new ApiError(404, "not_found", "Not found")
const invalidInvite = () => new ApiError(404, "invite_invalid", "This invitation is not valid")

const hashInvite = (token: string) => createHash("sha256").update(token).digest("hex")

function newInvite() {
  const token = randomBytes(32).toString("base64url")
  return { token, hash: hashInvite(token) }
}

/** The owner document makes two concurrent creates by one person conflict and retry. */
export async function createGroup(db: DocDb, input: { uid: string; displayName: string; name: string }, now: Date) {
  const { uid, displayName, name } = input
  return db.transaction(async (tx) => {
    const owner = await tx.get<{ updatedAtMs: number }>(groupOwnerPath(uid))
    const owned = await tx.query<Group>("prediction_groups", { where: [["ownerUid", uid], ["status", "active"]] })
    const sanction = await readSanction(tx, uid)
    await requireAccepted(tx, uid)
    assertNotSanctioned(sanction, now, "participate")
    if (owned.length >= MAX_GROUPS_OWNED) throw new ApiError(409, "group_limit", "You have reached your group limit")

    const id = randomBytes(12).toString("hex")
    const invite = newInvite()
    const group: Group = { ownerUid: uid, name, memberCount: 1, status: "active", inviteHash: invite.hash, createdAtUTC: now.toISOString() }
    const member: GroupMember = { groupId: id, uid, displayName, role: "owner", status: "active", joinedAtUTC: now.toISOString() }
    tx.set(groupPath(id), group)
    tx.set(groupMemberPath(id, uid), member)
    tx.set(groupInvitePath(invite.hash), { groupId: id, revoked: false })
    tx.set(groupOwnerPath(uid), { updatedAtMs: Math.max(now.getTime(), (owner?.updatedAtMs ?? 0) + 1) })
    return { id, inviteToken: invite.token }
  })
}

export function joinGroup(db: DocDb, input: { uid: string; displayName: string; token: string }, now: Date): Promise<{ id: string }> {
  const hash = hashInvite(input.token)
  return db.transaction(async (tx) => {
    const invite = await tx.get<GroupInvite>(groupInvitePath(hash))
    if (!invite || invite.revoked) throw invalidInvite()
    const { groupId } = invite
    const group = await tx.get<Group>(groupPath(groupId))
    const existing = await tx.get<GroupMember>(groupMemberPath(groupId, input.uid))
    const sanction = await readSanction(tx, input.uid)
    await requireAccepted(tx, input.uid)
    if (group?.status !== "active") throw invalidInvite()
    assertNotSanctioned(sanction, now, "participate")
    if (existing?.status === "active") return { id: groupId }
    if (existing?.status === "removed") throw new ApiError(403, "removed_from_group", "You were removed from this group")
    if (group.memberCount >= MAX_GROUP_MEMBERS) throw new ApiError(409, "group_full", "This group is full")

    const member: GroupMember = { groupId, uid: input.uid, displayName: input.displayName, role: "member", status: "active", joinedAtUTC: now.toISOString() }
    tx.set(groupMemberPath(groupId, input.uid), member)
    tx.set(groupPath(groupId), { memberCount: group.memberCount + 1 }, { merge: true })
    return { id: groupId }
  })
}

export async function listMyGroups(db: Pick<DocDb, "get" | "query">, uid: string) {
  const memberships = await db.query<GroupMember>("prediction_group_members", { where: [["uid", uid], ["status", "active"]] })
  const groups = await Promise.all(memberships.map(async (member) => ({ member, group: await db.get<Group>(groupPath(member.groupId)) })))
  return groups.flatMap(({ member, group }) =>
    group?.status === "active" ? [{ id: member.groupId, name: group.name, role: member.role, memberCount: group.memberCount }] : [],
  )
}

/** Nonmembers get the same 404 as a group that does not exist. */
export async function getGroup(db: Pick<DocDb, "get" | "query">, groupId: string, uid: string) {
  const member = await db.get<GroupMember>(groupMemberPath(groupId, uid))
  const group = await db.get<Group>(groupPath(groupId))
  if (member?.status !== "active" || group?.status !== "active") throw notFound()

  const members = await db.query<GroupMember>("prediction_group_members", { where: [["groupId", groupId], ["status", "active"]] })
  const [totals, badges] = await Promise.all([
    Promise.all(members.map((row) => db.get<{ points: number }>(`prediction_points/${row.uid}`))),
    badgesFor(db, members.map((row) => row.uid)),
  ])
  const scored = members.map((row, index) => ({ row, points: totals[index]?.points ?? 0 })).sort((a, b) => b.points - a.points)
  const isOwner = group.ownerUid === uid
  return {
    id: groupId,
    name: group.name,
    memberCount: group.memberCount,
    cap: MAX_GROUP_MEMBERS,
    isOwner,
    inviteActive: Boolean(group.inviteHash),
    entries: sharedRanks(scored).map(({ rank, points, row }) => ({
      rank, points,
      ref: memberRef(groupId, row.uid),
      displayName: row.displayName,
      role: row.role,
      mine: row.uid === uid,
      badges: badges.get(row.uid) ?? [],
    })),
  }
}

export async function resolveGroupMemberRef(db: Pick<DocDb, "query">, groupId: string, ref: string): Promise<string> {
  const members = await db.query<GroupMember>("prediction_group_members", { where: [["groupId", groupId], ["status", "active"]] })
  const member = members.find((row) => memberRef(groupId, row.uid) === ref)
  if (!member) throw notFound()
  return member.uid
}

async function ownedGroup(tx: Pick<DocTx, "get">, groupId: string, uid: string): Promise<Group> {
  await requireAccepted(tx, uid)
  const group = await tx.get<Group>(groupPath(groupId))
  const member = await tx.get<GroupMember>(groupMemberPath(groupId, uid))
  if (group?.status !== "active" || member?.status !== "active") throw notFound()
  if (group.ownerUid !== uid) throw new ApiError(403, "forbidden", "Only the owner can do this")
  return group
}

/** Rotates the link when replace is true; otherwise the group simply has none. */
export function revokeGroupInvite(db: DocDb, input: { groupId: string; uid: string; replace: boolean }) {
  const { groupId, uid, replace } = input
  return db.transaction(async (tx) => {
    const group = await ownedGroup(tx, groupId, uid)
    if (group.inviteHash) tx.set(groupInvitePath(group.inviteHash), { groupId, revoked: true })
    if (!replace) {
      tx.set(groupPath(groupId), { inviteHash: null }, { merge: true })
      return { inviteToken: null }
    }
    const invite = newInvite()
    tx.set(groupInvitePath(invite.hash), { groupId, revoked: false })
    tx.set(groupPath(groupId), { inviteHash: invite.hash }, { merge: true })
    return { inviteToken: invite.token }
  })
}

/** A removed member stays out, even with a fresh invitation. Leaving is reversible. */
export function removeGroupMember(db: DocDb, input: { groupId: string; actorUid: string; targetUid: string }) {
  const { groupId, actorUid, targetUid } = input
  return db.transaction(async (tx) => {
    const group = await tx.get<Group>(groupPath(groupId))
    const actor = await tx.get<GroupMember>(groupMemberPath(groupId, actorUid))
    const target = await tx.get<GroupMember>(groupMemberPath(groupId, targetUid))
    await requireAccepted(tx, actorUid)
    if (group?.status !== "active" || actor?.status !== "active") throw notFound()
    const leaving = actorUid === targetUid
    if (!leaving && group.ownerUid !== actorUid) throw new ApiError(403, "forbidden", "Only the owner can do this")
    if (group.ownerUid === targetUid) throw new ApiError(400, "invalid_request", "The owner cannot leave. Close the group instead.")
    if (target?.status !== "active") throw notFound()
    tx.set(groupMemberPath(groupId, targetUid), { status: leaving ? "left" : "removed" }, { merge: true })
    tx.set(groupPath(groupId), { memberCount: Math.max(1, group.memberCount - 1) }, { merge: true })
  })
}

export function closeGroup(db: DocDb, input: { groupId: string; uid: string }) {
  const { groupId, uid } = input
  return db.transaction(async (tx) => {
    const group = await ownedGroup(tx, groupId, uid)
    const owner = await tx.get<{ updatedAtMs: number }>(groupOwnerPath(uid))
    if (group.inviteHash) tx.set(groupInvitePath(group.inviteHash), { groupId, revoked: true })
    tx.set(groupPath(groupId), { status: "closed", inviteHash: null }, { merge: true })
    tx.set(groupOwnerPath(uid), { updatedAtMs: (owner?.updatedAtMs ?? 0) + 1 })
  })
}
