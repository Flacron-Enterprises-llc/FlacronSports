import { NextResponse } from "next/server"
import { evaluateViewing } from "@/lib/video/viewing"

export const dynamic = "force-dynamic"

// No video provider is licensed yet, so there are no sources to evaluate and the
// endpoint truthfully returns Follow Live with the reason no_licensed_source.
export async function GET(request: Request) {
  const country = request.headers.get("cloudfront-viewer-country")
  const result = evaluateViewing([], { country, platform: "web", entitled: false, now: new Date() })
  return NextResponse.json({ ...result, checkedAt: new Date().toISOString() })
}
