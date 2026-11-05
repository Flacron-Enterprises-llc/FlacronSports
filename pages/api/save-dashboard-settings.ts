import type { NextApiRequest, NextApiResponse } from "next"
import { z } from "zod"
import { ApiError, authenticate } from "@/lib/api-auth"
import { getAdminDb } from "@/lib/firebase-admin"

const settingsSchema = z.object({
  leagues: z.array(z.string().max(60)).max(50),
  region: z.string().min(1).max(60),
  language: z.string().min(1).max(10),
  newsletterEnabled: z.boolean().optional().default(false),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" })

  try {
    const user = await authenticate(req.headers.authorization)
    if (!user.email) throw new ApiError(400, "no_email", "This account has no email address")

    const parsed = settingsSchema.safeParse(req.body)
    if (!parsed.success) throw new ApiError(400, "invalid_request", "Missing required fields")

    const db = getAdminDb()
    if (!db) throw new ApiError(503, "storage_unavailable", "Settings are temporarily unavailable")

    const updatedAt = new Date().toISOString()
    await db.collection("users").doc(user.uid).set({ email: user.email, updatedAt }, { merge: true })
    await db.collection("dashboard_settings").doc(user.email).set({ ...parsed.data, updatedAt })

    return res.status(200).json({ success: true })
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.status).json({ error: error.message })
    return res.status(500).json({ error: "Failed to save settings" })
  }
}
