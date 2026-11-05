import { NextResponse } from "next/server"
import { listPublishedReports } from "@/lib/content/reports"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** Public: published reports only. */
export async function GET(request: Request) {
  const locale = new URL(request.url).searchParams.get("locale") === "fr" ? "fr" : "en"
  return NextResponse.json(await listPublishedReports(locale))
}
