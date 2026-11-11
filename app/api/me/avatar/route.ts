import { NextResponse } from "next/server"
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api-auth"
import { audit } from "@/lib/audit"
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin"
import { AVATAR_COLLECTION, avatarUrl, parseAvatarUpload } from "@/lib/me/avatar"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function base(request: Request): string {
  return process.env.APP_BASE_URL || new URL(request.url).origin
}

function stores() {
  const db = getAdminDb()
  const auth = getAdminAuth()
  if (!db || !auth) throw new ApiError(503, "storage_unavailable", "Profile photos are temporarily unavailable")
  return { db, auth }
}

/** The member's photo address, or null. */
export async function GET(request: Request) {
  try {
    const user = await requireUser(request)
    const { auth } = stores()
    const record = await auth.getUser(user.uid)
    return NextResponse.json({ photoURL: record.photoURL ?? null })
  } catch (error) {
    return apiErrorResponse(error)
  }
}

/**
 * Sets the profile photo for the web and the mobile app. The image is kept in
 * Firestore (it is at most 400 KB) and served by /api/avatar/{uid}; the Firebase
 * profile's photoURL points there so every client reads the same field.
 */
export async function PUT(request: Request) {
  try {
    const user = await requireUser(request)
    rateLimit(`avatar:${user.uid}`, 10, 60 * 60_000)
    const { db, auth } = stores()
    const { data, contentType } = parseAvatarUpload(await request.json().catch(() => null))
    const now = Date.now()
    await db.collection(AVATAR_COLLECTION).doc(user.uid).set({
      uid: user.uid,
      contentType,
      data,
      bytes: data.length,
      updatedAtUTC: new Date(now).toISOString(),
    })
    const photoURL = avatarUrl(base(request), user.uid, now)
    await auth.updateUser(user.uid, { photoURL })
    await audit("account.avatar_updated", user.uid)
    return NextResponse.json({ photoURL })
  } catch (error) {
    return apiErrorResponse(error)
  }
}

/** Removes the photo. A Google account's own photo is not restored. */
export async function DELETE(request: Request) {
  try {
    const user = await requireUser(request)
    rateLimit(`avatar:${user.uid}`, 10, 60 * 60_000)
    const { db, auth } = stores()
    await db.collection(AVATAR_COLLECTION).doc(user.uid).delete()
    await auth.updateUser(user.uid, { photoURL: null })
    await audit("account.avatar_removed", user.uid)
    return NextResponse.json({ photoURL: null })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
