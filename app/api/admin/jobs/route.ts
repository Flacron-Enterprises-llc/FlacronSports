import { NextResponse } from "next/server"
import { z } from "zod"
import { ApiError, apiErrorResponse, requireFeature, requireRole } from "@/lib/api-auth"
import { audit } from "@/lib/audit"
import { JOB_NAMES, startJob, type JobName } from "@/lib/jobs/tick"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const schema = z.object({ job: z.enum(JOB_NAMES as [JobName, ...JobName[]]), reason: z.string().trim().min(3).max(500) })

/** Starts one job and answers at once. Its outcome appears on the Operations screen. */
export async function POST(request: Request) {
  try {
    const user = await requireRole(request, "admin")
    rateLimit(`admin-jobs:${user.uid}`, 6, 60_000)
    requireFeature("JOBS_ENABLED")
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new ApiError(400, "invalid_request", "Choose a job and give a reason")

    const { job, reason } = parsed.data
    startJob(job, user.uid)
    await audit("job.rerun", user.uid, { job, reason })
    return NextResponse.json({ success: true, started: true }, { status: 202 })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
