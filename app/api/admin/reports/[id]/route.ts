import { NextResponse } from "next/server"
import { z } from "zod"
import { ApiError, apiErrorResponse, requireRole } from "@/lib/api-auth"
import { reviewReport } from "@/lib/admin/report-review"
import { audit } from "@/lib/audit"
import { assertId } from "@/lib/community/content"
import { firestoreDocDb } from "@/lib/doc-db"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const schema = z.object({
  status: z.enum(["draft", "validated", "published", "corrected", "rejected"]),
  correctionNote: z.string().trim().min(1).max(1000).optional(),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(request, "editor")
    rateLimit(`admin-reports:${user.uid}`, 30, 60_000)
    const id = assertId((await params).id, /^[\w.-]{1,200}$/)
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new ApiError(400, "invalid_request", "Invalid review")

    const { status, correctionNote } = parsed.data
    await reviewReport(firestoreDocDb(), { id, status, note: correctionNote ?? null, actorUid: user.uid }, new Date())
    await audit("report.reviewed", user.uid, { reportId: id, status, role: user.role })
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
