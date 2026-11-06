import { ApiError } from "@/lib/api-auth"
import { invitePath, roomPath, type Room } from "@/lib/community/rooms"
import type { DocDb } from "@/lib/doc-db"

/** Staff can end a room's invitation link without being a member. Members already in stay in. */
export function staffRevokeInvite(db: DocDb, input: { roomId: string; actorUid: string; reason: string }, now: Date) {
  return db.transaction(async (tx) => {
    const room = await tx.get<Room>(roomPath(input.roomId))
    if (!room) throw new ApiError(404, "not_found", "Room not found")
    if (!room.inviteHash) return { revoked: false }
    tx.set(invitePath(room.inviteHash), { roomId: input.roomId, revoked: true, revokedBy: input.actorUid, revokedReason: input.reason, revokedAtUTC: now.toISOString() })
    tx.set(roomPath(input.roomId), { inviteHash: null }, { merge: true })
    return { revoked: true }
  })
}
