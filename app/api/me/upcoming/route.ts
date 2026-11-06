import { NextResponse } from "next/server"
import { apiErrorResponse, requireFeature, requireUser } from "@/lib/api-auth"
import { requireSubscriberOrPurchase } from "@/lib/billing/require-plan"
import { rankUpcoming } from "@/lib/community/upcoming"
import { getPreferences } from "@/lib/me/preferences"
import { rateLimit } from "@/lib/rate-limit"
import { storedDayAge, storedEvents, utcDate } from "@/lib/sports/service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const DAYS_AHEAD = 7
const DAY_MS = 86_400_000

/** Reads the week the scheduled job already keeps, so this spends no provider calls. */
export async function GET(request: Request) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireUser(request)
    await requireSubscriberOrPurchase(user.uid, "room")
    rateLimit(`upcoming:${user.uid}`, 30, 60_000)
    const now = new Date()
    const days = Array.from({ length: DAYS_AHEAD }, (_, index) => utcDate(new Date(now.getTime() + index * DAY_MS)))
    const [events, following] = await Promise.all([Promise.all(days.map((day) => storedEvents(day))), getPreferences(user.uid)])
    const games = rankUpcoming(events.flat(), following, now)
    return NextResponse.json({ games, stale: !days.every((day) => storedDayAge(day).complete) })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
