import { NextResponse } from "next/server"
import { userMessageRecords } from "@/lib/alerts/notifications"
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api-auth"
import { getEffectiveAccess } from "@/lib/billing/firestore-store"
import { getAdminDb } from "@/lib/firebase-admin"
import { getPreferences } from "@/lib/me/preferences"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const user = await requireUser(request)
    rateLimit(`export:${user.uid}`, 5, 3_600_000)
    const db = getAdminDb()
    if (!db) throw new ApiError(503, "storage_unavailable", "Export is temporarily unavailable")

    const payments = await db.collection("billing_payments").where("uid", "==", user.uid).get()
    const { alerts, sends } = await userMessageRecords(db, user.uid)
    const purchases = await db.collection("billing_purchases").where("uid", "==", user.uid).get()
    const predictions = await db.collection("predictions").where("uid", "==", user.uid).get()
    const body = {
      exportedAt: new Date().toISOString(),
      account: { uid: user.uid, email: user.email },
      preferences: await getPreferences(user.uid),
      plan: await getEffectiveAccess(user.uid),
      payments: payments.docs.map((doc) => doc.data()),
      notifications: alerts.map((doc) => doc.data()),
      purchases: purchases.docs.map((doc) => doc.data()),
      predictions: predictions.docs.map((doc) => doc.data()),
      newsletterSends: sends.map((doc) => doc.data()),
    }
    return new NextResponse(JSON.stringify(body, null, 2), {
      headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="flacronsport-data.json"' },
    })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
