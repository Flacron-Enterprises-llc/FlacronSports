import { NextResponse } from "next/server"
import { blogService } from "@/lib/blog-service"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const language = searchParams.get("language") || "en"
    const limit = Number.parseInt(searchParams.get("limit") || "10", 10)
    const tag = searchParams.get("tag")
    const team = searchParams.get("team")

    let posts

    if (tag) {
      posts = await blogService.getPostsByTag(tag, language, limit)
    } else if (team) {
      posts = await blogService.getPostsByTeam(team, language, limit)
    } else {
      posts = await blogService.getRecentPosts(language, limit)
    }

    return NextResponse.json({
      success: true,
      data: posts.map(post => ({
        id: post.id,
        title: post.title,
        date: post.publishedAt || null,
      })),
      count: posts.length,
    })
  } catch (error) {
    console.error("Error fetching blog posts:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch blog posts" }, { status: 500 })
  }
}
