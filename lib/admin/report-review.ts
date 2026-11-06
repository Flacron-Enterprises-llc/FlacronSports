import { ApiError } from "@/lib/api-auth"
import { nextVersions, REPORT_VERSIONS, sportFeedKey, versionOf, type Report, type ReportStatus, type ReportVersion } from "@/lib/content/reports"
import type { DocDb } from "@/lib/doc-db"

export type ReviewStatus = "published" | "rejected"
export const QUEUE_STATUSES = ["draft", "validated", "rejected", "corrected", "published"] as const satisfies readonly ReportStatus[]
export type QueueStatus = (typeof QUEUE_STATUSES)[number]

const QUEUE_SIZE = 100
const QUEUE_SCAN = 300

/**
 * Sets editedAt so the publishing job leaves the report alone afterwards. Only the
 * public states keep a feedKey, and a report withheld with no text cannot go public.
 * Text changes go through applyCorrection. The note is not stored here: it is for
 * the audit log, while correctionNote is shown to readers.
 */
export async function reviewReport(db: DocDb, input: { id: string; status: ReviewStatus; actorUid: string }, now: Date) {
  const { id, status, actorUid } = input
  const path = `reports/${id}`
  const historyPath = `${REPORT_VERSIONS}/${id}`

  return db.transaction(async (tx) => {
    const report = await tx.get<Report>(path)
    if (!report) throw new ApiError(404, "not_found", "Report not found")
    const stored = await tx.get<{ versions?: ReportVersion[] }>(historyPath)

    const stamp = now.toISOString()
    const review: Record<string, unknown> = { status, editedAt: stamp, updatedAt: stamp }
    if (status === "published") {
      if (!report.body || !report.title) throw new ApiError(409, "nothing_to_publish", "This report has no text to publish")
      const publishedAt = report.publishedAt ?? stamp
      Object.assign(review, { publishedAt, feedKey: `${report.locale}#${publishedAt}`, sportFeedKey: sportFeedKey(report, publishedAt), withheldReason: null })
    } else {
      Object.assign(review, { feedKey: null, sportFeedKey: null })
    }
    const versions = nextVersions(stored, versionOf(report, status, actorUid, stamp))
    tx.set(historyPath, { versions })
    tx.set(path, { ...review, previousVersions: versions.length }, { merge: true })
  })
}

/** Restores the version before the latest change. Repeating it walks further back. */
export async function rollbackReport(db: DocDb, input: { id: string }, now: Date) {
  const path = `reports/${input.id}`
  const historyPath = `${REPORT_VERSIONS}/${input.id}`

  return db.transaction(async (tx) => {
    const report = await tx.get<Report>(path)
    if (!report) throw new ApiError(404, "not_found", "Report not found")
    const versions = (await tx.get<{ versions?: ReportVersion[] }>(historyPath))?.versions ?? []
    const previous = versions.at(-1)
    if (!previous) throw new ApiError(409, "no_previous_version", "There is no earlier version to restore")

    const { title, body, status, correctionNote, withheldReason, publishedAt, feedKey } = previous
    const stamp = now.toISOString()
    tx.set(historyPath, { versions: versions.slice(0, -1) })
    // editedAt stays set, so the job cannot replace the restored text.
    tx.set(path, { title, body, status, correctionNote, withheldReason, publishedAt, feedKey, sportFeedKey: feedKey && publishedAt ? sportFeedKey(report, publishedAt) : null, editedAt: stamp, updatedAt: stamp, previousVersions: versions.length - 1 }, { merge: true })
    return { status }
  })
}

/** Staff-only, so source details are included here and nowhere else. */
export async function listReportQueue(db: Pick<DocDb, "query">, status: QueueStatus) {
  // A filter and a sort on different fields would need a composite index. Published
  // reports are too many to scan, so that list is read by recency and filtered.
  const rows = status === "published"
    ? await db.query<Report>("reports", { orderBy: { field: "updatedAt", direction: "desc" }, limit: QUEUE_SCAN })
    : await db.query<Report>("reports", { where: [["status", status]], limit: QUEUE_SCAN })
  return rows
    .filter((row) => row.status === status)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, QUEUE_SIZE)
    .map(({ id, type, locale, status: state, title, body, competition, matchId, sources, promptVersion, sourceVersion, withheldReason, correctionNote, generatedAt, updatedAt, publishedAt, previousVersions }) => ({
      id, type, locale, status: state, title, body, competition, matchId, sources, promptVersion, sourceVersion,
      withheldReason, correctionNote, generatedAt, updatedAt, publishedAt, previousVersions: previousVersions ?? 0,
    }))
}
