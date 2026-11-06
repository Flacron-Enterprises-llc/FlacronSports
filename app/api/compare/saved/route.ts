import { NextResponse } from "next/server"
import { z } from "zod"
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api-auth"
import { getEffectiveAccess } from "@/lib/billing/firestore-store"
import { getAdminDb } from "@/lib/firebase-admin"
import { rateLimit } from "@/lib/rate-limit"
import { SPORTS, type SportId } from "@/lib/sports/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const COLLECTION = "compare_views"
const MAX_VIEWS = 20

const view = z.object({
  first: z.string().trim().min(1).max(120),
  second: z.string().trim().min(1).max(120),
  sport: z.enum(SPORTS.map((sport) => sport.id) as [SportId, ...SportId[]]).nullable(),
})

function storage() {
  const db = getAdminDb()
  if (!db) throw new ApiError(503, "storage_unavailable", "Saved views are temporarily unavailable")
  return db.collection(COLLECTION)
}

const mine = (uid: string) => storage().where("uid", "==", uid).limit(MAX_VIEWS + 1).get()

/** Saved views stay readable after a downgrade. Only adding one needs Premium. */
export async function GET(request: Request) {
  try {
    const user = await requireUser(request)
    const snapshot = await mine(user.uid)
    const views = snapshot.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as { first: string; second: string; sport: SportId | null; createdAt: string }) }))
      .map(({ id, first, second, sport, createdAt }) => ({ id, first, second, sport, createdAt }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return NextResponse.json({ views })
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request)
    const { plan } = await getEffectiveAccess(user.uid)
    if (plan !== "premium") throw new ApiError(403, "plan_required", "Saved views need the Premium plan")
    rateLimit(`compare-save:${user.uid}`, 10, 60_000)
    const parsed = view.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new ApiError(400, "invalid_request", "Invalid view")
    const existing = await mine(user.uid)
    if (existing.size >= MAX_VIEWS) throw new ApiError(409, "views_limit", "You have reached the saved view limit")
    const createdAt = new Date().toISOString()
    const ref = await storage().add({ ...parsed.data, uid: user.uid, createdAt })
    return NextResponse.json({ id: ref.id, ...parsed.data, createdAt })
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser(request)
    const id = new URL(request.url).searchParams.get("id") ?? ""
    if (!/^[A-Za-z0-9]{1,40}$/.test(id)) throw new ApiError(400, "invalid_request", "Invalid view")
    const ref = storage().doc(id)
    const doc = await ref.get()
    if (doc.exists && doc.data()?.uid === user.uid) await ref.delete()
    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
