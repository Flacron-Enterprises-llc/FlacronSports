import { NextResponse } from "next/server"
import { automationService } from "@/lib/automation"

// This endpoint will be called by Vercel Cron Jobs
export async function GET() {
  try {
    await automationService.executeDailyContentGeneration()

    return NextResponse.json({
      success: true,
      message: "Daily content generation completed",
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Cron job error:", error)
    return NextResponse.json({ success: false, error: "Daily content generation failed" }, { status: 500 })
  }
}
