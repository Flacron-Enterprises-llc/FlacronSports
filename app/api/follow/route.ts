import { NextResponse } from "next/server"
import { z } from "zod"
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api-auth"
import { userFollowService } from "@/lib/user-follow-service"
import { requireSubscriber } from "@/lib/billing/require-plan"

const followSchema = z.object({
  followType: z.enum(["author", "team", "tag"]),
  // Becomes part of a Firestore document ID, so path separators are not allowed.
  followId: z.string().min(1).max(120).regex(/^[^/]+$/),
})

async function parse(request: Request) {
  const parsed = followSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) throw new ApiError(400, "invalid_request", "Invalid follow request")
  return parsed.data
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request)
    await requireSubscriber(user.uid)
    const { followType, followId } = await parse(request)
    const success = await userFollowService.followItem(user.uid, followType, followId)
    return NextResponse.json({ success }, { status: success ? 200 : 503 })
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser(request)
    await requireSubscriber(user.uid)
    const { followType, followId } = await parse(request)
    const success = await userFollowService.unfollowItem(user.uid, followType, followId)
    return NextResponse.json({ success }, { status: success ? 200 : 503 })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
