import { NextResponse } from "next/server"
import { userFollowService } from "@/lib/user-follow-service"

export async function POST(request: Request) {
  try {
    const { userId, followType, followId } = await request.json()

    if (!userId || !followType || !followId) {
      return NextResponse.json({ success: false, error: "Missing required parameters" }, { status: 400 })
    }

    const success = await userFollowService.followItem(userId, followType, followId)

    return NextResponse.json({
      success,
      message: success ? "Successfully followed" : "Failed to follow",
    })
  } catch (error) {
    console.error("Error following item:", error)
    return NextResponse.json({ success: false, error: "Failed to follow item" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { userId, followType, followId } = await request.json()

    if (!userId || !followType || !followId) {
      return NextResponse.json({ success: false, error: "Missing required parameters" }, { status: 400 })
    }

    const success = await userFollowService.unfollowItem(userId, followType, followId)

    return NextResponse.json({
      success,
      message: success ? "Successfully unfollowed" : "Failed to unfollow",
    })
  } catch (error) {
    console.error("Error unfollowing item:", error)
    return NextResponse.json({ success: false, error: "Failed to unfollow item" }, { status: 500 })
  }
}
