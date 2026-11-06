import { NextResponse } from "next/server"
import { apiErrorResponse, requireRole } from "@/lib/api-auth"
import { operationsSummary } from "@/lib/admin/operations"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    await requireRole(request, "admin")
    return NextResponse.json(await operationsSummary())
  } catch (error) {
    return apiErrorResponse(error)
  }
}
