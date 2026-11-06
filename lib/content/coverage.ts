// Previews, recaps and daily roundups. Every sentence is a template filled from
// verified fields, so nothing here can state a fact the feed did not supply: a game
// with no timeline gets no recap, and the short result report stands alone.

import { createHash } from "node:crypto"
import type { Firestore } from "firebase-admin/firestore"
import { getDictionary, LOCALES, type Locale } from "@/lib/i18n"
import type { MatchDetail, TimelineItem } from "@/lib/sports/detail"
import { byImportance } from "@/lib/sports/priority"
import { eventTitle, isDuel, resultLine } from "@/lib/sports/presentation"
import type { SportEvent } from "@/lib/sports/types"
import { eventDate, eventNames, eventNumbers, fill, numbersGrounded, REPORTS_COLLECTION, saveReport, sourceVersion, withholdReason, type Report, type ReportCounts, type ReportType } from "./reports"

/** Bump whenever the wording in COPY changes. */
export const COVERAGE_TEMPLATE_VERSION = "coverage-template-v1"

const PREVIEW_WINDOW_MS = 36 * 3_600_000
const RECAP_DETAILS_PER_TICK = 40
// A game with nothing to report is left alone until its facts move, so it stops taking
// a slot from games that have a timeline. Holds no personal data.
const RECAP_CHECKS = "recap_checks"
// The feed can post a timeline after full time, so an empty answer is asked again later.
const RECAP_RECHECK_MS = 6 * 3_600_000
const ROUNDUP_LINES = 30
const DEFAULT_ROUNDUP_HOUR_UTC = 6

const COPY: Record<Locale, {
  recapTitle: string; previewTitle: string; previewEventTitle: string; preview: string; previewEvent: string
  kickoff: string; dateOnly: string; venue: string; goal: string; ownGoal: string; penalty: string; red: string; scorer: string
  roundupTitle: string; roundupIntro: string; roundupLine: string; roundupEventLine: string; dateLocale: string
}> = {
  en: {
    recapTitle: "Recap: {home} v {away}",
    previewTitle: "Preview: {home} v {away}", previewEventTitle: "Preview: {event}",
    preview: "{home} and {away} meet in {competition}.", previewEvent: "{event} is next in {competition}.",
    kickoff: "Scheduled start: {date} at {time} (UTC).", dateOnly: "Scheduled date: {date} (UTC).", venue: "Venue: {venue}.",
    goal: "Goal", ownGoal: "Own goal", penalty: "Penalty goal", red: "Red card", scorer: "{minute}{label}: {player}{team}.",
    roundupTitle: "Daily roundup: {date}", roundupIntro: "Results from {date} (UTC).",
    roundupLine: "{competition}: {home} {homeScore}, {away} {awayScore}.", roundupEventLine: "{competition}: {event}. {result}.", dateLocale: "en-US",
  },
  fr: {
    recapTitle: "Compte rendu : {home} - {away}",
    previewTitle: "Avant-match : {home} - {away}", previewEventTitle: "Avant-événement : {event}",
    preview: "{home} et {away} se rencontrent en {competition}.", previewEvent: "{event} est au programme de {competition}.",
    kickoff: "Début prévu : {date} à {time} (UTC).", dateOnly: "Date prévue : {date} (UTC).", venue: "Lieu : {venue}.",
    goal: "But", ownGoal: "But contre son camp", penalty: "But sur penalty", red: "Carton rouge", scorer: "{minute}{label} : {player}{team}.",
    roundupTitle: "Le point du jour : {date}", roundupIntro: "Résultats du {date} (UTC).",
    roundupLine: "{competition} : {home} {homeScore}, {away} {awayScore}.", roundupEventLine: "{competition} : {event}. {result}.", dateLocale: "fr-FR",
  },
}

const version = (facts: unknown) => createHash("sha256").update(JSON.stringify(facts)).digest("hex").slice(0, 16)

function baseFields(event: SportEvent, type: ReportType, locale: Locale, facts: string, fetchedAt: string, now: Date) {
  const slug = `${event.id}-${type}`
  const generatedAt = now.toISOString()
  return {
    id: `${slug}-${locale}`, slug, matchId: event.id, sportId: event.sportId, locale, type,
    participants: event.participants.map((item) => item.name),
    competition: event.competition.name,
    eventDateUTC: event.scheduledStartUTC,
    sources: [{ provider: event.provider.name, eventId: event.provider.eventId, fetchedAt }],
    promptVersion: COVERAGE_TEMPLATE_VERSION,
    sourceVersion: facts,
    jobKey: `${event.id}:${type}:${locale}:${facts}`,
    correctionNote: null, editedAt: null, generatedAt, updatedAt: generatedAt, publishedAt: null, feedKey: null,
  }
}

/** The goals and red cards a recap states. Assists, bookings and substitutions stay in the paid report. */
function recapMoments(detail: MatchDetail): TimelineItem[] {
  return detail.timeline.filter((item) => (["goal", "penalty", "own-goal", "red"] as TimelineItem["kind"][]).includes(item.kind) && item.player)
}

/** A timeline that does not add up to the final score is held for a person, however close it is. */
function timelineAgrees(event: SportEvent, moments: TimelineItem[]): boolean {
  if (event.sportId !== "football" || event.score.kind !== "team") return true
  const goals = moments.filter((item) => item.kind !== "red").length
  return goals === event.score.home + event.score.away
}

function momentLine(item: TimelineItem, event: SportEvent, locale: Locale): string {
  const copy = COPY[locale]
  const label = { goal: copy.goal, penalty: copy.penalty, "own-goal": copy.ownGoal, red: copy.red }[item.kind as "goal" | "penalty" | "own-goal" | "red"]
  const [home, away] = event.participants.map((participant) => participant.name)
  const team = item.side === "home" ? home : item.side === "away" ? away : null
  return fill(copy.scorer, { minute: item.minute === null ? "" : `${item.minute}' `, label, player: item.player as string, team: team ? ` (${team})` : "" })
}

/** Null when there is nothing beyond the score to say, which is most of the feed. */
export function buildRecap(event: SportEvent, detail: MatchDetail, locale: Locale, fetchedAt: string, now: Date = new Date()): Report | null {
  if (withholdReason(event) || event.score.kind !== "team" || detail.state !== "ok") return null
  const moments = recapMoments(detail)
  if (moments.length === 0) return null

  const facts = version([sourceVersion(event), moments.map(({ id, minute, kind, side, player }) => [id, minute, kind, side, player])])
  const base = { ...baseFields(event, "recap", locale, facts, fetchedAt, now), factsVersion: sourceVersion(event) }
  const [home, away] = base.participants
  const result = fill(getDictionary(locale).newsletter.resultLine, { home, away, homeScore: String(event.score.home), awayScore: String(event.score.away) })
  const summary = `${result}. ${event.competition.name}, ${eventDate(event.scheduledStartUTC as string, locale)} (UTC).`
  const body = [summary, ...moments.map((item) => momentLine(item, event, locale))].join("\n")
  const players = moments.map((item) => item.player as string)
  const minutes = moments.flatMap((item) => (item.minute === null ? [] : [String(item.minute)]))

  const held = (reason: string) => ({ ...base, status: "draft" as const, withheldReason: reason })
  if (!numbersGrounded(body, [...eventNames(event), ...players], [...eventNumbers(event, locale), ...minutes])) {
    return { ...held("failed_validation"), status: "rejected", title: "", body: "" }
  }
  const title = fill(COPY[locale].recapTitle, { home, away })
  if (!timelineAgrees(event, moments)) return { ...held("timeline_conflict"), title, body }
  return { ...base, status: "validated", title, body, withheldReason: null }
}

export const previewable = (event: SportEvent, now: Date): boolean => {
  const start = event.scheduledStartUTC ? Date.parse(event.scheduledStartUTC) : Number.NaN
  return event.status === "scheduled" && start > now.getTime() && start <= now.getTime() + PREVIEW_WINDOW_MS
}

function previewBlocked(event: SportEvent): string | null {
  if (event.status !== "scheduled") return "event_changed"
  const names = event.participants.map((participant) => participant.name)
  const named = isDuel(event) ? names.every((name) => name && name !== "TBD") : Boolean(event.eventName)
  if (!named) return "missing_participants"
  if (!event.competition.name || event.competition.name === "Unknown competition") return "missing_competition"
  return event.provider.eventId && event.scheduledStartUTC ? null : "missing_source"
}

export function buildPreview(event: SportEvent, locale: Locale, fetchedAt: string, now: Date = new Date()): Report {
  const facts = version([event.status, event.participants.map((item) => item.name), event.eventName, event.competition.name, event.scheduledStartUTC, event.dateOnly, event.venue])
  const base = baseFields(event, "preview", locale, facts, fetchedAt, now)
  const blocked = previewBlocked(event)
  if (blocked) return { ...base, status: "draft", title: "", body: "", withheldReason: blocked }

  const copy = COPY[locale]
  const start = new Date(event.scheduledStartUTC as string)
  const date = eventDate(start.toISOString(), locale)
  const time = new Intl.DateTimeFormat(copy.dateLocale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" }).format(start)
  const [home = "", away = ""] = base.participants
  const name = eventTitle(event)
  const duel = isDuel(event)
  const values = { home, away, event: name, competition: event.competition.name }
  const body = [
    fill(duel ? copy.preview : copy.previewEvent, values),
    event.dateOnly ? fill(copy.dateOnly, { date }) : fill(copy.kickoff, { date, time }),
    ...(event.venue ? [fill(copy.venue, { venue: event.venue })] : []),
  ].join(" ")
  const allowed = [...(date.match(/\d+/g) ?? []), ...(time.match(/\d+/g) ?? [])]
  if (!numbersGrounded(body, [...eventNames(event), ...(event.venue ? [event.venue] : [])], allowed)) {
    return { ...base, status: "rejected", title: "", body: "", withheldReason: "failed_validation" }
  }
  return { ...base, status: "validated", title: fill(duel ? copy.previewTitle : copy.previewEventTitle, values), body, withheldReason: null }
}

export function buildRoundup(date: string, events: SportEvent[], locale: Locale, fetchedAt: string, now: Date = new Date()): Report | null {
  const included = events.filter((event) => event.status === "finished" && !withholdReason(event)).sort(byImportance).slice(0, ROUNDUP_LINES)
  if (included.length === 0) return null

  const copy = COPY[locale]
  const dictionary = getDictionary(locale)
  const lines = included.map((event) => {
    const competition = event.competition.name
    if (event.score.kind !== "team") return fill(copy.roundupEventLine, { competition, event: eventTitle(event), result: resultLine(event, dictionary) ?? "" })
    const [home, away] = event.participants.map((participant) => participant.name)
    return fill(copy.roundupLine, { competition, home, away, homeScore: String(event.score.home), awayScore: String(event.score.away) })
  })
  const day = eventDate(`${date}T12:00:00.000Z`, locale)
  const body = [fill(copy.roundupIntro, { date: day }), ...lines].join("\n")
  const names = included.flatMap(eventNames)
  const numbers = [...included.flatMap((event) => eventNumbers(event, locale)), ...(day.match(/\d+/g) ?? [])]

  const slug = `roundup-${date}`
  const facts = version(included.map(sourceVersion))
  const generatedAt = now.toISOString()
  const base = {
    id: `${slug}-${locale}`, slug, matchId: slug, sportId: "all", locale, type: "roundup" as const,
    participants: [...new Set(included.flatMap((event) => event.participants.map((item) => item.name)))],
    competition: "",
    eventDateUTC: `${date}T00:00:00.000Z`,
    sources: included.map((event) => ({ provider: event.provider.name, eventId: event.provider.eventId, fetchedAt })),
    promptVersion: COVERAGE_TEMPLATE_VERSION,
    sourceVersion: facts,
    jobKey: `${slug}:roundup:${locale}:${facts}`,
    correctionNote: null, editedAt: null, generatedAt, updatedAt: generatedAt, publishedAt: null, feedKey: null,
  }
  if (!numbersGrounded(body, names, numbers)) return { ...base, status: "rejected", title: "", body: "", withheldReason: "failed_validation" }
  return { ...base, status: "validated", title: fill(copy.roundupTitle, { date: day }), body, withheldReason: null }
}

export function roundupHourUTC(env: Record<string, string | undefined> = process.env): number {
  const hour = Number(env.ROUNDUP_HOUR_UTC)
  return env.ROUNDUP_HOUR_UTC && Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : DEFAULT_ROUNDUP_HOUR_UTC
}

const emptyCounts = (): ReportCounts => ({ created: 0, replaced: 0, duplicate: 0, locked: 0, kept: 0, queued: 0, failed: 0 })

async function saveAll(db: Firestore, reports: Report[], counts: ReportCounts): Promise<void> {
  for (const report of reports) {
    try {
      counts[await saveReport(db, report)] += 1
    } catch (error) {
      counts.failed += 1
      console.error("Report save failed", report.id, error instanceof Error ? error.message : "unknown")
    }
  }
}

/** Upcoming games get a preview. One that was postponed or canceled loses the preview it had. */
export async function runPreviews(db: Firestore, events: SportEvent[], fetchedAt: string, now: Date = new Date()): Promise<ReportCounts> {
  const counts = emptyCounts()
  const withdrawn = new Set(["postponed", "canceled", "abandoned"])
  const due = events.filter((event) => previewable(event, now) || withdrawn.has(event.status))
  await saveAll(db, due.flatMap((event) => LOCALES.map((locale) => buildPreview(event, locale, fetchedAt, now))), counts)
  return counts
}

export async function runRecaps(
  db: Firestore,
  events: SportEvent[],
  input: { detailFor(event: SportEvent, onFetch: () => void): Promise<MatchDetail>; fetchedAt: string },
  now: Date = new Date(),
): Promise<ReportCounts & { skipped: number }> {
  const counts = { ...emptyCounts(), skipped: 0 }
  const finished = events.filter((event) => event.status === "finished" && event.score.kind === "team" && !withholdReason(event))
  const newestFirst = [...finished].sort((a, b) => (b.scheduledStartUTC ?? "").localeCompare(a.scheduledStartUTC ?? ""))
  let fetched = 0
  for (const event of newestFirst) {
    // Match detail spends provider calls, so a game whose facts have not moved is left alone.
    const factsVersion = sourceVersion(event)
    const existing = await db.collection(REPORTS_COLLECTION).doc(`${event.id}-recap-en`).get()
    if (existing.exists && (existing.data() as Report).factsVersion === factsVersion) continue
    const checks = db.collection(RECAP_CHECKS).doc(event.id)
    const check = (await checks.get()).data() as { factsVersion: string; checkedAt: string } | undefined
    if (check?.factsVersion === factsVersion && now.getTime() - Date.parse(check.checkedAt) < RECAP_RECHECK_MS) continue
    if (fetched >= RECAP_DETAILS_PER_TICK) {
      counts.skipped += 1
      continue
    }
    let spent = false
    try {
      const detail = await input.detailFor(event, () => {
        spent = true
      })
      const reports = LOCALES.flatMap((locale) => buildRecap(event, detail, locale, input.fetchedAt, now) ?? [])
      await saveAll(db, reports, counts)
      // A provider failure says nothing about the game, so it is not remembered.
      if (reports.length === 0 && detail.state !== "unavailable") await checks.set({ factsVersion, checkedAt: now.toISOString() })
    } catch (error) {
      counts.failed += 1
      console.error("Recap failed", event.id, error instanceof Error ? error.message : "unknown")
    }
    if (spent) fetched += 1
  }
  return counts
}

/** Yesterday's games, once a day. Reruns in the same day are duplicates by source version. */
export async function runRoundup(db: Firestore, events: SportEvent[], fetchedAt: string, now: Date = new Date()): Promise<ReportCounts | { skipped: string }> {
  if (now.getUTCHours() < roundupHourUTC()) return { skipped: "before_schedule" }
  const date = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10)
  const counts = emptyCounts()
  const day = events.filter((event) => event.scheduledStartUTC?.startsWith(date))
  await saveAll(db, LOCALES.flatMap((locale) => buildRoundup(date, day, locale, fetchedAt, now) ?? []), counts)
  return counts
}
