import type { NextApiRequest, NextApiResponse } from "next"
import { ApiError, authenticate } from "@/lib/api-auth"
import { getAdminDb } from "@/lib/firebase-admin"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" })

  try {
    const user = await authenticate(req.headers.authorization)
    if (!user.email) throw new ApiError(400, "no_email", "This account has no email address")

    const db = getAdminDb()
    if (!db) throw new ApiError(503, "storage_unavailable", "Settings are temporarily unavailable")

    const doc = await db.collection("dashboard_settings").doc(user.email).get()
    return res.status(200).json({
      success: true,
      settings: doc.exists ? doc.data() : { leagues: [], region: "", language: "", newsletterEnabled: false },
    })
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.status).json({ error: error.message })
    return res.status(500).json({ error: "Failed to fetch settings" })
  }
}
