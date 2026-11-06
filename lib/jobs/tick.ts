import { FieldPath, type Firestore, type QueryDocumentSnapshot } from "firebase-admin/firestore"
import { ApiError } from "@/lib/api-auth"
import { runAlerts, type UserRow } from "@/lib/alerts/notifications"
import { getEffectiveAccess } from "@/lib/billing/firestore-store"
import { pendingMatchIds, settleMatch } from "@/lib/community/predictions"
import { firestoreDocDb } from "@/lib/doc-db"
import { runReports } from "@/lib/content/reports"
import { sendEmail } from "@/lib/email-service"
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin"
import { DEFAULT_PREFERENCES, type Preferences } from "@/lib/me/preferences"
import { runNewsletter } from "@/lib/newsletter/digest"
import { isMajorCompetition } from "@/lib/sports/priority"
import type { SportId } from "@/lib/sports/types"
import { refreshClips } from "@/lib/video/scorebat"
import { enabledSports, feedIsLimited, getEvent, getEvents, refreshBroadcasts, utcDate } from "@/lib/sports/service"
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

let ticking = false

export async function runTick(now: Date = new Date()) {
  // A long provider cooldown can outlast the 15 minute schedule.
  if (ticking) return { skipped: "already_running" }
  ticking = true
  try {
    return await tick(now)
  } finally {
    ticking = false
  }
}

async function tick(now: Date) {
  const db = getAdminDb()
  if (!db) throw new ApiError(503, "storage_unavailable", "Storage is not available")

  // Yesterday too: a late kickoff finishes after midnight UTC, under the previous date.
  const yesterday = await getEvents({ date: utcDate(new Date(now.getTime() - DAY)), refresh: true })
  const today = await getEvents({ date: utcDate(now), refresh: true })
  const seen = new Set<string>()
  const events: SportEvent[] = [...yesterday.events, ...today.events].filter((event) => !seen.has(event.id) && seen.add(event.id))
  const siteUrl = process.env.APP_BASE_URL || "https://flacronsport.com"

  const jobs = await runIsolated({
    // The full feed has hundreds of finished games a day. A written report for every
    // regional fixture would bury the news page, so it covers the major competitions.
    reports: () => runReports(db, feedIsLimited() ? events : events.filter((event) => isMajorCompetition(event.competition.name)), today.fetchedAt, now),
    alerts: () =>
      runAlerts({
        db, events, now, siteUrl, send: sendEmail, emailFor: verifiedEmail,
        users: preferenceRows(db),
        planFor: async (uid) => (await getEffectiveAccess(uid)).plan,
      }),
    predictions: async () => {
      if (process.env.COMMUNITY_ENABLED !== "true") return { skipped: "community_disabled" }
      const docs = firestoreDocDb()
      let settled = 0
      for (const matchId of await pendingMatchIds(docs)) {
        const event = await getEvent(matchId)
        if (event) settled += (await settleMatch(docs, event)).settled
      }
      return { settled }
    },
    newsletter: async () => {
      // Skipping leaves the day unclaimed, so a later tick in the hour can still send.
      if (today.state === "unavailable") return { skipped: "feed_unavailable" }
      return runNewsletter({ db, events, now, siteUrl, send: sendEmail, emailFor: verifiedEmail, users: preferenceRows(db) })
    },
  })

  // Last, so a slow provider cannot hold up the jobs above.
  const calendar: Record<string, string> = {}
  for (const date of calendarDates(now)) {
    calendar[date] = (await getEvents({ date, refresh: true })).state
    if (calendar[date] === "unavailable") break
  }
  for (const target of listingTargets(now)) await refreshBroadcasts(target.date, target.sportId).catch(() => undefined)

  const clips = await refreshClips()

  return { feed: { yesterday: yesterday.state, today: today.state, events: events.length, calendar, clips }, ...jobs }
}
