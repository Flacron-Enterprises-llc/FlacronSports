import { NextResponse } from "next/server"
import { blogService } from "@/lib/blog-service"
import { logAutomationRun } from "@/lib/firebase-config"

// This endpoint will be called by Vercel Cron Jobs
export async function GET() {
  try {
    // Generate blog post in English
    const blogPost = await blogService.generateAndPublishContent("en")

    if (!blogPost) {
      throw new Error("Failed to generate blog post")
    }

    // Log successful run
    await logAutomationRun("daily-blog-generation", "success", {
      postId: blogPost.id,
      title: blogPost.title,
    })

    return NextResponse.json({
      success: true,
      message: "Blog post generated and published successfully",
      data: {
        postId: blogPost.id,
        title: blogPost.title,
        slug: blogPost.slug,
      },
    })
  } catch (error) {
    console.error("Cron job error:", error)

    // Log error
    await logAutomationRun("daily-blog-generation", "error", {
      error: error instanceof Error ? error.message : "Unknown error",
    })

    return NextResponse.json({ success: false, error: "Blog generation failed" }, { status: 500 })
  }
}
