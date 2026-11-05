import { NextResponse } from "next/server"
import { apiErrorResponse, requireRole } from "@/lib/api-auth"
import { firestoreDocDb } from "@/lib/doc-db"
import { getEvents } from "@/lib/sports/service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    await requireRole(request, "admin")
    const db = firestoreDocDb()
    const [feed, reports] = await Promise.all([
      getEvents(),
      db.query<{ generatedAt: string }>("reports", { orderBy: { field: "generatedAt", direction: "desc" }, limit: 1 }).catch(() => null),
    ])
    return NextResponse.json({
      feed: { state: feed.state, source: feed.source, fetchedAt: feed.fetchedAt, limited: feed.limited, events: feed.events.length },
      jobs: {
        enabled: process.env.JOBS_ENABLED === "true",
        // Job runs are only logged, so the newest generated report is the only stored trace.
        lastReportGeneratedAt: reports?.[0]?.generatedAt ?? null,
        reportsReadable: reports !== null,
      },
    })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
