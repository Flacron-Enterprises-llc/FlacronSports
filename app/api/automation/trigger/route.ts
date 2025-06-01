import { NextResponse } from "next/server"
import { automationService } from "@/lib/automation"

export async function POST(request: Request) {
  try {
    const { jobId } = await request.json()

    if (!jobId) {
      return NextResponse.json({ success: false, error: "Job ID is required" }, { status: 400 })
    }

    await automationService.triggerJob(jobId)

    return NextResponse.json({
      success: true,
      message: `Job ${jobId} triggered successfully`,
    })
  } catch (error) {
    console.error("Error triggering automation job:", error)
    return NextResponse.json({ success: false, error: "Failed to trigger job" }, { status: 500 })
  }
}
