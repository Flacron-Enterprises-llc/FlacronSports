import { NextResponse } from "next/server"
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api-auth"
import { getEffectiveAccess } from "@/lib/billing/firestore-store"
import { buildFullReport } from "@/lib/content/full-report"
import { getPublishedReport } from "@/lib/content/reports"
import { getEvent, getMatchDetail } from "@/lib/sports/service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request)
    const { plan } = await getEffectiveAccess(user.uid)
    if (plan === "free") throw new ApiError(403, "plan_required", "Full reports need the Plus or Premium plan")
    const locale = new URL(request.url).searchParams.get("locale") === "fr" ? "fr" : "en"
    const report = await getPublishedReport((await params).id, locale)
    if (!report) throw new ApiError(404, "not_found", "Report not found")
    const event = await getEvent(report.matchId)
    if (!event) throw new ApiError(404, "not_found", "Match not found")
    return NextResponse.json(buildFullReport(event, await getMatchDetail(event), plan, locale))
  } catch (error) {
    return apiErrorResponse(error)
  }
}
