import { NextResponse } from "next/server"
import { listNotifications } from "@/lib/alerts/notifications"
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api-auth"
import { getAdminDb } from "@/lib/firebase-admin"
import { getPreferences } from "@/lib/me/preferences"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const user = await requireUser(request)
    rateLimit(`notifications:${user.uid}`, 60, 60_000)
    const db = getAdminDb()
    if (!db) throw new ApiError(503, "storage_unavailable", "Notifications are temporarily unavailable")
    const { spoilerMode } = await getPreferences(user.uid)
    return NextResponse.json({ notifications: await listNotifications(db, user.uid, spoilerMode) })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
