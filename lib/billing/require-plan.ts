import { ApiError, isStaff, requireUser, type AuthedUser } from "@/lib/api-auth"
import { rateLimit } from "@/lib/rate-limit"
import { hasLivePurchase, type AccessAddon, type AllowanceUnit } from "./addons"
import { getEffectiveAccess, getUserPurchases } from "./firestore-store"
import { hasPlusFeatures } from "./plans"

const noPlan = () => new ApiError(402, "subscription_required", "Choose a plan to use FlacronSport")

/** Every member feature needs a subscription or a live day pass. */
export async function requireSubscriber(uid: string): Promise<void> {
  const { plan } = await getEffectiveAccess(uid)
  if (plan === "none") throw noPlan()
}

/** Plus gets the basic comparison and Premium the advanced one, including in exports. */
export async function comparisonTier(uid: string): Promise<"basic" | "advanced"> {
  const { plan } = await getEffectiveAccess(uid)
  if (!hasPlusFeatures(plan)) throw new ApiError(403, "plan_required", "Comparison needs the Plus or Premium plan")
  return plan === "premium" ? "advanced" : "basic"
}

/** Reading sports data is not a privileged action, so the role alone counts here, as it does at the paywall. */
export async function requireDataAccess(user: AuthedUser, addons: AccessAddon[] = []): Promise<void> {
  if (isStaff(user)) return
  const { plan } = await getEffectiveAccess(user.uid)
  if (plan !== "none") return
  const purchases = addons.length > 0 ? await getUserPurchases(user.uid) : []
  if (!addons.some((unit) => hasLivePurchase(purchases, unit, Date.now()))) throw noPlan()
}

/** The add-ons that keep a match page open, as `addonOpensPath` does on screen. */
export const MATCH_ADDONS: AccessAddon[] = ["room", "export"]

/** The guard on every data route. The limit comes before the plan so a burst costs no database reads. */
export async function requireMember(request: Request, scope: string, perMinute: number, addons: AccessAddon[] = []): Promise<AuthedUser> {
  const user = await requireUser(request)
  rateLimit(`${scope}:${user.uid}`, perMinute, 60_000)
  await requireDataAccess(user, addons)
  return user
}

/** Ending a plan does not erase what was bought: a live add-on keeps its own feature open. */
export async function requireSubscriberOrPurchase(uid: string, unit: AllowanceUnit): Promise<void> {
  const { plan } = await getEffectiveAccess(uid)
  if (plan === "none" && !hasLivePurchase(await getUserPurchases(uid), unit, Date.now())) throw noPlan()
}
