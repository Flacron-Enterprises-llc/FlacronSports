import { NextResponse } from "next/server"
import { apiErrorResponse, ApiError } from "@/lib/api-auth"
import { firestoreDocDb } from "@/lib/doc-db"
import { rateLimitClient } from "@/lib/rate-limit"
import { readShare, shareCard } from "@/lib/share/cards"
import { getEvent } from "@/lib/sports/service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** Public, because a shared link is opened by people with no account. It states only what the card states. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    rateLimitClient(request, "share-read", { visitor: 120, shared: 1500 }, 60_000)
    const share = await readShare(firestoreDocDb(), (await params).id)
    const event = share ? await getEvent(share.matchId) : null
    if (!share || !event) throw new ApiError(404, "not_found", "Card not found")
    return NextResponse.json({ card: shareCard(event, share) })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
