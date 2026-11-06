// Team and sport fan clubs. A club is stored as an open room, because the moderation
// tools, reports, blocks, reactions and account deletion all work on rooms: a third
// kind of chat would sit outside every one of them. A member belongs by joining, not
// by invitation, and members are counted rather than totalled on the club, so a busy
// club never contends on one document.

import { createHash } from "node:crypto"
import { ApiError } from "@/lib/api-auth"
import type { DocDb } from "@/lib/doc-db"
import { SPORTS, type SportId } from "@/lib/sports/types"
import { assertNotSanctioned, DEFAULT_SLOW_MODE_SECONDS, readSanction } from "./chat"
import { requireAccepted } from "./gate"
import { memberPath, roomPath, type Member, type Room } from "./rooms"

// Rooms expire; a club does not.
const NEVER = "9999-12-31T23:59:59.000Z"

export type ClubKind = "team" | "sport"

export interface ClubRoom extends Room {
  kind: "club"
  clubKind: ClubKind
  sportId: SportId
}

export interface ClubIdentity {
  kind: ClubKind
  sportId: SportId
  name: string
  /** Stable for the club's lifetime: the sport, or the feed's team id. Never shown. */
  key: string
}

export const clubId = (identity: Pick<ClubIdentity, "kind" | "key">) => createHash("sha256").update(`club:${identity.kind}:${identity.key}`).digest("hex").slice(0, 24)

export const sportClub = (sportId: SportId, name: string): ClubIdentity => ({ kind: "sport", sportId, name, key: sportId })

const asClub = (room: Room | null): ClubRoom | null => (room?.kind === "club" && room.status === "active" ? (room as ClubRoom) : null)
const memberTotal = (db: Pick<DocDb, "count">, id: string) => db.count("room_members", { where: [["roomId", id], ["status", "active"]] })

/** The first member makes the club. Its identity comes from the server, never the client. */
export async function joinClub(db: DocDb, input: { uid: string; displayName: string; club: ClubIdentity }, now: Date): Promise<{ id: string }> {
  const { uid, displayName, club } = input
  const id = clubId(club)
  return db.transaction(async (tx) => {
    const room = await tx.get<Room>(roomPath(id))
    const existing = await tx.get<Member>(memberPath(id, uid))
    const sanction = await readSanction(tx, uid)
    await requireAccepted(tx, uid)
    assertNotSanctioned(sanction, now, "participate")
    if (existing?.status === "active") return { id }
    if (existing?.status === "removed") throw new ApiError(403, "removed_from_club", "You were removed from this club")

    if (!room) {
      const created: ClubRoom = {
        kind: "club", clubKind: club.kind, sportId: club.sportId, matchId: "", hostUid: "", name: club.name,
        participantCap: 0, memberCount: 0, status: "active", locked: false, passPurchaseId: null, inviteHash: null,
        createdAtUTC: now.toISOString(), expiresAtUTC: NEVER, slowModeSeconds: DEFAULT_SLOW_MODE_SECONDS,
      }
      tx.set(roomPath(id), created)
    }
    const member: Member = { roomId: id, uid, displayName, role: "member", status: "active", joinedAtUTC: now.toISOString(), kind: "club" }
    tx.set(memberPath(id, uid), member)
    return { id }
  })
}

/** From a club's own page, where the club already exists. */
export async function joinExistingClub(db: DocDb, input: { id: string; uid: string; displayName: string }, now: Date): Promise<{ id: string }> {
  const { id, uid, displayName } = input
  return db.transaction(async (tx) => {
    const room = await tx.get<Room>(roomPath(id))
    const existing = await tx.get<Member>(memberPath(id, uid))
    const sanction = await readSanction(tx, uid)
    await requireAccepted(tx, uid)
    if (!asClub(room)) throw new ApiError(404, "not_found", "Not found")
    assertNotSanctioned(sanction, now, "participate")
    if (existing?.status === "active") return { id }
    if (existing?.status === "removed") throw new ApiError(403, "removed_from_club", "You were removed from this club")
    const member: Member = { roomId: id, uid, displayName, role: "member", status: "active", joinedAtUTC: now.toISOString(), kind: "club" }
    tx.set(memberPath(id, uid), member)
    return { id }
  })
}

export async function leaveClub(db: DocDb, input: { id: string; uid: string }): Promise<void> {
  await db.transaction(async (tx) => {
    const member = await tx.get<Member>(memberPath(input.id, input.uid))
    if (member?.kind !== "club" || member.status !== "active") throw new ApiError(404, "not_found", "Not found")
    tx.set(memberPath(input.id, input.uid), { status: "left" }, { merge: true })
  })
}

/** A club page is open to any member of the site. Its chat needs joining. */
export async function getClub(db: Pick<DocDb, "get" | "count">, id: string, uid: string) {
  const club = asClub(await db.get<Room>(roomPath(id)))
  if (!club) throw new ApiError(404, "not_found", "Not found")
  const [member, members] = await Promise.all([db.get<Member>(memberPath(id, uid)), memberTotal(db, id)])
  return { id, name: club.name, kind: club.clubKind, sportId: club.sportId, members, locked: club.locked, joined: member?.status === "active" }
}

/** One row per enabled sport, whether or not its club has a first member yet. */
export async function listClubs(db: Pick<DocDb, "get" | "query" | "count">, input: { uid: string; locale: "en" | "fr"; favorites: string[] }) {
  const { uid, locale, favorites } = input
  const memberships = await db.query<Member>("room_members", { where: [["uid", uid], ["status", "active"]] })
  const joinedIds = memberships.filter((member) => member.kind === "club").map((member) => member.roomId)
  const mine = (await Promise.all(joinedIds.map((id) => getClub(db, id, uid).catch(() => null)))).flatMap((club) => (club ? [club] : []))

  const sports = await Promise.all(
    SPORTS.filter((sport) => sport.enabled).map(async (sport) => {
      const identity = sportClub(sport.id, sport.name[locale])
      const id = clubId(identity)
      return { id, sportId: sport.id, name: identity.name, members: await memberTotal(db, id), joined: joinedIds.includes(id) }
    }),
  )
  const joinedNames = new Set(mine.map((club) => club.name))
  return { mine, sports, followed: favorites.filter((name) => !joinedNames.has(name)) }
}
