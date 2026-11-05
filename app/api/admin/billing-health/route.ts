import { NextResponse } from "next/server"
import { billingHealth } from "@/lib/admin/billing-health"
import { apiErrorResponse, requireRole } from "@/lib/api-auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    await requireRole(request, "admin")
    return NextResponse.json(await billingHealth())
  } catch (error) {
    return apiErrorResponse(error)
  }
}
