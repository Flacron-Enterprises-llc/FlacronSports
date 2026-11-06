import { NextResponse } from "next/server"
import { z } from "zod"
import { ApiError, apiErrorResponse, requireFeature, requireUser, requireVerifiedUser } from "@/lib/api-auth"
import { requireSubscriber } from "@/lib/billing/require-plan"
import { cleanMessage, displayNameOf } from "@/lib/community/content"
import { createGroup, listMyGroups } from "@/lib/community/groups"
import { firestoreDocDb } from "@/lib/doc-db"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const schema = z.object({ name: z.string().trim().min(1).max(60) })

export async function GET(request: Request) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireUser(request)
    await requireSubscriber(user.uid)
    rateLimit(`groups-read:${user.uid}`, 60, 60_000)
    return NextResponse.json({ groups: await listMyGroups(firestoreDocDb(), user.uid) })
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireVerifiedUser(request)
    await requireSubscriber(user.uid)
    rateLimit(`groups:${user.uid}`, 10, 60_000)
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new ApiError(400, "invalid_request", "Invalid group")
    const created = await createGroup(firestoreDocDb(), { uid: user.uid, displayName: displayNameOf(user.token), name: cleanMessage(parsed.data.name) }, new Date())
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
