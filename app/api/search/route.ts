import { NextResponse } from "next/server"
import { z } from "zod"
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api-auth"
import { requireDataAccess } from "@/lib/billing/require-plan"
import { rateLimit } from "@/lib/rate-limit"
import { globalSearch } from "@/lib/search/global"
import { SPORTS, type SportId } from "@/lib/sports/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const query = z.object({
  q: z.string().max(80).default(""),
  locale: z.enum(["en", "fr"]).default("en"),
  sport: z.enum(SPORTS.map((sport) => sport.id) as [SportId, ...SportId[]]).optional(),
})

export async function GET(request: Request) {
  try {
    const user = await requireUser(request)
    await requireDataAccess(user)
    rateLimit(`search:${user.uid}`, 30, 60_000)
    const parsed = query.safeParse(Object.fromEntries(new URL(request.url).searchParams))
    if (!parsed.success) throw new ApiError(400, "invalid_request", "Invalid search")
    return NextResponse.json(await globalSearch(parsed.data.q, parsed.data.locale, parsed.data.sport))
  } catch (error) {
    return apiErrorResponse(error)
  }
}
