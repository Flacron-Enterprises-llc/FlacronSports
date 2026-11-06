import { NextResponse } from "next/server"
import { apiErrorResponse } from "@/lib/api-auth"
import { requireMember } from "@/lib/billing/require-plan"
import { listNewsReports, listPublishedReports } from "@/lib/content/reports"
import { enabledSports } from "@/lib/sports/service"
import type { SportId } from "@/lib/sports/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** Members only, and published reports only. */
export async function GET(request: Request) {
  try {
    await requireMember(request, "reports", 120)
  } catch (error) {
    return apiErrorResponse(error)
  }
  const { searchParams } = new URL(request.url)
  const locale = searchParams.get("locale") === "fr" ? "fr" : "en"
  if (searchParams.get("feed") !== "news") return NextResponse.json(await listPublishedReports(locale))
  const sports = enabledSports().map((sport) => sport.id)
  const asked = searchParams.get("sport") as SportId | null
  return NextResponse.json(await listNewsReports(locale, asked && sports.includes(asked) ? asked : null, sports))
}
