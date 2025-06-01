import { NextResponse } from "next/server"
import { emailService } from "@/lib/email-service"

export async function POST(request: Request) {
  try {
    const { email, name } = await request.json()

    if (!email) {
      return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ success: false, error: "Invalid email format" }, { status: 400 })
    }

    // Create subscriber object
    const subscriber = {
      id: `sub_${Date.now()}`,
      email,
      name: name || "",
      subscriptionTier: "free" as const,
      subscribedAt: new Date(),
      preferences: {
        dailyNewsletter: true,
        weeklyDigest: true,
        breakingNews: false,
      },
    }

    // Send welcome email using SendGrid
    await emailService.sendWelcomeEmail(subscriber)

    // Here you would save subscriber to database
    // await saveSubscriber(subscriber)

    return NextResponse.json({
      success: true,
      message: "Successfully subscribed to newsletter! Check your email for confirmation.",
    })
  } catch (error) {
    console.error("Error subscribing user:", error)
    return NextResponse.json({ success: false, error: "Failed to subscribe. Please try again." }, { status: 500 })
  }
}
