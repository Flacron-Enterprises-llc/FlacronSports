import { NextResponse } from "next/server"
import { z } from "zod"
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api-auth"
import { requireSubscriber } from "@/lib/billing/require-plan"
import { firestoreDocDb } from "@/lib/doc-db"
import { listSavedReports, removeSavedReport, saveReport } from "@/lib/me/saved-reports"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const body = z.object({ slug: z.string().min(1).max(80) })

async function slugOf(request: Request): Promise<string> {
  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) throw new ApiError(400, "invalid_request", "Invalid report")
  return parsed.data.slug
}

export async function GET(request: Request) {
  try {
    const user = await requireUser(request)
    await requireSubscriber(user.uid)
    const locale = new URL(request.url).searchParams.get("locale") === "fr" ? "fr" : "en"
    return NextResponse.json({ reports: await listSavedReports(firestoreDocDb(), user.uid, locale) })
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request)
    await requireSubscriber(user.uid)
    rateLimit(`saved-reports:${user.uid}`, 60, 60_000)
    await saveReport(firestoreDocDb(), user.uid, await slugOf(request))
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser(request)
    await requireSubscriber(user.uid)
    rateLimit(`saved-reports:${user.uid}`, 60, 60_000)
    await removeSavedReport(firestoreDocDb(), user.uid, await slugOf(request))
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
