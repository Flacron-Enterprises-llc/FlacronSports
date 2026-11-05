import { NextResponse } from "next/server"
import { apiErrorResponse, requireUser } from "@/lib/api-auth"
import { getEffectiveAccess } from "@/lib/billing/firestore-store"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const user = await requireUser(request)
    const access = await getEffectiveAccess(user.uid)
    return NextResponse.json({ ...access, isPaid: access.plan !== "free" })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
