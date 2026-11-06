import { NextResponse } from "next/server"
import { z } from "zod"
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api-auth"
import { requireSubscriber } from "@/lib/billing/require-plan"
import { firestoreDocDb } from "@/lib/doc-db"
import { rateLimit } from "@/lib/rate-limit"
import { createShare, sharePath } from "@/lib/share/cards"
import { hasResult } from "@/lib/sports/presentation"
import { getEvent } from "@/lib/sports/service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const body = z.object({ matchId: z.string().min(1).max(40), locale: z.enum(["en", "fr"]), reveal: z.boolean() })

export async function POST(request: Request) {
  try {
    const user = await requireUser(request)
    await requireSubscriber(user.uid)
    rateLimit(`share:${user.uid}`, 20, 60_000)
    const parsed = body.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new ApiError(400, "invalid_request", "Invalid share")
    const event = await getEvent(parsed.data.matchId)
    if (!event) throw new ApiError(404, "not_found", "Match not found")
    const id = await createShare(firestoreDocDb(), event.id, parsed.data.locale, parsed.data.reveal && hasResult(event))
    const origin = process.env.APP_BASE_URL || new URL(request.url).origin
    return NextResponse.json({ url: `${origin}${sharePath(id, parsed.data.locale)}`, image: `/api/share/${id}/card` })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
