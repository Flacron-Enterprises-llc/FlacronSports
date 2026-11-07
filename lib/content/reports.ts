import { createHash } from "node:crypto"
import type { Firestore } from "firebase-admin/firestore"
import { ApiError, featureOn } from "@/lib/api-auth"
import type { DocDb } from "@/lib/doc-db"
import { getAdminDb } from "@/lib/firebase-admin"
import { memberFetch, MemberAccessRequired } from "@/lib/member-fetch"
import { getDictionary, LOCALES, type Locale } from "@/lib/i18n"
import { eventTitle, isDuel, resultLine } from "@/lib/sports/presentation"
import type { EventConclusion, EventScore, SportEvent, SportId } from "@/lib/sports/types"
import { balanceBySport, isSportRoundup, visibleReports } from "./news"

export const REPORTS_COLLECTION = "reports"
export const REPORT_VERSIONS = "report_versions"
export const MAX_VERSIONS = 10
/** Bump whenever the wording in TEMPLATES changes. */
export const TEMPLATE_VERSION = "result-template-v2"

export type ReportStatus = "draft" | "validated" | "published" | "corrected" | "rejected"
export type ReportType = "result" | "recap" | "preview" | "roundup"

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
  /** locale#sportId#publishedAt, set only while public. See listNewsReports. */
  sportFeedKey?: string | null
  /** The match facts behind a recap, so the job can skip games that have not changed. */
  factsVersion?: string
  /** How many earlier versions an editor can roll back to. */
  previousVersions?: number
}

/** What a rollback restores. Kept out of `reports`, whose documents are served publicly. */
export interface ReportVersion {
  title: string
  body: string
  status: ReportStatus
  correctionNote: string | null
  withheldReason: string | null
  publishedAt: string | null
  feedKey: string | null
  savedAt: string
  savedBy: string
  action: string
}

export type SaveOutcome = "created" | "replaced" | "duplicate" | "locked" | "kept" | "queued"

// Deliberately neutral: no "beat" or "won", because a level score can still be
// settled on penalties and the feed does not give the shootout result.
const TEMPLATES: Record<Locale, {
  title: string; eventTitle: string; body: string; finalScore: string; finalSets: string; setScores: string
  classification: string; bout: string; endings: Record<EventConclusion, string>; dateLocale: string
}> = {
  en: {
    title: "Result: {home} v {away}", eventTitle: "Result: {event}", body: "{result}. {competition}, {date} (UTC).",
    finalScore: "Final score: {home} {homeScore}, {away} {awayScore}", finalSets: "Final score in sets: {home} {homeScore}, {away} {awayScore}", setScores: "Set scores: {sets}",
    classification: "Classification: {result}", bout: "{home} v {away}: {result}",
    endings: { "extra-time": "after extra time", overtime: "after overtime", penalties: "after a penalty shootout", shootout: "after a shootout", awarded: "result awarded", walkover: "walkover" },
    dateLocale: "en-US",
  },
  fr: {
    title: "Résultat : {home} - {away}", eventTitle: "Résultat : {event}", body: "{result}. {competition}, {date} (UTC).",
    finalScore: "Score final : {home} {homeScore}, {away} {awayScore}", finalSets: "Score final en sets : {home} {homeScore}, {away} {awayScore}", setScores: "Détail des sets : {sets}",
    classification: "Classement : {result}", bout: "{home} - {away} : {result}",
    endings: { "extra-time": "après prolongation", overtime: "après prolongation", penalties: "aux tirs au but", shootout: "aux tirs de barrage", awarded: "résultat sur décision", walkover: "forfait" },
    dateLocale: "fr-FR",
  },
}

const PUBLIC: ReportStatus[] = ["published", "corrected"]
export const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (_, key: string) => values[key])

export function eventDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(TEMPLATES[locale].dateLocale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(iso))
}

/** Only a complete result can be reported: one side's score is not a result. */
function isComplete(score: EventScore): boolean {
  if (score.kind === "team") return [score.home, score.away].every((value) => Number.isInteger(value) && value >= 0)
  // A drawn or tied match has no winner, and some results name one with no totals.
  if (score.kind === "innings") return Boolean(score.winner) || score.outcome === "drawn" || score.outcome === "tied"
  if (score.kind === "sets") return Boolean(score.winner || score.retired)
  return score.kind === "combat" || score.kind === "classification"
}

/** Why an event cannot be reported on, or null when every required fact is verified. */
export function withholdReason(event: SportEvent): { status: "draft" | "rejected"; reason: string } | null {
  if (event.status !== "finished") return { status: "draft", reason: "not_finished" }
  const { score } = event
  if (!isComplete(score)) return { status: "rejected", reason: "missing_score" }
  const names = event.participants.map((participant) => participant.name)
  const named = score.kind === "classification" ? Boolean(event.eventName) : names.length === 2 && names.every((name) => name && name !== "TBD")
  if (!named) return { status: "rejected", reason: "missing_participants" }
  if (!event.scheduledStartUTC) return { status: "rejected", reason: "missing_date" }
  if (!event.competition.name || event.competition.name === "Unknown competition") return { status: "rejected", reason: "missing_competition" }
  if (!event.provider.eventId) return { status: "rejected", reason: "missing_source" }
  return null
}

export function sourceVersion(event: SportEvent): string {
  const facts = [event.status, event.score, event.participants.map((item) => item.name), event.competition.name, event.scheduledStartUTC]
  return createHash("sha256").update(JSON.stringify(facts)).digest("hex").slice(0, 16)
}

const setDetail = (event: SportEvent) => (event.breakdown?.segments ?? []).filter((segment) => segment.kind === "set" && segment.home !== null && segment.away !== null)

/** The result in the sport's own terms. Everything but a team score comes from resultLine, so cards and reports agree. */
export function resultSentence(event: SportEvent, locale: Locale): string {
  const { score } = event
  const copy = TEMPLATES[locale]
  const [home = "", away = ""] = event.participants.map((participant) => participant.name)
  if (score.kind === "team") {
    // A golden set's score is points, so only a full match reads as sets.
    const volleyball = event.sportId === "volleyball" && !(event.details?.kind === "volleyball" && event.details.goldenSet)
    const line = fill(volleyball ? copy.finalSets : copy.finalScore, { home, away, homeScore: String(score.home), awayScore: String(score.away) })
    const ending = event.conclusion ? ` (${copy.endings[event.conclusion]})` : ""
    const sets = volleyball ? setDetail(event).map((segment) => `${segment.home}-${segment.away}`).join(", ") : ""
    return `${line}${ending}${sets ? `. ${fill(copy.setScores, { sets })}` : ""}`
  }
  const result = resultLine(event, getDictionary(locale)) ?? ""
  if (score.kind === "classification") return fill(copy.classification, { result })
  return score.kind === "combat" && isDuel(event) ? fill(copy.bout, { home, away, result }) : result
}

/** The competition, plus the tournament or card when the feed names one. */
export function eventPlace(event: SportEvent): string {
  const { name } = event.competition
  if (!event.eventName || !isDuel(event) || event.eventName === name) return name
  return event.eventName.startsWith(name) ? event.eventName : `${name}, ${event.eventName}`
}

/** Longest first, so a name inside a longer one cannot leave digits behind. */
export function numbersGrounded(body: string, names: string[], allowed: Iterable<string>): boolean {
  const known = new Set(allowed)
  const rest = [...names].sort((a, b) => b.length - a.length).reduce((text, name) => (name ? text.split(name).join(" ") : text), body)
  return (rest.match(/\d+/g) ?? []).every((number) => known.has(number))
}

export const eventNames = (event: SportEvent) => [...event.participants.map((item) => item.name), event.competition.name, ...(event.eventName ? [event.eventName] : [])]

export function eventNumbers(event: SportEvent, locale: Locale): string[] {
  const date = event.scheduledStartUTC ? eventDate(event.scheduledStartUTC, locale).match(/\d+/g) ?? [] : []
  const sets = setDetail(event).flatMap((segment) => [String(segment.home), String(segment.away)])
  return [...(JSON.stringify(event.score).match(/\d+/g) ?? []), ...sets, ...date]
}

/** Every number in the text must come from the event, whatever its teams are called. */
export function isGrounded(body: string, event: SportEvent, locale: Locale): boolean {
  if (event.score.kind === "none" || !event.scheduledStartUTC) return false
  return numbersGrounded(body, eventNames(event), eventNumbers(event, locale))
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

  const [home = "", away = ""] = base.participants
  const template = TEMPLATES[locale]
  const body = fill(template.body, { result: resultSentence(event, locale), competition: eventPlace(event), date: eventDate(event.scheduledStartUTC as string, locale) })
  if (!isGrounded(body, event, locale)) {
    return { ...base, status: "rejected", title: "", body: "", withheldReason: "failed_validation", publishedAt: null, feedKey: null }
  }
  const title = isDuel(event) ? fill(template.title, { home, away }) : fill(template.eventTitle, { event: eventTitle(event) })
  return { ...base, status: "validated", title, body, withheldReason: null, publishedAt: null, feedKey: null }
}

export function versionOf(report: Report, action: string, by: string, at: string): ReportVersion {
  const { title, body, status, correctionNote, withheldReason, publishedAt, feedKey } = report
  return { title, body, status, correctionNote: correctionNote ?? null, withheldReason: withheldReason ?? null, publishedAt: publishedAt ?? null, feedKey: feedKey ?? null, savedAt: at, savedBy: by, action }
}

export const nextVersions = (stored: { versions?: ReportVersion[] } | null | undefined, version: ReportVersion) => [...(stored?.versions ?? []), version].slice(-MAX_VERSIONS)

export const sportFeedKey = (report: Pick<Report, "locale" | "sportId">, publishedAt: string) => `${report.locale}#${report.sportId}#${publishedAt}`

const publishNow = (report: Report): Report => ({
  ...report,
  status: "published",
  publishedAt: report.generatedAt,
  feedKey: `${report.locale}#${report.generatedAt}`,
  sportFeedKey: sportFeedKey(report, report.generatedAt),
})

const editorOwned = (report: Report) => report.status === "corrected" || Boolean(report.correctionNote) || Boolean(report.editedAt)

/**
 * One document per match, type and locale, with the source version in jobKey.
 * Keeping a single document is what stops two conflicting public reports existing
 * for one match. Everything runs in a transaction so overlapping ticks agree.
 */
export function saveReport(db: Firestore, report: Report): Promise<SaveOutcome> {
  const ref = db.collection(REPORTS_COLLECTION).doc(report.id)
  const history = db.collection(REPORT_VERSIONS).doc(report.id)
  // With publishing off, validated text waits for an editor instead of going public.
  const automatic = featureOn("FEATURE_GENERATED_PUBLISHING")
  const ready = report.status === "validated" && automatic ? publishNow(report) : report

  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref)
    if (!snapshot.exists) {
      // A withdrawal only ever applies to a preview that was already written.
      if (report.type === "preview" && !report.title) return "kept"
      tx.create(ref, ready)
      return "created"
    }
    const existing = snapshot.data() as Report
    if (editorOwned(existing)) return "locked"
    if (existing.jobKey === report.jobKey) {
      if (existing.status !== "validated" || !automatic) return "duplicate"
      tx.set(ref, publishNow(existing))
      return "replaced"
    }

    if (report.type === "preview") {
      // A preview states no result, so a new kickoff simply updates it, and a game
      // that will not take place comes down rather than wait for a person.
      const live = report.title && ready.status === "published" && existing.publishedAt
      tx.set(ref, live ? { ...ready, publishedAt: existing.publishedAt, feedKey: existing.feedKey, sportFeedKey: sportFeedKey(ready, existing.publishedAt as string) } : ready)
      return "replaced"
    }

    const contested = existing.status === "published" || existing.withheldReason === "source_changed"
    if (!report.title) {
      // A feed that lost the score must not take down a report that had one.
      if (contested) return "kept"
      tx.set(ref, ready)
      return "replaced"
    }
    if (contested) {
      // The facts changed after publication, so a person decides which is right.
      // What was public is kept, so they can put it back.
      const stored = (await tx.get(history)).data() as { versions?: ReportVersion[] } | undefined
      const versions = existing.status === "published" ? nextVersions(stored, versionOf(existing, "source_changed", "job", report.generatedAt)) : (stored?.versions ?? [])
      tx.set(history, { versions })
      tx.set(ref, { ...report, status: "draft", withheldReason: "source_changed", generatedAt: existing.generatedAt, previousVersions: versions.length })
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
export async function applyCorrection(db: DocDb, id: string, correction: { body: string; title?: string; note: string; actorUid: string }, now: Date = new Date()): Promise<void> {
  const path = `${REPORTS_COLLECTION}/${id}`
  const historyPath = `${REPORT_VERSIONS}/${id}`
  await db.transaction(async (tx) => {
    const report = await tx.get<Report>(path)
    if (!report) throw new ApiError(404, "not_found", "Report not found")
    const stored = await tx.get<{ versions?: ReportVersion[] }>(historyPath)
    const title = correction.title ?? report.title
    if (!title) throw new ApiError(400, "title_required", "This report has no title yet, so a correction needs one")
    const stamp = now.toISOString()
    const publishedAt = report.publishedAt ?? stamp
    const versions = nextVersions(stored, versionOf(report, "corrected", correction.actorUid, stamp))
    tx.set(historyPath, { versions })
    tx.set(path, {
      ...report, status: "corrected", title, body: correction.body, correctionNote: correction.note,
      withheldReason: null, editedAt: stamp, updatedAt: stamp, publishedAt, feedKey: `${report.locale}#${publishedAt}`, sportFeedKey: sportFeedKey(report, publishedAt), previousVersions: versions.length,
    })
  })
}

export interface ReportList {
  state: "ok" | "unavailable" | "withheld"
  reports: Report[]
}

/** Reads only `reports`. The legacy `articles` collection is never touched. */
/** Set on Amplify, which holds no database credentials. Unset on ECS, which answers these calls. */
async function fromBackend<T>(path: string): Promise<T | null> {
  const origin = process.env.API_ORIGIN
  if (!origin) return null
  const response = await memberFetch(`${origin}${path}`)
  if (response.status === 404) return { report: null } as T
  if (!response.ok) throw new Error(`Backend responded ${response.status}`)
  return response.json() as Promise<T>
}

export async function listPublishedReports(locale: Locale, limit = 200): Promise<ReportList> {
  const remote = await fromBackend<ReportList>(`/api/reports?locale=${locale}`).catch((error) => ({ state: error instanceof MemberAccessRequired ? "withheld" : "unavailable", reports: [] }) as ReportList)
  if (remote) return remote
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
    return { state: "ok", reports: wideFeed(snapshot.docs.map((doc) => doc.data() as Report)) }
  } catch (error) {
    console.error("Report listing failed", error instanceof Error ? error.message : "unknown")
    return { state: "unavailable", reports: [] }
  }
}

const wideFeed = (reports: Report[]) => visibleReports(reports.filter((report) => PUBLIC.includes(report.status) && !isSportRoundup(report)))

// Sports with few reports are read on their own, so a busy one cannot push them out of a shared limit.
const SPORT_FEED_LIMIT = 200
const NEWS_SHARED_LIMIT = 300
const NEWS_PER_SPORT = 12

async function latestForSport(db: Firestore, locale: Locale, sportId: string, limit: number): Promise<Report[]> {
  const prefix = `${locale}#${sportId}`
  // One field, like feedKey, so this also needs no composite index.
  const snapshot = await db
    .collection(REPORTS_COLLECTION)
    .where("sportFeedKey", ">=", `${prefix}#`)
    .where("sportFeedKey", "<", `${prefix}$`)
    .orderBy("sportFeedKey", "desc")
    .limit(limit)
    .get()
  return snapshot.docs.map((doc) => doc.data() as Report)
}

/** Reports published before sportFeedKey existed. Equality on these fields uses the single-field indexes. */
async function olderForSport(db: Firestore, locale: Locale, sportId: string, limit: number): Promise<Report[]> {
  const snapshot = await db.collection(REPORTS_COLLECTION).where("sportId", "==", sportId).where("locale", "==", locale).where("status", "in", PUBLIC).limit(limit).get()
  return snapshot.docs.map((doc) => doc.data() as Report)
}

const newestFirst = (reports: Report[]) => {
  const unique = new Map(reports.map((report) => [report.id, report]))
  return [...unique.values()].sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
}

/** The news page's list: one sport's own reports, or every sport with each kept in view. */
export async function listNewsReports(locale: Locale, sportId: SportId | null, sports: SportId[]): Promise<ReportList> {
  const query = new URLSearchParams({ locale, feed: "news", ...(sportId ? { sport: sportId } : {}) })
  const remote = await fromBackend<ReportList>(`/api/reports?${query}`).catch((error) => ({ state: error instanceof MemberAccessRequired ? "withheld" : "unavailable", reports: [] }) as ReportList)
  if (remote) return remote
  const db = getAdminDb()
  if (!db) return { state: "unavailable", reports: [] }
  try {
    if (sportId) {
      const latest = await latestForSport(db, locale, sportId, SPORT_FEED_LIMIT)
      // Old reports are a bonus: failing to read them must not hide the current ones.
      const older = latest.length < SPORT_FEED_LIMIT ? await olderForSport(db, locale, sportId, SPORT_FEED_LIMIT).catch(() => []) : []
      return { state: "ok", reports: visibleReports(newestFirst([...latest, ...older]).filter((report) => PUBLIC.includes(report.status))) }
    }
    const shared = await listPublishedReports(locale, NEWS_SHARED_LIMIT)
    if (shared.state !== "ok") return shared
    const each = await Promise.all(sports.map((sport) => latestForSport(db, locale, sport, NEWS_PER_SPORT)))
    return { state: "ok", reports: balanceBySport(wideFeed(newestFirst([...shared.reports, ...each.flat()]))) }
  } catch (error) {
    console.error("News listing failed", error instanceof Error ? error.message : "unknown")
    return { state: "unavailable", reports: [] }
  }
}

/** Null means no public report. A storage failure throws so the page can say so. */
export async function getPublishedReport(slug: string, locale: Locale): Promise<Report | null> {
  const remote = await fromBackend<{ report: Report | null }>(`/api/reports/${encodeURIComponent(slug)}?locale=${locale}`)
  if (remote) return remote.report
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null
  const db = getAdminDb()
  if (!db) throw new Error("Storage unavailable")
  const snapshot = await db.collection(REPORTS_COLLECTION).doc(`${slug}-${locale}`).get()
  const report = snapshot.exists ? (snapshot.data() as Report) : null
  return report && PUBLIC.includes(report.status) ? report : null
}
