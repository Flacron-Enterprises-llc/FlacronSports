import { ApiError } from "@/lib/api-auth"
import { getPublishedReport } from "@/lib/content/reports"
import type { DocDb } from "@/lib/doc-db"
import type { Locale } from "@/lib/i18n"

export const SAVED_REPORTS_COLLECTION = "saved_reports"
export const MAX_SAVED_REPORTS = 200

export interface SavedReportRow {
  uid: string
  slug: string
  savedAtUTC: string
}

export interface SavedReportItem {
  slug: string
  title: string
  competition: string
  publishedAt: string | null
  savedAtUTC: string
}

export const isReportSlug = (slug: string): boolean => /^[a-z0-9-]{1,80}$/.test(slug)

const path = (uid: string, slug: string) => `${SAVED_REPORTS_COLLECTION}/${uid}_${slug}`

export const savedRows = (db: Pick<DocDb, "query">, uid: string) => db.query<SavedReportRow>(SAVED_REPORTS_COLLECTION, { where: [["uid", uid]] })

export async function saveReport(db: Pick<DocDb, "query" | "set">, uid: string, slug: string, now: Date = new Date()): Promise<void> {
  if (!isReportSlug(slug)) throw new ApiError(400, "invalid_request", "Invalid report")
  const saved = await savedRows(db, uid)
  if (saved.some((row) => row.slug === slug)) return
  if (saved.length >= MAX_SAVED_REPORTS) throw new ApiError(403, "saved_limit", "You have saved the most reports allowed")
  await db.set(path(uid, slug), { uid, slug, savedAtUTC: now.toISOString() })
}

export async function removeSavedReport(db: Pick<DocDb, "delete">, uid: string, slug: string): Promise<void> {
  if (!isReportSlug(slug)) throw new ApiError(400, "invalid_request", "Invalid report")
  await db.delete(path(uid, slug))
}

/** A report withdrawn since saving drops out of the list. */
export async function listSavedReports(db: Pick<DocDb, "query">, uid: string, locale: Locale): Promise<SavedReportItem[]> {
  const rows = (await savedRows(db, uid)).sort((a, b) => b.savedAtUTC.localeCompare(a.savedAtUTC))
  const reports = await Promise.all(rows.map((row) => getPublishedReport(row.slug, locale).catch(() => null)))
  return rows.flatMap((row, index) => {
    const report = reports[index]
    return report ? [{ slug: row.slug, title: report.title, competition: report.competition, publishedAt: report.publishedAt, savedAtUTC: row.savedAtUTC }] : []
  })
}
