import { NextResponse } from "next/server"
import { apiErrorResponse } from "@/lib/api-auth"
import { requireMember } from "@/lib/billing/require-plan"
import { getPublishedReport } from "@/lib/content/reports"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireMember(request, "report", 120)
  } catch (error) {
    return apiErrorResponse(error)
  }
  const locale = new URL(request.url).searchParams.get("locale") === "fr" ? "fr" : "en"
  const report = await getPublishedReport((await params).id, locale).catch(() => null)
  return report ? NextResponse.json({ report }) : NextResponse.json({ report: null }, { status: 404 })
}
