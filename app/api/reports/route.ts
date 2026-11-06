import { NextResponse } from "next/server"
import { apiErrorResponse } from "@/lib/api-auth"
import { requireMember } from "@/lib/billing/require-plan"
import { listPublishedReports } from "@/lib/content/reports"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** Members only, and published reports only. */
export async function GET(request: Request) {
  try {
    await requireMember(request, "reports", 120)
  } catch (error) {
    return apiErrorResponse(error)
  }
  const locale = new URL(request.url).searchParams.get("locale") === "fr" ? "fr" : "en"
  return NextResponse.json(await listPublishedReports(locale))
}
