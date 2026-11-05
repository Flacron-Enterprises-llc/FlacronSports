import { NextResponse } from "next/server"
import { getPublishedReport } from "@/lib/content/reports"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const locale = new URL(request.url).searchParams.get("locale") === "fr" ? "fr" : "en"
  const report = await getPublishedReport((await params).id, locale).catch(() => null)
  return report ? NextResponse.json({ report }) : NextResponse.json({ report: null }, { status: 404 })
}
