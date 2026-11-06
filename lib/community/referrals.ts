// Referral links. The reward is points and nothing else: they cannot become money,
// plan credit or prizes, and they stay out of the prediction leaderboard so a league
// result is never decided by who invited whom.
//
// A claim is one record per person, keyed by canonical email rather than account, so a
// second address alias cannot be referred again. It earns nothing until the verified
// billing record shows the referred account paid for a plan.

import { createHash, randomBytes } from "node:crypto"
import { ApiError } from "@/lib/api-auth"
import type { DocDb } from "@/lib/doc-db"

export const REFERRAL_POINTS = 100
export const REFERRAL_CAP = 10
const CODE = /^[a-z0-9]{12}$/

export interface ReferralAccount {
  uid: string
  code: string
  emailKey: string
  points: number
  awards: number
  createdAtUTC: string
}

export interface ReferralClaim {
  uid: string
  referrerUid: string
  status: "pending" | "awarded" | "capped"
  claimedAtUTC: string
  settledAtUTC?: string
  paymentId?: string
}

interface BillingPayment {
  uid: string
  amountPaid?: number
  /** Set on one-off purchases. A day pass or add-on is not a paid plan. */
  kind?: string
}

const accountPath = (uid: string) => `referral_accounts/${uid}`
const linkPath = (code: string) => `referral_links/${code}`
const claimPath = (emailKey: string) => `referral_claims/${emailKey}`

/**
 * Two spellings of one mailbox come out the same. Sharing a domain does not: friends
 * and colleagues on one provider are exactly who a referral is for.
 */
export function canonicalEmail(email: string): string {
  const [rawLocal = "", rawDomain = ""] = email.normalize("NFKC").trim().toLowerCase().split("@")
  const domain = rawDomain === "googlemail.com" ? "gmail.com" : rawDomain
  const local = rawLocal.split("+")[0]
  return `${domain === "gmail.com" ? local.replace(/\./g, "") : local}@${domain}`
}

export const emailKeyOf = (email: string) => createHash("sha256").update(`referral:${canonicalEmail(email)}`).digest("hex").slice(0, 40)

/** Only a verified address reaches this, so the key stands for a mailbox someone controls. */
export function getReferralAccount(db: DocDb, input: { uid: string; email: string }, now: Date): Promise<ReferralAccount> {
  return db.transaction(async (tx) => {
    const existing = await tx.get<ReferralAccount>(accountPath(input.uid))
    if (existing) return existing
    const code = randomBytes(9).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "0").slice(0, 12)
    const account: ReferralAccount = { uid: input.uid, code, emailKey: emailKeyOf(input.email), points: 0, awards: 0, createdAtUTC: now.toISOString() }
    tx.set(accountPath(input.uid), account)
    tx.set(linkPath(code), { uid: input.uid })
    return account
  })
}

const refused = () => new ApiError(409, "referral_not_eligible", "This invitation cannot be used on this account")

/**
 * Runs before the referred account has a plan, because paying is what earns the
 * reward. An account that has already paid is not a new member, so it cannot claim.
 */
export async function claimReferral(db: DocDb, input: { uid: string; email: string; code: string }, now: Date): Promise<{ status: "pending" }> {
  const { uid, email, code } = input
  if (!CODE.test(code)) throw new ApiError(404, "invite_invalid", "This invitation is not valid")
  const payments = await db.query<BillingPayment>("billing_payments", { where: [["uid", uid]], limit: 1 })
  if (payments.length) throw refused()

  const emailKey = emailKeyOf(email)
  return db.transaction(async (tx) => {
    const link = await tx.get<{ uid: string }>(linkPath(code))
    if (!link) throw new ApiError(404, "invite_invalid", "This invitation is not valid")
    const referrer = await tx.get<ReferralAccount>(accountPath(link.uid))
    const existing = await tx.get<ReferralClaim>(claimPath(emailKey))
    if (!referrer || link.uid === uid || referrer.emailKey === emailKey) throw refused()
    if (existing) {
      if (existing.uid === uid && existing.referrerUid === link.uid) return { status: "pending" as const }
      throw refused()
    }
    const claim: ReferralClaim = { uid, referrerUid: link.uid, status: "pending", claimedAtUTC: now.toISOString() }
    tx.set(claimPath(emailKey), claim)
    return { status: "pending" as const }
  })
}

/**
 * The billing webhook calls this for a paid subscription invoice. It trusts only the
 * stored payment record, and it is safe to run repeatedly: the claim records its outcome.
 */
export async function awardReferral(db: DocDb, input: { uid: string; paymentId: string }, now: Date): Promise<{ awarded: boolean }> {
  const { uid, paymentId } = input
  const payment = await db.get<BillingPayment>(`billing_payments/${paymentId}`)
  if (!payment || payment.uid !== uid || payment.kind === "addon" || !payment.amountPaid || payment.amountPaid <= 0) return { awarded: false }

  const [found] = await db.query<ReferralClaim>("referral_claims", { where: [["uid", uid]], limit: 1 })
  if (!found) return { awarded: false }
  const path = claimPath(found.id)

  return db.transaction(async (tx) => {
    const claim = await tx.get<ReferralClaim>(path)
    if (claim?.status !== "pending") return { awarded: false }
    const referrer = await tx.get<ReferralAccount>(accountPath(claim.referrerUid))
    if (!referrer) return { awarded: false }

    const capped = referrer.awards >= REFERRAL_CAP
    tx.set(path, { status: capped ? "capped" : "awarded", settledAtUTC: now.toISOString(), paymentId }, { merge: true })
    if (!capped) tx.set(accountPath(claim.referrerUid), { points: referrer.points + REFERRAL_POINTS, awards: referrer.awards + 1 }, { merge: true })
    return { awarded: !capped }
  })
}

export async function referralSummary(db: DocDb, input: { uid: string; email: string }, now: Date) {
  const account = await getReferralAccount(db, input, now)
  const pending = await db.count("referral_claims", { where: [["referrerUid", input.uid], ["status", "pending"]] })
  return { code: account.code, points: account.points, awards: account.awards, cap: REFERRAL_CAP, perAward: REFERRAL_POINTS, pending }
}
