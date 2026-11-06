import { NextResponse } from "next/server"
import { apiErrorResponse, requireUser } from "@/lib/api-auth"
import { requireSubscriber } from "@/lib/billing/require-plan"
import { feedStatus, regenerateFeed, revokeFeed } from "@/lib/calendar/feed"
import { firestoreDocDb } from "@/lib/doc-db"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const user = await requireUser(request)
    await requireSubscriber(user.uid)
    return NextResponse.json(await feedStatus(firestoreDocDb(), user.uid))
  } catch (error) {
    return apiErrorResponse(error)
  }
}

/** Creates the feed, or replaces it so the old link stops working. */
export async function POST(request: Request) {
  try {
    const user = await requireUser(request)
    await requireSubscriber(user.uid)
    rateLimit(`calendar-feed:${user.uid}`, 10, 3_600_000)
    const { token, createdAtUTC } = await regenerateFeed(firestoreDocDb(), user.uid)
    const origin = process.env.APP_BASE_URL || new URL(request.url).origin
    return NextResponse.json({ url: `${origin}/api/calendar/${token}.ics`, createdAtUTC })
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser(request)
    await requireSubscriber(user.uid)
    await revokeFeed(firestoreDocDb(), user.uid)
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
