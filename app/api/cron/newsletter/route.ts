import { NextResponse } from "next/server"
import { automationService } from "@/lib/automation"

// This endpoint will be called by Vercel Cron Jobs
export async function GET() {
  try {
    await automationService.executeNewsletterSending()

    return NextResponse.json({
      success: true,
      message: "Newsletter sending completed",
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Cron job error:", error)
    return NextResponse.json({ success: false, error: "Newsletter sending failed" }, { status: 500 })
  }
}
