import { NextResponse } from "next/server"
import { apiErrorResponse, requireRole } from "@/lib/api-auth"
import { searchAudit } from "@/lib/admin/audit-log"
import { firestoreDocDb } from "@/lib/doc-db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    await requireRole(request, "moderator")
    const params = new URL(request.url).searchParams
    return NextResponse.json(await searchAudit(firestoreDocDb(), { q: params.get("q") ?? "", before: params.get("before") }))
  } catch (error) {
    return apiErrorResponse(error)
  }
}
