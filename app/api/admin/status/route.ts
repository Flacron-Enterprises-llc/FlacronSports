import { NextResponse } from "next/server"
import { apiErrorResponse, requireAdmin } from "@/lib/api-auth"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
