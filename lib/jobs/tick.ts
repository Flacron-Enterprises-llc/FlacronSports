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
import { getEvent, getEvents, utcDate } from "@/lib/sports/service"
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

export async function runTick(now: Date = new Date()) {
  const db = getAdminDb()
  if (!db) throw new ApiError(503, "storage_unavailable", "Storage is not available")

  // Yesterday too: a late kickoff finishes after midnight UTC, under the previous date.
  const [yesterday, today] = await Promise.all([getEvents({ date: utcDate(new Date(now.getTime() - DAY)) }), getEvents({ date: utcDate(now) })])
  const seen = new Set<string>()
  const events: SportEvent[] = [...yesterday.events, ...today.events].filter((event) => !seen.has(event.id) && seen.add(event.id))
  const siteUrl = process.env.APP_BASE_URL || "https://flacronsport.com"

  const jobs = await runIsolated({
    reports: () => runReports(db, events, today.fetchedAt, now),
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

  return { feed: { yesterday: yesterday.state, today: today.state, events: events.length }, ...jobs }
}
