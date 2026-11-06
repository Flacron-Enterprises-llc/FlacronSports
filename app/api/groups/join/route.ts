import { NextResponse } from "next/server"
import { z } from "zod"
import { ApiError, apiErrorResponse, requireFeature, requireVerifiedUser } from "@/lib/api-auth"
import { requireSubscriber } from "@/lib/billing/require-plan"
import { displayNameOf } from "@/lib/community/content"
import { joinGroup } from "@/lib/community/groups"
import { firestoreDocDb } from "@/lib/doc-db"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const schema = z.object({ token: z.string().regex(/^[\w-]{20,100}$/) })

export async function POST(request: Request) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireVerifiedUser(request)
    await requireSubscriber(user.uid)
    rateLimit(`group-join:${user.uid}`, 10, 60_000)
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new ApiError(404, "invite_invalid", "This invitation is not valid")
    return NextResponse.json(await joinGroup(firestoreDocDb(), { uid: user.uid, displayName: displayNameOf(user.token), token: parsed.data.token }, new Date()))
  } catch (error) {
    return apiErrorResponse(error)
  }
}
