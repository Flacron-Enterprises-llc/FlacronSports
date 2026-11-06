import { NextResponse } from "next/server"
import { viewingFor } from "@/lib/video/catalog"

export const dynamic = "force-dynamic"

// The country comes from the network, never from a profile preference.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await viewingFor(id, request.headers.get("cloudfront-viewer-country"))
  return NextResponse.json({ ...result, checkedAt: new Date().toISOString() })
}
