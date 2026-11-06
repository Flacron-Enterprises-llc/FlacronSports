import { NextResponse } from "next/server"
import { z } from "zod"
import { readSeen } from "@/lib/admin/operations"
import { ApiError, apiErrorResponse, requireRole } from "@/lib/api-auth"
import { audit } from "@/lib/audit"
import { firestoreDocDb } from "@/lib/doc-db"
import { getAdminDb } from "@/lib/firebase-admin"
import { rateLimit } from "@/lib/rate-limit"
import { COVERAGE_DOC, competitionKey, saveCoverageChange, sportAllowed, type CoverageRules } from "@/lib/sports/coverage"
import { SPORTS, type SportId } from "@/lib/sports/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const SPORT = z.enum(SPORTS.map((sport) => sport.id) as [SportId, ...SportId[]])
const schema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("sport"), sportId: SPORT, enabled: z.boolean(), reason: z.string().trim().min(3).max(500) }),
  z.object({ type: z.literal("competition"), sportId: SPORT, name: z.string().min(1).max(200), enabled: z.boolean().optional(), video: z.boolean().optional(), reason: z.string().trim().min(3).max(500) }),
])

export async function GET(request: Request) {
  try {
    await requireRole(request, "admin")
    const db = getAdminDb()
    if (!db) throw new ApiError(503, "storage_unavailable", "This service is temporarily unavailable")
    // Read straight from storage: this screen must show what was just saved, not a cached copy.
    const [seen, stored] = await Promise.all([readSeen(db), firestoreDocDb().get<Partial<CoverageRules>>(COVERAGE_DOC)])
    const rules: CoverageRules = { sports: stored?.sports ?? {}, competitions: stored?.competitions ?? {} }

    return NextResponse.json({
      sports: SPORTS.filter((sport) => sport.enabled).map((sport) => {
        const rows = Object.values(seen[sport.id] ?? {})
        return {
          id: sport.id,
          enabled: sportAllowed(rules, sport.id),
          lastSeenAt: rows.map((row) => row.lastSeenAt).sort().at(-1) ?? null,
          competitions: rows
            .map((row) => {
              const rule = rules.competitions[competitionKey(sport.id, row.name)]
              return { ...row, enabled: rule?.enabled !== false, video: rule?.video !== false }
            })
            .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt) || a.name.localeCompare(b.name)),
        }
      }),
    })
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRole(request, "admin")
    rateLimit(`admin-coverage:${user.uid}`, 30, 60_000)
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new ApiError(400, "invalid_request", "A valid change and reason are required")

    const { reason, ...change } = parsed.data
    await saveCoverageChange(firestoreDocDb(), change, user.uid, new Date())
    await audit("coverage.changed", user.uid, {
      type: change.type,
      sportId: change.sportId,
      competition: change.type === "competition" ? change.name : null,
      enabled: change.enabled ?? null,
      video: change.type === "competition" ? (change.video ?? null) : null,
      reason,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
