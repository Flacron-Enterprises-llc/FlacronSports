import { NextResponse } from "next/server"
import { apiErrorResponse, requireUser } from "@/lib/api-auth"
import { requireSubscriber } from "@/lib/billing/require-plan"
import { getPreferences } from "@/lib/me/preferences"
import { rateLimit } from "@/lib/rate-limit"
import { followPriority, isFollowed } from "@/lib/sports/following"
import { byStatusThenTime } from "@/lib/sports/priority"
import { getEvent, getEvents } from "@/lib/sports/service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** One read for the whole board, so every game on it refreshes together. */
export async function GET(request: Request) {
  try {
    const user = await requireUser(request)
    await requireSubscriber(user.uid)
    rateLimit(`board:${user.uid}`, 20, 60_000)
    const prefs = await getPreferences(user.uid)
    const feed = await getEvents()

    // Today's games are already loaded. Only a pin from another day costs a lookup.
    const today = new Map(feed.events.map((event) => [event.id, event]))
    const looked = await Promise.all(prefs.boardPins.map(async (id) => today.get(id) ?? (await getEvent(id).catch(() => null))))
    const pinned = looked.flatMap((event) => event ?? [])
    const favorites = feed.events
      .filter((event) => isFollowed(prefs, event))
      .sort((a, b) => followPriority(prefs, a) - followPriority(prefs, b) || byStatusThenTime(a, b))

    return NextResponse.json({ pinned, favorites, missing: prefs.boardPins.length - pinned.length, state: feed.state, fetchedAt: feed.fetchedAt })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
