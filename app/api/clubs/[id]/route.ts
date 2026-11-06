import { NextResponse } from "next/server"
import { apiErrorResponse, requireFeature, requireUser, requireVerifiedUser } from "@/lib/api-auth"
import { requireSubscriber } from "@/lib/billing/require-plan"
import { refreshBadgesQuietly } from "@/lib/community/badges"
import { getClub, joinExistingClub, leaveClub } from "@/lib/community/clubs"
import { assertId, displayNameOf, ROOM_ID } from "@/lib/community/content"
import { firestoreDocDb } from "@/lib/doc-db"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Context = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Context) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireUser(request)
    await requireSubscriber(user.uid)
    rateLimit(`clubs-read:${user.uid}`, 60, 60_000)
    const id = assertId((await params).id, ROOM_ID)
    return NextResponse.json(await getClub(firestoreDocDb(), id, user.uid))
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function POST(request: Request, { params }: Context) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireVerifiedUser(request)
    await requireSubscriber(user.uid)
    rateLimit(`clubs:${user.uid}`, 10, 60_000)
    const id = assertId((await params).id, ROOM_ID)
    const db = firestoreDocDb()
    const now = new Date()
    const joined = await joinExistingClub(db, { id, uid: user.uid, displayName: displayNameOf(user.token) }, now)
    await refreshBadgesQuietly(db, user.uid, now)
    return NextResponse.json(joined)
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireVerifiedUser(request)
    await requireSubscriber(user.uid)
    rateLimit(`clubs:${user.uid}`, 10, 60_000)
    const id = assertId((await params).id, ROOM_ID)
    const db = firestoreDocDb()
    await leaveClub(db, { id, uid: user.uid })
    await refreshBadgesQuietly(db, user.uid, new Date())
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
