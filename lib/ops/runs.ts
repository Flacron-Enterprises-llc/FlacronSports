// One small document per job run, for the Operations screen. Scheduled runs reuse
// a fixed set of ids, so this collection holds about a week and never grows.

import type { Firestore } from "firebase-admin/firestore"

export const JOB_RUNS = "job_runs"
const TICK_MS = 15 * 60_000
const SCHEDULED_SLOTS = 672
const ADMIN_SLOTS = 200

export interface JobRun {
  at: string
  finishedAt: string
  trigger: "schedule" | "admin"
  job: string
  actorUid: string | null
  /** Names of the jobs that failed, empty on a clean run. */
  failed: string[]
  aborted: boolean
  results: Record<string, unknown>
}

export function runId(trigger: JobRun["trigger"], at: Date): string {
  const slot = trigger === "schedule" ? Math.floor(at.getTime() / TICK_MS) % SCHEDULED_SLOTS : Math.floor(at.getTime() / 60_000) % ADMIN_SLOTS
  return `${trigger}-${slot}`
}

export function failedJobs(results: Record<string, unknown>): string[] {
  return Object.entries(results).flatMap(([name, value]) => ((value as { failed?: boolean } | null)?.failed === true ? [name] : []))
}

/** Bookkeeping must never fail the job it describes. JSON drops the undefined values Firestore refuses. */
export async function recordRun(db: Firestore, run: JobRun): Promise<void> {
  await db.collection(JOB_RUNS).doc(runId(run.trigger, new Date(run.at))).set(JSON.parse(JSON.stringify(run))).catch((error: unknown) => {
    console.error("Job run not stored", error instanceof Error ? error.message : "unknown")
  })
}
