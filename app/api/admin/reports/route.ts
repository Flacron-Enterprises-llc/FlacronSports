import { NextResponse } from "next/server"
import { apiErrorResponse, ApiError, requireRole } from "@/lib/api-auth"
import { listReportQueue, QUEUE_STATUSES, type QueueStatus } from "@/lib/admin/report-review"
import { firestoreDocDb } from "@/lib/doc-db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    await requireRole(request, "editor")
    const status = (new URL(request.url).searchParams.get("status") ?? "draft") as QueueStatus
    if (!QUEUE_STATUSES.includes(status)) throw new ApiError(400, "invalid_request", "Unknown status")
    return NextResponse.json({ reports: await listReportQueue(firestoreDocDb(), status) })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
