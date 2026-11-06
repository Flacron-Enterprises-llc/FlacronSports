import { NextResponse } from "next/server"
import { viewingFor } from "@/lib/video/catalog"
import { storedClips } from "@/lib/video/scorebat"

export const dynamic = "force-dynamic"

// The client sends only an id, so it can never choose what gets embedded.
// A match is checked again here, uncached, because a video can be removed after listing.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const clip = params.get("clip")
  if (clip !== null) {
    if (!/^[0-9a-f]{16}$/.test(clip)) return NextResponse.json({ error: "Invalid clip" }, { status: 400 })
    const found = (await storedClips()).find((item) => item.id === clip)
    return NextResponse.json({ video: found ? { embedUrl: found.embedUrl } : null, checkedAt: new Date().toISOString() })
  }
  const match = params.get("match") ?? ""
  if (!/^tsdb-\d{1,12}$/.test(match)) return NextResponse.json({ error: "Invalid match" }, { status: 400 })
  const { video } = await viewingFor(match, request.headers.get("cloudfront-viewer-country"), true)
  return NextResponse.json({
    video: video ? { ...video, embedUrl: `https://www.youtube-nocookie.com/embed/${video.youtubeId}?rel=0&autoplay=1` } : null,
    checkedAt: new Date().toISOString(),
  })
}
