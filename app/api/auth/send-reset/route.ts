import { NextResponse } from "next/server"
import { z } from "zod"
import { apiErrorResponse } from "@/lib/api-auth"
import { actionEmail } from "@/lib/auth-email"
import { getAdminAuth } from "@/lib/firebase-admin"
import { rateLimitClient } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** Always answers the same way, so it cannot be used to discover accounts. */
export async function POST(request: Request) {
  try {
    rateLimitClient(request, "reset", { visitor: 5, shared: 100 }, 900_000)
    const parsed = z.object({ email: z.string().email().max(254) }).safeParse(await request.json().catch(() => null))
    if (parsed.success) {
      try {
        const link = await getAdminAuth()?.generatePasswordResetLink(parsed.data.email)
        if (link) await actionEmail(parsed.data.email, "resetPassword", link)
      } catch {
        /* unknown address: same response */
      }
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
