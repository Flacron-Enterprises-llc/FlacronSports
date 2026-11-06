import { NextResponse } from "next/server"
import { z } from "zod"
import { apiErrorResponse } from "@/lib/api-auth"
import { rateLimitClient } from "@/lib/rate-limit"
import { getEvents } from "@/lib/sports/service"
import { SPORTS, type EventStatus, type SportId } from "@/lib/sports/types"

// Each new day is a provider call and a stored snapshot per sport, so the days a visitor
// can name are bounded. The scheduled job keeps a week either side of today.
const DATE_WINDOW_DAYS = 30
const DAY_MS = 86_400_000

function inDateWindow(date: string): boolean {
  const day = Date.parse(`${date}T00:00:00Z`)
  return Number.isFinite(day) && Math.abs(day - Date.now()) <= (DATE_WINDOW_DAYS + 1) * DAY_MS
}

const query = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(inDateWindow).optional(),
  sport: z.enum(SPORTS.map((sport) => sport.id) as [SportId, ...SportId[]]).optional(),
  status: z.enum(["live", "scheduled", "finished"]).optional(),
  competition: z.string().max(120).optional(),
  team: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(3000).default(50),
})

export async function GET(request: Request) {
  try {
    rateLimitClient(request, "feed", { visitor: 240, shared: 3000 }, 60_000)
  } catch (error) {
    return apiErrorResponse(error)
  }
  const parsed = query.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!parsed.success) return NextResponse.json({ error: "Invalid filters" }, { status: 400 })

  const { date, sport, status, competition, team, page, pageSize } = parsed.data
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
