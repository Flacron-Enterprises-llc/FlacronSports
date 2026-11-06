import { FieldPath, type Firestore, type QueryDocumentSnapshot } from "firebase-admin/firestore"
import { ApiError } from "@/lib/api-auth"
import { runAlerts, type UserRow } from "@/lib/alerts/notifications"
import { getEffectiveAccess } from "@/lib/billing/firestore-store"
import { settlePredictions } from "@/lib/community/predictions"
import { firestoreDocDb } from "@/lib/doc-db"
import { runPreviews, runRecaps, runRoundup } from "@/lib/content/coverage"
import { runReports } from "@/lib/content/reports"
import { sendEmail } from "@/lib/email-service"
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin"
import { DEFAULT_PREFERENCES, type Preferences } from "@/lib/me/preferences"
import { runNewsletter } from "@/lib/newsletter/digest"
import { flushMetrics } from "@/lib/ops/metrics"
import { failedJobs, recordRun, type JobRun } from "@/lib/ops/runs"
import { seenPath, summarizeSeen } from "@/lib/sports/coverage"
import { isMajorCompetition } from "@/lib/sports/priority"
import type { EventFeed, SportId } from "@/lib/sports/types"
import { videoFor } from "@/lib/video/catalog"
import { refreshClips, storedClips } from "@/lib/video/scorebat"
import { enabledSports, feedIsLimited, getEvent, getEvents, getMatchDetail, providerStatus, refreshBroadcasts, sportFeedStates, storedEvents, utcDate } from "@/lib/sports/service"
import type { SportEvent } from "@/lib/sports/types"

const PAGE_SIZE = 300
const DAY = 86_400_000

async function* preferenceRows(db: Firestore): AsyncGenerator<UserRow> {
  let last: QueryDocumentSnapshot | undefined
  for (;;) {
    let query = db.collection("user_preferences").orderBy(FieldPath.documentId()).limit(PAGE_SIZE)
    if (last) query = query.startAfter(last)
    const page = await query.get()
    for (const doc of page.docs) yield { uid: doc.id, prefs: { ...DEFAULT_PREFERENCES, ...(doc.data() as Partial<Preferences>) } }
    if (page.docs.length < PAGE_SIZE) return
    last = page.docs[page.docs.length - 1]
  }
}

/** Mail goes only to a verified address on an active account. */
async function verifiedEmail(uid: string): Promise<string | null> {
  const user = await getAdminAuth()?.getUser(uid).catch(() => null)
  return user?.email && user.emailVerified && !user.disabled ? user.email : null
}

/** The daily digest is a plan benefit, so an opted-in account with no plan is skipped. */
async function* subscriberDigestRows(db: Firestore): AsyncGenerator<UserRow> {
  for await (const row of preferenceRows(db)) {
    if (row.prefs.newsletter.optedIn && (await getEffectiveAccess(row.uid)).plan !== "none") yield row
  }
}

export type JobResult<T> = T | { failed: true; error: string }

/** Each job is isolated, so one failure is reported without stopping the others. */
export async function runIsolated<T extends Record<string, () => Promise<unknown>>>(jobs: T): Promise<{ [K in keyof T]: JobResult<Awaited<ReturnType<T[K]>>> }> {
  const results: Record<string, unknown> = {}
  for (const [name, job] of Object.entries(jobs)) {
    try {
      results[name] = await job()
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown"
      console.error(`Job ${name} failed`, message)
      results[name] = { failed: true, error: "job_failed" }
    }
  }
  return results as { [K in keyof T]: JobResult<Awaited<ReturnType<T[K]>>> }
}

const TICK_MS = 15 * 60_000
const ROTATING_OFFSETS = [-7, -6, -5, -4, -3, -2, 2, 3, 4, 5, 6, 7]
const ROTATING_PER_TICK = 2
const LISTINGS_PER_TICK = 2
// The paid feed allows far more calls, so every stored day stays under an hour old.
const PAID_ROTATING_PER_TICK = 4
const PAID_LISTINGS_PER_TICK = 6

/**
 * The days a visitor can open beyond yesterday and today. Tomorrow is kept current
 * and the rest take turns, so the calendar stays stored without tripping the rate limit.
 */
export function calendarDates(now: Date): string[] {
  const perTick = feedIsLimited() ? ROTATING_PER_TICK : PAID_ROTATING_PER_TICK
  const start = Math.floor(now.getTime() / TICK_MS) * perTick
  const rotating = Array.from({ length: perTick }, (_, index) => ROTATING_OFFSETS[(start + index) % ROTATING_OFFSETS.length])
  return [1, ...rotating].map((offset) => utcDate(new Date(now.getTime() + offset * DAY)))
}

/** TV listings for today and tomorrow, one sport and day at a time. */
export function listingTargets(now: Date): { date: string; sportId: SportId }[] {
  const sports = enabledSports()
  const pairs = [0, 1].flatMap((offset) => sports.map((sport) => ({ date: utcDate(new Date(now.getTime() + offset * DAY)), sportId: sport.id })))
  if (pairs.length === 0) return []
  const perTick = feedIsLimited() ? LISTINGS_PER_TICK : PAID_LISTINGS_PER_TICK
  const start = Math.floor(now.getTime() / TICK_MS) * perTick
  return Array.from({ length: perTick }, (_, index) => pairs[(start + index) % pairs.length])
}

export function reportableEvents(events: SportEvent[], followed: Set<string>): SportEvent[] {
  return events.filter((event) => isMajorCompetition(event.competition.name) || event.participants.some((participant) => followed.has(participant.name)))
}

interface JobContext {
  db: Firestore
  now: Date
  siteUrl: string
  yesterday: EventFeed
  today: EventFeed
  events: SportEvent[]
  /** Reads every member's preferences, so it runs at most once per context. */
  targets(events: SportEvent[]): Promise<SportEvent[]>
}

async function loadContext(db: Firestore, now: Date): Promise<JobContext> {
  // Yesterday too: a late kickoff finishes after midnight UTC, under the previous date.
  const yesterday = await getEvents({ date: utcDate(new Date(now.getTime() - DAY)), refresh: true })
  const today = await getEvents({ date: utcDate(now), refresh: true })
  const seen = new Set<string>()
  const events: SportEvent[] = [...yesterday.events, ...today.events].filter((event) => !seen.has(event.id) && seen.add(event.id))
  let followed: Promise<Set<string>> | null = null
  const loadFollowed = async () => {
    const names = new Set<string>()
    for await (const { prefs } of preferenceRows(db)) for (const name of prefs.favorites) names.add(name)
    return names
  }
  return {
    db, now, yesterday, today, events,
    siteUrl: process.env.APP_BASE_URL || "https://flacronsport.com",
    // The full feed has hundreds of finished games a day. A written report for every
    // regional fixture would bury the news page, so it covers the major competitions
    // and any game a member follows, which is what personalized reports are made from.
    targets: async (list) => (feedIsLimited() ? list : reportableEvents(list, await (followed ??= loadFollowed()))),
  }
}

// Order matters: results settle before recaps are written, and the slower jobs that
// spend provider calls run after alerts and the newsletter so they cannot hold them up.
const JOBS = {
  predictions: async ({ events, now }: JobContext) => {
    if (process.env.COMMUNITY_ENABLED !== "true") return { skipped: "community_disabled" }
    return settlePredictions(firestoreDocDb(), { events, lookup: (id) => getEvent(id, { anyCoverage: true }) }, now)
  },
  reports: async ({ db, events, today, now, targets }: JobContext) => runReports(db, await targets(events), today.fetchedAt, now),
  alerts: ({ db, events, now, siteUrl }: JobContext) =>
    runAlerts({
      db, events, now, siteUrl, send: sendEmail, emailFor: verifiedEmail,
      users: preferenceRows(db),
      planFor: async (uid) => (await getEffectiveAccess(uid)).plan,
      confirm: async (event, type) => {
        if (type === "highlights") return Boolean(await videoFor(event))
        const { home, away } = (await getMatchDetail(event)).lineups
        return home.length > 0 && away.length > 0
      },
    }),
  newsletter: async ({ db, events, now, siteUrl, today }: JobContext) => {
    // Skipping leaves the day unclaimed, so a later tick in the hour can still send.
    if (today.state === "unavailable") return { skipped: "feed_unavailable" }
    return runNewsletter({ db, events, now, siteUrl, send: sendEmail, emailFor: verifiedEmail, users: subscriberDigestRows(db) })
  },
  recaps: async ({ db, events, today, now, targets }: JobContext) => {
    // The public test key has no match detail worth reporting from.
    if (feedIsLimited()) return { skipped: "feed_limited" }
    return runRecaps(db, await targets(events), { detailFor: getMatchDetail, fetchedAt: today.fetchedAt }, now)
  },
  previews: async ({ db, today, now, targets }: JobContext) => {
    const tomorrow = await storedEvents(utcDate(new Date(now.getTime() + DAY)))
    const seen = new Set<string>()
    const upcoming = [...today.events, ...tomorrow].filter((event) => !seen.has(event.id) && seen.add(event.id))
    return runPreviews(db, await targets(upcoming), today.fetchedAt, now)
  },
  roundup: async ({ db, yesterday, now, targets }: JobContext) => runRoundup(db, await targets(yesterday.events), yesterday.fetchedAt, now),
  calendar: async ({ now }: JobContext) => {
    const days: Record<string, string> = {}
    for (const date of calendarDates(now)) {
      days[date] = (await getEvents({ date, refresh: true })).state
      if (days[date] === "unavailable") break
    }
    for (const target of listingTargets(now)) await refreshBroadcasts(target.date, target.sportId).catch(() => undefined)
    return days
  },
  clips: async () => ({ state: await refreshClips() }),
} as const

export type JobName = keyof typeof JOBS
export const JOB_NAMES = Object.keys(JOBS) as JobName[]

/** Last seen per competition. One document per sport, so this costs a few writes a tick. */
async function recordCoverage(db: Firestore, events: SportEvent[], at: string): Promise<void> {
  const sports = summarizeSeen(events, at)
  const clips = await storedClips().catch(() => [])
  const football = sports.get("football") ?? {}
  for (const { competition } of clips) {
    if (competition && !football[competition]) football[competition] = { name: competition, country: null, lastSeenAt: at, events: 0, videoOnly: true }
  }
  if (clips.length > 0) sports.set("football", football)
  await Promise.all([...sports].map(([sportId, competitions]) => db.doc(seenPath(sportId)).set({ competitions }, { merge: true })))
}

export function assertJobStorage(): Firestore {
  const db = getAdminDb()
  if (!db) throw new ApiError(503, "storage_unavailable", "Storage is not available")
  return db
}

/** Stores what happened either way, so the Operations screen shows a run that died too. */
async function recorded<T extends Record<string, unknown>>(db: Firestore, meta: Pick<JobRun, "trigger" | "job" | "actorUid">, at: Date, run: () => Promise<T>): Promise<T> {
  const write = (results: Record<string, unknown>, aborted: boolean) =>
    recordRun(db, { ...meta, at: at.toISOString(), finishedAt: new Date().toISOString(), failed: failedJobs(results), aborted, results: { ...results, providers: providerStatus(), sports: sportFeedStates() } })
  try {
    const results = await run()
    await write(results, false)
    return results
  } catch (error) {
    await write({ error: error instanceof Error ? error.message : "unknown" }, true)
    throw error
  } finally {
    await flushMetrics(db)
  }
}

let ticking = false

export async function runTick(now: Date = new Date()) {
  // A long provider cooldown can outlast the 15 minute schedule.
  if (ticking) return { skipped: "already_running" }
  ticking = true
  try {
    const db = assertJobStorage()
    return await recorded(db, { trigger: "schedule", job: "tick", actorUid: null }, now, () => tick(db, now))
  } finally {
    ticking = false
  }
}

async function tick(db: Firestore, now: Date) {
  const context = await loadContext(db, now)
  const jobs = await runIsolated(Object.fromEntries(JOB_NAMES.map((name) => [name, () => JOBS[name](context)])))
  await recordCoverage(db, context.events, now.toISOString()).catch((error: unknown) => {
    console.error("Coverage not recorded", error instanceof Error ? error.message : "unknown")
  })
  return { feed: { yesterday: context.yesterday.state, today: context.today.state, events: context.events.length }, ...jobs }
}

/**
 * Staff re-run of one job. It starts here and finishes in the background, because a
 * job can outlast the gateway's time limit; the result lands in job_runs. Duplicate
 * mail is impossible rather than unlikely: alerts and digests claim their document
 * with create() before sending, so a re-run sends only what was never claimed.
 */
export function startJob(job: JobName, actorUid: string, now: Date = new Date()): void {
  const db = assertJobStorage()
  if (ticking) throw new ApiError(409, "job_running", "A job is already running. Try again shortly.")
  ticking = true
  void recorded(db, { trigger: "admin", job, actorUid }, now, async () => {
    const context = await loadContext(db, now)
    return runIsolated({ [job]: () => JOBS[job](context) })
  })
    .catch((error: unknown) => console.error(`Job ${job} aborted`, error instanceof Error ? error.message : "unknown"))
    .finally(() => {
      ticking = false
    })
}
