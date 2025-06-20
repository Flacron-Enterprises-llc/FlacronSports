import { NextResponse } from "next/server"
import { blogService } from "@/lib/blog-service"

// This endpoint will be called by Vercel Cron Jobs
export async function GET() {
  try {
    // Generate blog post in English
    const blogPost = await blogService.generateAndPublishContent("en")

    if (!blogPost) {
      throw new Error("Failed to generate blog post")
    }

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

    return NextResponse.json({ success: false, error: "Blog generation failed" }, { status: 500 })
  }
}
