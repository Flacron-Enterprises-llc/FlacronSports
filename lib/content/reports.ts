import { createHash } from "node:crypto"
import type { Firestore } from "firebase-admin/firestore"
import { getAdminDb } from "@/lib/firebase-admin"
import { LOCALES, type Locale } from "@/lib/i18n"
import type { SportEvent } from "@/lib/sports/types"

export const REPORTS_COLLECTION = "reports"
/** Bump whenever the wording in TEMPLATES changes. */
export const TEMPLATE_VERSION = "result-template-v1"

export type ReportStatus = "draft" | "validated" | "published" | "corrected" | "rejected"
export type ReportType = "result"

export interface ReportSource {
  provider: string
  eventId: string
  fetchedAt: string
}

export interface Report {
  id: string
  /** Locale-free part of the id, so one URL serves both languages. */
  slug: string
  matchId: string
  sportId: string
  locale: Locale
  type: ReportType
  status: ReportStatus
  title: string
  body: string
  participants: string[]
  competition: string
  eventDateUTC: string | null
  sources: ReportSource[]
  promptVersion: string
  sourceVersion: string
  jobKey: string
  withheldReason: string | null
  correctionNote: string | null
  /** Set by any editor action. The job never touches such a report again. */
  editedAt: string | null
  generatedAt: string
  updatedAt: string
  publishedAt: string | null
  /** locale#publishedAt, set only while public. See listPublishedReports. */
  feedKey: string | null
}

export type SaveOutcome = "created" | "replaced" | "duplicate" | "locked" | "kept" | "queued"

// Deliberately neutral: no "beat" or "won", because a level score can still be
// settled on penalties and the feed does not give the shootout result.
const TEMPLATES: Record<Locale, { title: string; body: string; dateLocale: string }> = {
  en: { title: "Result: {home} v {away}", body: "Final score: {home} {homeScore}, {away} {awayScore}. {competition}, {date} (UTC).", dateLocale: "en-US" },
  fr: { title: "Résultat : {home} - {away}", body: "Score final : {home} {homeScore}, {away} {awayScore}. {competition}, {date} (UTC).", dateLocale: "fr-FR" },
}

const PUBLIC: ReportStatus[] = ["published", "corrected"]
const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (_, key: string) => values[key])

function eventDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(TEMPLATES[locale].dateLocale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(iso))
}

/** Why an event cannot be reported on, or null when every required fact is verified. */
export function withholdReason(event: SportEvent): { status: "draft" | "rejected"; reason: string } | null {
  if (event.status !== "finished") return { status: "draft", reason: "not_finished" }
  const { score } = event
  if (score.kind !== "team" || ![score.home, score.away].every((value) => Number.isInteger(value) && value >= 0)) {
    return { status: "rejected", reason: "missing_score" }
  }
  const names = event.participants.map((participant) => participant.name)
  if (event.participantType !== "team" || names.length !== 2 || names.some((name) => !name || name === "TBD")) {
    return { status: "rejected", reason: "missing_participants" }
  }
  if (!event.scheduledStartUTC) return { status: "rejected", reason: "missing_date" }
  if (!event.competition.name || event.competition.name === "Unknown competition") return { status: "rejected", reason: "missing_competition" }
  if (!event.provider.eventId) return { status: "rejected", reason: "missing_source" }
  return null
}

export function sourceVersion(event: SportEvent): string {
  const facts = [event.status, event.score, event.participants.map((item) => item.name), event.competition.name, event.scheduledStartUTC]
  return createHash("sha256").update(JSON.stringify(facts)).digest("hex").slice(0, 16)
}

/** Every number in the text must come from the event, whatever its teams are called. */
export function isGrounded(body: string, event: SportEvent, locale: Locale): boolean {
  if (event.score.kind !== "team" || !event.scheduledStartUTC) return false
  const allowed = new Set([String(event.score.home), String(event.score.away), ...(eventDate(event.scheduledStartUTC, locale).match(/\d+/g) ?? [])])
  const names = [...event.participants.map((item) => item.name), event.competition.name]
  const rest = names.reduce((text, name) => text.split(name).join(" "), body)
  return (rest.match(/\d+/g) ?? []).every((number) => allowed.has(number))
}

export function buildReport(event: SportEvent, locale: Locale, fetchedAt: string, now: Date = new Date()): Report {
  const type: ReportType = "result"
  const slug = `${event.id}-${type}`
  const version = sourceVersion(event)
  const generatedAt = now.toISOString()
  const base = {
    id: `${slug}-${locale}`, slug, matchId: event.id, sportId: event.sportId, locale, type,
    participants: event.participants.map((item) => item.name),
    competition: event.competition.name,
    eventDateUTC: event.scheduledStartUTC,
    sources: [{ provider: event.provider.name, eventId: event.provider.eventId, fetchedAt }],
    promptVersion: TEMPLATE_VERSION,
    sourceVersion: version,
    jobKey: `${event.id}:${type}:${locale}:${version}`,
    correctionNote: null, editedAt: null, generatedAt, updatedAt: generatedAt,
  }

  const withheld = withholdReason(event)
  if (withheld) return { ...base, status: withheld.status, title: "", body: "", withheldReason: withheld.reason, publishedAt: null, feedKey: null }

  const [home, away] = base.participants
  const { home: homeScore, away: awayScore } = event.score as { home: number; away: number }
  const values = {
    home, away, homeScore: String(homeScore), awayScore: String(awayScore),
    competition: event.competition.name,
    date: eventDate(event.scheduledStartUTC as string, locale),
  }
  const template = TEMPLATES[locale]
  const body = fill(template.body, values)
  if (!isGrounded(body, event, locale)) {
    return { ...base, status: "rejected", title: "", body: "", withheldReason: "failed_validation", publishedAt: null, feedKey: null }
  }
  return { ...base, status: "validated", title: fill(template.title, values), body, withheldReason: null, publishedAt: null, feedKey: null }
}

const publishNow = (report: Report): Report => ({
  ...report,
  status: "published",
  publishedAt: report.generatedAt,
  feedKey: `${report.locale}#${report.generatedAt}`,
})

const editorOwned = (report: Report) => report.status === "corrected" || Boolean(report.correctionNote) || Boolean(report.editedAt)

/**
 * One document per match, type and locale, with the source version in jobKey.
 * Keeping a single document is what stops two conflicting public reports existing
 * for one match. Everything runs in a transaction so overlapping ticks agree.
 */
export function saveReport(db: Firestore, report: Report): Promise<SaveOutcome> {
  const ref = db.collection(REPORTS_COLLECTION).doc(report.id)
  const ready = report.status === "validated" ? publishNow(report) : report

  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref)
    if (!snapshot.exists) {
      tx.create(ref, ready)
      return "created"
    }
    const existing = snapshot.data() as Report
    if (editorOwned(existing)) return "locked"
    if (existing.jobKey === report.jobKey) return "duplicate"

    const contested = existing.status === "published" || existing.withheldReason === "source_changed"
    if (!report.title) {
      // A feed that lost the score must not take down a report that had one.
      if (contested) return "kept"
      tx.set(ref, ready)
      return "replaced"
    }
    if (contested) {
      // The facts changed after publication, so a person decides which is right.
      tx.set(ref, { ...report, status: "draft", withheldReason: "source_changed", generatedAt: existing.generatedAt })
      return "queued"
    }
    tx.set(ref, ready)
    return "replaced"
  })
}

export interface ReportCounts extends Record<SaveOutcome, number> {
  failed: number
}

/** Only finished events are stored, so the collection is not filled with fixtures. */
export async function runReports(db: Firestore, events: SportEvent[], fetchedAt: string, now: Date = new Date()): Promise<ReportCounts> {
  const counts: ReportCounts = { created: 0, replaced: 0, duplicate: 0, locked: 0, kept: 0, queued: 0, failed: 0 }
  for (const event of events.filter((item) => item.status === "finished")) {
    for (const locale of LOCALES) {
      try {
        counts[await saveReport(db, buildReport(event, locale, fetchedAt, now))] += 1
      } catch (error) {
        counts.failed += 1
        console.error("Report save failed", event.id, error instanceof Error ? error.message : "unknown")
      }
    }
  }
  return counts
}

/** The editor path: replaces the text, records the note, and locks out the job. */
export async function applyCorrection(db: Firestore, id: string, correction: { body: string; note: string }, now: Date = new Date()): Promise<void> {
  const ref = db.collection(REPORTS_COLLECTION).doc(id)
  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref)
    if (!snapshot.exists) throw new Error("Report not found")
    const report = snapshot.data() as Report
    const stamp = now.toISOString()
    const publishedAt = report.publishedAt ?? stamp
    tx.set(ref, {
      ...report, status: "corrected", body: correction.body, correctionNote: correction.note,
      withheldReason: null, editedAt: stamp, updatedAt: stamp, publishedAt, feedKey: `${report.locale}#${publishedAt}`,
    })
  })
}

export interface ReportList {
  state: "ok" | "unavailable"
  reports: Report[]
}

/** Reads only `reports`. The legacy `articles` collection is never touched. */
export async function listPublishedReports(locale: Locale, limit = 100): Promise<ReportList> {
  const db = getAdminDb()
  if (!db) return { state: "unavailable", reports: [] }
  try {
    // A range on one field needs no composite index, so listing works without an index deploy.
    const snapshot = await db
      .collection(REPORTS_COLLECTION)
      .where("feedKey", ">=", `${locale}#`)
      .where("feedKey", "<", `${locale}$`)
      .orderBy("feedKey", "desc")
      .limit(limit)
      .get()
    return { state: "ok", reports: snapshot.docs.map((doc) => doc.data() as Report).filter((report) => PUBLIC.includes(report.status)) }
  } catch (error) {
    console.error("Report listing failed", error instanceof Error ? error.message : "unknown")
    return { state: "unavailable", reports: [] }
  }
}

/** Null means no public report. A storage failure throws so the page can say so. */
export async function getPublishedReport(slug: string, locale: Locale): Promise<Report | null> {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null
  const db = getAdminDb()
  if (!db) throw new Error("Storage unavailable")
  const snapshot = await db.collection(REPORTS_COLLECTION).doc(`${slug}-${locale}`).get()
  const report = snapshot.exists ? (snapshot.data() as Report) : null
  return report && PUBLIC.includes(report.status) ? report : null
}
