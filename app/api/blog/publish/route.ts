import { NextResponse } from "next/server"
import { blogService } from "@/lib/blog-service"

export async function POST(request: Request) {
  try {
    const { language = "en" } = await request.json()

    const blogPost = await blogService.generateAndPublishContent(language)

    if (!blogPost) {
      return NextResponse.json({ success: false, error: "Failed to generate blog post" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: blogPost,
      message: "Blog post published successfully",
    })
  } catch (error) {
    console.error("Error publishing blog post:", error)
    return NextResponse.json({ success: false, error: "Failed to publish blog post" }, { status: 500 })
  }
}
