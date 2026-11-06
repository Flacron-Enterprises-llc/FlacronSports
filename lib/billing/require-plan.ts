import { ApiError } from "@/lib/api-auth"
import { getEffectiveAccess } from "./firestore-store"

/** Every member feature needs a subscription or a live day pass. */
export async function requireSubscriber(uid: string): Promise<void> {
  const { plan } = await getEffectiveAccess(uid)
  if (plan === "none") throw new ApiError(402, "subscription_required", "Choose a plan to use FlacronSport")
}
