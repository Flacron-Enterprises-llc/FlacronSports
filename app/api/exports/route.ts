import { NextResponse } from "next/server"
import { ApiError, apiErrorResponse, requireVerifiedUser } from "@/lib/api-auth"
import { assertId, MATCH_ID } from "@/lib/community/content"
import { firestoreDocDb } from "@/lib/doc-db"
import { exportMatchSummary, getPdfRenderer } from "@/lib/exports/service"
import { rateLimit } from "@/lib/rate-limit"
import { getEvent } from "@/lib/sports/service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser(request)
    rateLimit(`pdf-export:${user.uid}`, 10, 60_000)

    const render = getPdfRenderer()
    if (!render) throw new ApiError(503, "exports_unavailable", "PDF exports are not available yet")

    const { matchId } = await request.json().catch(() => ({}))
    const event = await getEvent(assertId(matchId, MATCH_ID))
    if (!event) throw new ApiError(404, "not_found", "Match not found")

    const pdf = await exportMatchSummary(firestoreDocDb(), { uid: user.uid, event, render }, new Date())
    return new NextResponse(Buffer.from(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="flacronsport-${event.id}.pdf"` },
    })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
