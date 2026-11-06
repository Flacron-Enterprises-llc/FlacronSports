import { NextResponse } from "next/server"
import { apiErrorResponse } from "@/lib/api-auth"
import { MATCH_ADDONS, requireMember } from "@/lib/billing/require-plan"
import { viewingFor } from "@/lib/video/catalog"

export const dynamic = "force-dynamic"

// The country comes from the network, never from a profile preference.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireMember(request, "viewing-options", 60, MATCH_ADDONS)
  } catch (error) {
    return apiErrorResponse(error)
  }
  const { id } = await params
  const country = request.headers.get("cloudfront-viewer-country")
  const result = await viewingFor(id, country)
  return NextResponse.json({ ...result, viewerCountry: country, checkedAt: new Date().toISOString() })
}
