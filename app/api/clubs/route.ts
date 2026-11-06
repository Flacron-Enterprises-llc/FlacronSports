import { NextResponse } from "next/server"
import { z } from "zod"
import { ApiError, apiErrorResponse, requireFeature, requireUser, requireVerifiedUser } from "@/lib/api-auth"
import { requireSubscriber } from "@/lib/billing/require-plan"
import { refreshBadgesQuietly } from "@/lib/community/badges"
import { joinClub, listClubs, sportClub, type ClubIdentity } from "@/lib/community/clubs"
import { displayNameOf } from "@/lib/community/content"
import { firestoreDocDb } from "@/lib/doc-db"
import { getPreferences } from "@/lib/me/preferences"
import { rateLimit } from "@/lib/rate-limit"
import { getTeamFixtures } from "@/lib/sports/service"
import { SPORTS } from "@/lib/sports/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("sport"), sportId: z.string().max(40) }),
  z.object({ kind: z.literal("team"), team: z.string().trim().min(1).max(120) }),
])

/** A club can only exist for a sport we cover or a team the feed really knows. */
async function identify(input: z.infer<typeof schema>): Promise<ClubIdentity> {
  if (input.kind === "sport") {
    const sport = SPORTS.find((candidate) => candidate.enabled && candidate.id === input.sportId)
    if (!sport) throw new ApiError(404, "not_found", "Not found")
    return sportClub(sport.id, sport.name.en)
  }
  const { team, feed } = await getTeamFixtures(input.team)
  if (feed.state === "unavailable") throw new ApiError(503, "feed_unavailable", "Team data is temporarily unavailable")
  if (!team) throw new ApiError(404, "team_not_found", "We could not find this team")
  return { kind: "team", sportId: team.sportId, name: team.name, key: team.id }
}

export async function GET(request: Request) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireUser(request)
    await requireSubscriber(user.uid)
    rateLimit(`clubs-read:${user.uid}`, 60, 60_000)
    const { favorites, locale } = await getPreferences(user.uid)
    return NextResponse.json(await listClubs(firestoreDocDb(), { uid: user.uid, locale, favorites }))
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    requireFeature("COMMUNITY_ENABLED")
    const user = await requireVerifiedUser(request)
    await requireSubscriber(user.uid)
    rateLimit(`clubs:${user.uid}`, 10, 60_000)
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new ApiError(400, "invalid_request", "Invalid club")
    const db = firestoreDocDb()
    const now = new Date()
    const joined = await joinClub(db, { uid: user.uid, displayName: displayNameOf(user.token), club: await identify(parsed.data) }, now)
    await refreshBadgesQuietly(db, user.uid, now)
    return NextResponse.json(joined, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
