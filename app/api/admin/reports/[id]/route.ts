import { NextResponse } from "next/server"
import { z } from "zod"
import { ApiError, apiErrorResponse, requireRole } from "@/lib/api-auth"
import { reviewReport, rollbackReport } from "@/lib/admin/report-review"
import { audit } from "@/lib/audit"
import { assertId } from "@/lib/community/content"
import { applyCorrection } from "@/lib/content/reports"
import { firestoreDocDb } from "@/lib/doc-db"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const NOTE = z.string().trim().min(3).max(1000)
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("correct"), body: z.string().trim().min(1).max(6000), title: z.string().trim().min(1).max(200).optional(), note: NOTE }),
  z.object({ action: z.literal("publish"), note: NOTE }),
  z.object({ action: z.literal("reject"), note: NOTE }),
  z.object({ action: z.literal("rollback"), note: NOTE }),
])

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(request, "editor")
    rateLimit(`admin-reports:${user.uid}`, 30, 60_000)
    const id = assertId((await params).id, /^[\w.-]{1,200}$/)
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new ApiError(400, "invalid_request", "Invalid review")

    const input = parsed.data
    const db = firestoreDocDb()
    const now = new Date()
    if (input.action === "correct") {
      await applyCorrection(db, id, { body: input.body, title: input.title, note: input.note, actorUid: user.uid }, now)
    } else if (input.action === "rollback") {
      await rollbackReport(db, { id }, now)
    } else {
      await reviewReport(db, { id, status: input.action === "publish" ? "published" : "rejected", actorUid: user.uid }, now)
    }
    await audit(`report.${input.action}`, user.uid, { reportId: id, note: input.note, role: user.role })
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
