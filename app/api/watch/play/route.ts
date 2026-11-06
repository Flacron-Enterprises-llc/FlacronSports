import { NextResponse } from "next/server"
import { viewingFor } from "@/lib/video/catalog"

export const dynamic = "force-dynamic"

// Checked again here, uncached, because a video can be removed after it was listed.
// The client sends only a match id, so it can never choose what gets embedded.
export async function GET(request: Request) {
  const match = new URL(request.url).searchParams.get("match") ?? ""
  if (!/^tsdb-\d{1,12}$/.test(match)) return NextResponse.json({ error: "Invalid match" }, { status: 400 })
  const { video } = await viewingFor(match, request.headers.get("cloudfront-viewer-country"), true)
  return NextResponse.json({ video, checkedAt: new Date().toISOString() })
}
