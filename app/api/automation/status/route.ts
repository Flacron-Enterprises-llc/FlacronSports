import { NextResponse } from "next/server"
import { automationService } from "@/lib/automation"

export async function GET() {
  try {
    const status = automationService.getAutomationStatus()

    return NextResponse.json({
      success: true,
      data: status,
    })
  } catch (error) {
    console.error("Error getting automation status:", error)
    return NextResponse.json({ success: false, error: "Failed to get automation status" }, { status: 500 })
  }
}
