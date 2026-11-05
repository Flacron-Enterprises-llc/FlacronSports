import { NextResponse } from "next/server"
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api-auth"
import { actionEmail } from "@/lib/auth-email"
import { getAdminAuth } from "@/lib/firebase-admin"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const user = await requireUser(request)
    rateLimit(`verify:${user.uid}`, 5, 3_600_000)
    const auth = getAdminAuth()
    if (!auth || !user.email) throw new ApiError(503, "email_unavailable", "Email is unavailable")
    const link = await auth.generateEmailVerificationLink(user.email)
    const sent = await actionEmail(user.email, "verifyEmail", link)
    return NextResponse.json({ sent })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
