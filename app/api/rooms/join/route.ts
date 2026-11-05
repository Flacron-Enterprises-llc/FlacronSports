import { NextResponse } from "next/server"
import { apiErrorResponse, ApiError, requireFeature, requireVerifiedUser } from "@/lib/api-auth"
import { getEffectiveAccess } from "@/lib/billing/firestore-store"
import { displayNameOf } from "@/lib/community/content"
import { joinRoom } from "@/lib/community/rooms"
import { firestoreDocDb } from "@/lib/doc-db"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireVerifiedUser(request)
    rateLimit(`room-join:${user.uid}`, 10, 60_000)
    const { token } = await request.json().catch(() => ({}))
    if (typeof token !== "string" || !/^[\w-]{20,100}$/.test(token)) throw new ApiError(404, "invite_invalid", "This invitation is not valid")

    const joined = await joinRoom(
      firestoreDocDb(),
      { uid: user.uid, displayName: displayNameOf(user.token), token, hostPlan: async (uid) => (await getEffectiveAccess(uid)).plan },
      new Date(),
    )
    return NextResponse.json(joined)
  } catch (error) {
    return apiErrorResponse(error)
  }
}
