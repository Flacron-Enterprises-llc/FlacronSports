import { NextResponse } from "next/server"
import { blogService } from "@/lib/blog-service"

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  try {
    const { slug } = params
    const { searchParams } = new URL(request.url)
    const language = searchParams.get("language") || "en"

    const post = await blogService.getPostBySlug(slug, language)

    if (!post) {
      return NextResponse.json({ success: false, error: "Post not found" }, { status: 404 })
    }

    // Increment view count
    await blogService.incrementViewCount(post.id)

    return NextResponse.json({
      success: true,
      data: post,
    })
  } catch (error) {
    console.error("Error fetching blog post:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch blog post" }, { status: 500 })
  }
}
