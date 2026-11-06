import { ApiError } from "@/lib/api-auth"
import { hasLivePurchase, type AllowanceUnit } from "./addons"
import { getEffectiveAccess, getUserPurchases } from "./firestore-store"

const noPlan = () => new ApiError(402, "subscription_required", "Choose a plan to use FlacronSport")

/** Every member feature needs a subscription or a live day pass. */
export async function requireSubscriber(uid: string): Promise<void> {
  const { plan } = await getEffectiveAccess(uid)
  if (plan === "none") throw noPlan()
}

/** Ending a plan does not erase what was bought: a live add-on keeps its own feature open. */
export async function requireSubscriberOrPurchase(uid: string, unit: AllowanceUnit): Promise<void> {
  const { plan } = await getEffectiveAccess(uid)
  if (plan === "none" && !hasLivePurchase(await getUserPurchases(uid), unit, Date.now())) throw noPlan()
}
