import { NextResponse } from "next/server"
import { apiErrorResponse, requireRole } from "@/lib/api-auth"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { role } = await requireRole(request, "moderator", "editor")
    return NextResponse.json({ success: true, role })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
