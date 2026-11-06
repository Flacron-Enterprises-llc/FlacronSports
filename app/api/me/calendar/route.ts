import { NextResponse } from "next/server"
import { apiErrorResponse, requireUser } from "@/lib/api-auth"
import { requireSubscriber } from "@/lib/billing/require-plan"
import { memberEvents } from "@/lib/calendar/agenda"
import { getPreferences } from "@/lib/me/preferences"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** The next seven days of a member's games. Results stay out: this view has no reason to carry them. */
export async function GET(request: Request) {
  try {
    const user = await requireUser(request)
    await requireSubscriber(user.uid)
    rateLimit(`agenda:${user.uid}`, 30, 60_000)
    const events = await memberEvents(await getPreferences(user.uid))
    return NextResponse.json({ events: events.map((event) => ({ ...event, score: { kind: "none" } })), fetchedAt: new Date().toISOString() })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
