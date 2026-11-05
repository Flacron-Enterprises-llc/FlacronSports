import { NextResponse } from "next/server"
import { z } from "zod"
import { ApiError, apiErrorResponse, requireUser, requireVerifiedUser } from "@/lib/api-auth"
import { readAssistantBalance } from "@/lib/billing/allowance"
import { activeDayPass } from "@/lib/billing/addons"
import { getSubscriptionAccess, getUserPurchases } from "@/lib/billing/firestore-store"
import { PLANS } from "@/lib/billing/plans"
import { askAssistant } from "@/lib/assistant/service"
import { firestoreDocDb } from "@/lib/doc-db"
import { rateLimit } from "@/lib/rate-limit"
import { getEvents, getTeamFixtures } from "@/lib/sports/service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const askSchema = z.object({
  question: z.string().trim().min(2).max(300),
  locale: z.enum(["en", "fr"]).default("en"),
})

export async function GET(request: Request) {
  try {
    const user = await requireUser(request)
    const now = new Date()
    const access = await getSubscriptionAccess(user.uid)
    const limit = PLANS[access.plan].assistantRequestsPerMonth
    const [balance, purchases] = await Promise.all([readAssistantBalance(firestoreDocDb(), user.uid, limit, now), getUserPurchases(user.uid)])
    return NextResponse.json({
      balance,
      plan: access.plan,
      dayPassExpiresAtUTC: activeDayPass(purchases, now.getTime())?.expiresAtUTC ?? null,
    })
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser(request)
    rateLimit(`assistant:${user.uid}`, 20, 60_000)
    const parsed = askSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new ApiError(400, "invalid_request", "Ask a question of up to 300 characters")

    // The subscription sets the plan allowance: a day pass adds its own 10 credits
    // rather than lifting the account to Premium's monthly 300.
    const access = await getSubscriptionAccess(user.uid)
    const result = await askAssistant({
      db: firestoreDocDb(),
      uid: user.uid,
      includedLimit: PLANS[access.plan].assistantRequestsPerMonth,
      question: parsed.data.question,
      locale: parsed.data.locale,
      sources: { getEvents, getTeamFixtures },
      now: new Date(),
    })
    return NextResponse.json(result)
  } catch (error) {
    return apiErrorResponse(error)
  }
}
