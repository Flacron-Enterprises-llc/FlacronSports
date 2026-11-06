import { NextResponse } from "next/server"
import { apiErrorResponse, requireCron, requireFeature } from "@/lib/api-auth"
import { assertJobStorage, runTick } from "@/lib/jobs/tick"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    requireCron(request)
    requireFeature("JOBS_ENABLED")
    assertJobStorage()
    // EventBridge counts anything over 5 seconds as a failure and would retry it, so
    // this acknowledges at once. Only a tick that truly could not start reaches the
    // retry and dead-letter path. job_runs and this log are the record of the outcome.
    void runTick()
      // A skip must not read "Jobs tick": the heartbeat alarm counts that text as work done.
      .then((result) => console.log("skipped" in result ? "Tick skipped" : "Jobs tick", JSON.stringify(result)))
      .catch((error: unknown) => console.error("Tick aborted", error instanceof Error ? error.message : "unknown"))
    return NextResponse.json({ success: true, started: true }, { status: 202 })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
