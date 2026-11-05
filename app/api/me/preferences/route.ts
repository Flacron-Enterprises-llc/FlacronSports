import { NextResponse } from "next/server"
import { apiErrorResponse, requireUser } from "@/lib/api-auth"
import { getPreferences, updatePreferences } from "@/lib/me/preferences"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const user = await requireUser(request)
    return NextResponse.json(await getPreferences(user.uid))
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser(request)
    rateLimit(`prefs:${user.uid}`, 60, 60_000)
    return NextResponse.json(await updatePreferences(user.uid, await request.json().catch(() => null)))
  } catch (error) {
    return apiErrorResponse(error)
  }
}
