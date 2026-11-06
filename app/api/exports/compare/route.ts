import { NextResponse } from "next/server"
import { z } from "zod"
import { ApiError, apiErrorResponse, requireVerifiedUser } from "@/lib/api-auth"
import { comparisonTier, requireSubscriber } from "@/lib/billing/require-plan"
import { firestoreDocDb } from "@/lib/doc-db"
import { exportComparison, renderComparisonPdf } from "@/lib/exports/service"
import { getDictionary } from "@/lib/i18n"
import { rateLimit } from "@/lib/rate-limit"
import { comparePlayers, compareTeams, PlayerNotFound, TeamNotFound } from "@/lib/sports/compare"
import { playerSheet, teamSheet } from "@/lib/sports/compare-rows"
import { isPlayerId } from "@/lib/sports/player"
import { SPORTS, type SportId } from "@/lib/sports/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const locale = z.enum(["en", "fr"]).default("en")
const body = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("teams"),
    first: z.string().trim().min(1).max(120),
    second: z.string().trim().min(1).max(120),
    sport: z.enum(SPORTS.map((sport) => sport.id) as [SportId, ...SportId[]]).optional(),
    locale,
  }),
  z.object({ mode: z.literal("players"), first: z.string().refine(isPlayerId), second: z.string().refine(isPlayerId), locale }),
])

/** Rebuilt here from the same gates as the screen, so a file never holds more than the plan does. */
export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser(request)
    rateLimit(`pdf-export:${user.uid}`, 10, 60_000)
    await requireSubscriber(user.uid)
    const tier = await comparisonTier(user.uid)
    const parsed = body.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new ApiError(400, "invalid_request", "Invalid comparison")
    const input = parsed.data
    const t = getDictionary(input.locale)
    const load = async () =>
      input.mode === "players"
        ? playerSheet(await comparePlayers(input.first, input.second, tier), t, input.locale)
        : teamSheet(await compareTeams(input.first, input.second, input.sport, tier), t)

    const pdf = await exportComparison(firestoreDocDb(), { uid: user.uid, load, render: renderComparisonPdf }, new Date())
    return new NextResponse(Buffer.from(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="flacronsport-comparison.pdf"` },
    })
  } catch (error) {
    if (error instanceof TeamNotFound || error instanceof PlayerNotFound) return NextResponse.json({ error: "not_found", code: "not_found" }, { status: 404 })
    return apiErrorResponse(error)
  }
}
