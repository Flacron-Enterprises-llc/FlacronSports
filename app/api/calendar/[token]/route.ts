import { NextResponse } from "next/server"
import { ApiError, apiErrorResponse } from "@/lib/api-auth"
import { getEffectiveAccess } from "@/lib/billing/firestore-store"
import { FEED_DAYS, memberEvents } from "@/lib/calendar/agenda"
import { feedOwner } from "@/lib/calendar/feed"
import { buildCalendar } from "@/lib/calendar/ics"
import { firestoreDocDb } from "@/lib/doc-db"
import { getDictionary, localePath } from "@/lib/i18n"
import { getPreferences } from "@/lib/me/preferences"
import { rateLimitClient } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** Calendar apps cannot sign in, so the secret token in the link is the credential. */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    rateLimitClient(request, "calendar-ics", { visitor: 60, shared: 600 }, 60_000)
    const token = (await params).token.replace(/\.ics$/, "")
    const uid = await feedOwner(firestoreDocDb(), token)
    if (!uid) throw new ApiError(404, "not_found", "Calendar not found")
    const { plan } = await getEffectiveAccess(uid)
    if (plan === "none") throw new ApiError(402, "subscription_required", "Choose a plan to use FlacronSport")

    const prefs = await getPreferences(uid)
    const body = buildCalendar(await memberEvents(prefs, FEED_DAYS), {
      name: getDictionary(prefs.locale).discover.calendarName,
      siteUrl: process.env.APP_BASE_URL || "https://flacronsport.com",
      matchPath: (id) => localePath(prefs.locale, `/app/match/${id}`),
    })
    return new NextResponse(body, {
      headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="flacronsport.ics"', "Cache-Control": "private, max-age=900" },
    })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
