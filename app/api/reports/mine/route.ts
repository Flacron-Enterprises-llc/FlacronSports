import { NextResponse } from "next/server"
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api-auth"
import { getEffectiveAccess } from "@/lib/billing/firestore-store"
import { listPublishedReports } from "@/lib/content/reports"
import { getPreferences } from "@/lib/me/preferences"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const LIMIT = 12

/** Personalized reports: the published reports about the teams this member follows. */
export async function GET(request: Request) {
  try {
    const user = await requireUser(request)
    const { plan } = await getEffectiveAccess(user.uid)
    if (plan === "free") throw new ApiError(403, "plan_required", "Personalized reports need the Plus or Premium plan")
    const locale = new URL(request.url).searchParams.get("locale") === "fr" ? "fr" : "en"
    const [{ favorites }, list] = await Promise.all([getPreferences(user.uid), listPublishedReports(locale, 300)])
    const followed = new Set(favorites)
    const reports = list.reports
      .filter((report) => report.participants.some((name) => followed.has(name)))
      .slice(0, LIMIT)
      .map(({ id, slug, title, competition, publishedAt }) => ({ id, slug, title, competition, publishedAt }))
    return NextResponse.json({ state: list.state, favorites: favorites.length, reports })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
