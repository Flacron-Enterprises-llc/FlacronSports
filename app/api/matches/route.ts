import { NextResponse } from "next/server"
import { z } from "zod"
import { apiErrorResponse } from "@/lib/api-auth"
import { requireMember } from "@/lib/billing/require-plan"
import { LEAGUE_COLLECTED, WINDOW_FUTURE_DAYS } from "@/lib/sports/collect"
import { getEvents } from "@/lib/sports/service"
import { SPORTS, type EventStatus, type SportId } from "@/lib/sports/types"

// Each new day is a provider call and a stored snapshot per sport, so the days a visitor
// can name are bounded. The scheduled job keeps a week either side of today.
const DATE_WINDOW_DAYS = 30
const DAY_MS = 86_400_000

/** Further ahead, a sport filed by league reads only what is stored, so it costs no call. */
function inDateWindow(date: string, sport?: SportId): boolean {
  const day = Date.parse(`${date}T00:00:00Z`)
  if (!Number.isFinite(day)) return false
  if (sport && LEAGUE_COLLECTED.has(sport) && day > Date.now() && day - Date.now() <= WINDOW_FUTURE_DAYS * DAY_MS) return true
  return Math.abs(day - Date.now()) <= (DATE_WINDOW_DAYS + 1) * DAY_MS
}

const query = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sport: z.enum(SPORTS.map((sport) => sport.id) as [SportId, ...SportId[]]).optional(),
  status: z.enum(["live", "scheduled", "finished"]).optional(),
  competition: z.string().max(120).optional(),
  team: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(3000).default(50),
})

export async function GET(request: Request) {
  try {
    await requireMember(request, "feed", 240)
  } catch (error) {
    return apiErrorResponse(error)
  }
  const parsed = query.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!parsed.success) return NextResponse.json({ error: "Invalid filters" }, { status: 400 })

  const { date, sport, status, competition, team, page, pageSize } = parsed.data
  if (date && !inDateWindow(date, sport)) return NextResponse.json({ error: "Invalid filters" }, { status: 400 })
  const feed = await getEvents({ date, sport })

  const filtered = feed.events.filter((event) => {
    if (status && event.status !== (status as EventStatus)) return false
    if (competition && event.competition.name !== competition) return false
    if (team && !event.participants.some((participant) => participant.name === team)) return false
    return true
  })

  return NextResponse.json({
    ...feed,
    events: filtered.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    total: filtered.length,
  })
}
