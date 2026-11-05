import { NextResponse } from "next/server"
import { apiErrorResponse, requireCron, requireFeature } from "@/lib/api-auth"
import { runTick } from "@/lib/jobs/tick"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    requireCron(request)
    requireFeature("JOBS_ENABLED")
    const result = await runTick()
    // EventBridge drops the connection at 5 seconds, so the log is the durable record.
    console.log("Jobs tick", JSON.stringify(result))
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
