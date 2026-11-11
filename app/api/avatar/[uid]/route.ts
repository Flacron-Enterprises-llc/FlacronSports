import { NextResponse } from "next/server"
import { getAdminDb } from "@/lib/firebase-admin"
import { AVATAR_COLLECTION, isUid } from "@/lib/me/avatar"
import { rateLimitClient } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ uid: string }> }

/**
 * A member's profile photo. Public like any avatar, so it renders in <img> tags and
 * the mobile image cache. Addresses carry a version, so they can be cached long.
 */
export async function GET(request: Request, { params }: Params) {
  try {
    rateLimitClient(request, "avatar-read", { visitor: 300, shared: 3000 }, 60_000)
  } catch {
    return new NextResponse(null, { status: 429 })
  }
  const { uid } = await params
  if (!isUid(uid)) return new NextResponse(null, { status: 404 })
  const db = getAdminDb()
  if (!db) return new NextResponse(null, { status: 503 })
  const doc = await db.collection(AVATAR_COLLECTION).doc(uid).get()
  const stored = doc.exists ? doc.data() : null
  if (!stored?.data) return new NextResponse(null, { status: 404, headers: { "Cache-Control": "public, max-age=60" } })
  const bytes: Buffer = Buffer.isBuffer(stored.data) ? stored.data : Buffer.from(stored.data)
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": String(stored.contentType),
      "Content-Length": String(bytes.length),
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  })
}
