import { ApiError, featureOn } from "@/lib/api-auth"
import { BILLING_COLLECTIONS } from "@/lib/billing/firestore-store"
import { APP_ID } from "@/lib/billing/plans"
import { getAdminDb } from "@/lib/firebase-admin"
import { OPS_DAILY, pendingMetrics } from "@/lib/ops/metrics"
import { JOB_RUNS, type JobRun } from "@/lib/ops/runs"
import { COVERAGE_SEEN, type SeenCompetition } from "@/lib/sports/coverage"
import { getEvents, providerStatus } from "@/lib/sports/service"
import { SPORTS, type SportId } from "@/lib/sports/types"

const RUNS_SHOWN = 40
const DAYS_SHOWN = 7
const STALE_SPORT_MS = 48 * 3_600_000
// Three scheduled runs missed.
const STALE_RUN_MS = 46 * 60_000

export interface DailyCounters {
  date: string
  counters: Record<string, number>
}

/** A sport with no games in season also shows here, so the screen says "no data seen", not "failed". */
export function staleSports(seen: Partial<Record<SportId, Record<string, SeenCompetition>>>, now: number): { sportId: SportId; lastSeenAt: string | null }[] {
  return SPORTS.filter((sport) => sport.enabled).flatMap((sport) => {
    const newest = Object.values(seen[sport.id] ?? {}).map((row) => row.lastSeenAt).sort().at(-1) ?? null
    return newest && now - Date.parse(newest) < STALE_SPORT_MS ? [] : [{ sportId: sport.id, lastSeenAt: newest }]
  })
}

export async function readSeen(db: NonNullable<ReturnType<typeof getAdminDb>>) {
  const docs = await db.collection(COVERAGE_SEEN).get()
  return Object.fromEntries(docs.docs.map((doc) => [doc.id, (doc.data() as { competitions?: Record<string, SeenCompetition> }).competitions ?? {}])) as Partial<Record<SportId, Record<string, SeenCompetition>>>
}

async function subscriptionHealth(db: NonNullable<ReturnType<typeof getAdminDb>>) {
  const entitlements = db.collection(BILLING_COLLECTIONS.entitlements).where("application_id", "==", APP_ID)
  const count = (status: string) => entitlements.where("status", "==", status).count().get().then((result) => result.data().count)
  const [active, pastDue, canceled, quarantined, needReview] = await Promise.all([
    count("active"), count("past_due"), count("canceled"),
    db.collection(BILLING_COLLECTIONS.quarantine).count().get().then((result) => result.data().count),
    db.collection(BILLING_COLLECTIONS.purchases).where("supportReview", "==", true).count().get().then((result) => result.data().count),
  ])
  return { active, pastDue, canceled, quarantined, needReview }
}

export async function operationsSummary(now: Date = new Date()) {
  const db = getAdminDb()
  if (!db) throw new ApiError(503, "storage_unavailable", "This service is temporarily unavailable")

  const [feed, runs, days, seen, subscriptions] = await Promise.all([
    getEvents(),
    db.collection(JOB_RUNS).orderBy("at", "desc").limit(RUNS_SHOWN).get().then((found) => found.docs.map((doc) => doc.data() as JobRun)),
    db.collection(OPS_DAILY).orderBy("date", "desc").limit(DAYS_SHOWN).get().then((found) => found.docs.map((doc) => doc.data() as DailyCounters)),
    readSeen(db),
    subscriptionHealth(db).catch(() => null),
  ])

  const lastScheduled = runs.find((run) => run.trigger === "schedule" && !run.skipped) ?? null
  return {
    feed: { state: feed.state, source: feed.source, fetchedAt: feed.fetchedAt, limited: feed.limited, events: feed.events.length },
    jobs: {
      enabled: process.env.JOBS_ENABLED === "true",
      lastRunAt: lastScheduled?.at ?? null,
      overdue: !lastScheduled || now.getTime() - Date.parse(lastScheduled.at) > STALE_RUN_MS,
    },
    flags: { video: featureOn("FEATURE_VIDEO"), publishing: featureOn("FEATURE_GENERATED_PUBLISHING"), payments: featureOn("FEATURE_PAYMENTS") },
    // The live answer from the task serving this request, and the last job's sports states.
    providers: providerStatus(),
    sports: (lastScheduled?.results.sports ?? {}) as Partial<Record<SportId, string>>,
    staleSports: staleSports(seen, now.getTime()),
    runs: runs.map(({ at, finishedAt, trigger, job, failed, aborted, skipped }) => ({ at, finishedAt, trigger, job, failed, aborted, skipped: Boolean(skipped) })),
    days,
    unflushed: pendingMetrics(),
    subscriptions,
  }
}
