import { NextResponse } from "next/server"
import { userMessageRecords } from "@/lib/alerts/notifications"
import { ApiError, apiErrorResponse, requireUser } from "@/lib/api-auth"
import { audit } from "@/lib/audit"
import { getEntitlementRecord } from "@/lib/billing/firestore-store"
import { getStripe } from "@/lib/billing/stripe-client"
import { eraseCommunityData } from "@/lib/community/account"
import { firestoreDocDb } from "@/lib/doc-db"
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** Deletes the account. Payment and enforcement records stay, as the Privacy Policy retention section allows. */
export async function DELETE(request: Request) {
  try {
    const user = await requireUser(request)
    const db = getAdminDb()
    const auth = getAdminAuth()
    if (!db || !auth) throw new ApiError(503, "storage_unavailable", "Deletion is temporarily unavailable")

    const record = await getEntitlementRecord(user.uid)
    if (record && ["active", "trialing", "past_due"].includes(record.status)) {
      await getStripe().subscriptions.cancel(record.stripeSubscriptionId)
    }

    const { alerts, sends } = await userMessageRecords(db, user.uid)
    await Promise.all([...alerts, ...sends].map((doc) => doc.ref.delete()))
    await eraseCommunityData(firestoreDocDb(), user.uid)
    await db.collection("user_preferences").doc(user.uid).delete()
    await db.collection("users").doc(user.uid).delete()
    if (user.email) await db.collection("dashboard_settings").doc(user.email).delete()
    await audit("account.deleted", user.uid)
    await auth.deleteUser(user.uid)

    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
