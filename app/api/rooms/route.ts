import { NextResponse } from "next/server"
import { z } from "zod"
import { ApiError, apiErrorResponse, requireFeature, requireUser, requireVerifiedUser } from "@/lib/api-auth"
import { getEffectiveAccess } from "@/lib/billing/firestore-store"
import { assertId, displayNameOf, MATCH_ID } from "@/lib/community/content"
import { requireEvent } from "@/lib/community/events"
import { createRoom, listMyRooms } from "@/lib/community/rooms"
import { firestoreDocDb } from "@/lib/doc-db"
import { rateLimit } from "@/lib/rate-limit"
import { requireSubscriber } from "@/lib/billing/require-plan"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const schema = z.object({
  matchId: z.string().max(64),
  name: z.string().trim().min(1).max(60),
  participantLimit: z.number().int().min(2).max(50).optional(),
})

export async function GET(request: Request) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireUser(request)
    await requireSubscriber(user.uid)
    return NextResponse.json({ rooms: await listMyRooms(firestoreDocDb(), user.uid) })
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireVerifiedUser(request)
    await requireSubscriber(user.uid)
    rateLimit(`rooms:${user.uid}`, 10, 60_000)
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new ApiError(400, "invalid_request", "Invalid room")

    const event = await requireEvent(assertId(parsed.data.matchId, MATCH_ID))
    if (["finished", "canceled", "abandoned"].includes(event.status)) {
      throw new ApiError(409, "match_over", "This match is over")
    }
    const { plan } = await getEffectiveAccess(user.uid)
    const created = await createRoom(
      firestoreDocDb(),
      { uid: user.uid, displayName: displayNameOf(user.token), plan, matchId: event.id, name: parsed.data.name, participantLimit: parsed.data.participantLimit, kickoffUTC: event.scheduledStartUTC },
      new Date(),
    )
    return NextResponse.json({ id: created.id, inviteToken: created.inviteToken, participantCap: created.room.participantCap, expiresAtUTC: created.room.expiresAtUTC }, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
