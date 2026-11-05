import { ApiError } from "@/lib/api-auth"
import type { DocDb } from "@/lib/doc-db"

export type ReviewStatus = "draft" | "validated" | "published" | "corrected" | "rejected"

interface ReportFields {
  locale: string
  body: string
  publishedAt: string | null
}

/**
 * Sets editedAt so the publishing job leaves the report alone afterwards. Only the
 * public states keep a feedKey, and a report withheld with no text cannot go public.
 */
export async function reviewReport(db: DocDb, input: { id: string; status: ReviewStatus; note: string | null; actorUid: string }, now: Date) {
  const { id, status, note, actorUid } = input
  const path = `reports/${id}`
  if (status === "corrected" && !note) throw new ApiError(400, "note_required", "A correction needs a note")

  return db.transaction(async (tx) => {
    const report = await tx.get<ReportFields>(path)
    if (!report) throw new ApiError(404, "not_found", "Report not found")

    const stamp = now.toISOString()
    const review: Record<string, unknown> = { status, editedAt: stamp, updatedAt: stamp, reviewedBy: actorUid, ...(note ? { correctionNote: note } : {}) }
    if (status === "published" || status === "corrected") {
      if (!report.body) throw new ApiError(409, "nothing_to_publish", "This report has no text to publish")
      const publishedAt = report.publishedAt ?? stamp
      Object.assign(review, { publishedAt, feedKey: `${report.locale}#${publishedAt}`, withheldReason: null })
    } else {
      review.feedKey = null
    }
    tx.set(path, review, { merge: true })
  })
}
