import {
  getMultiFactorResolver,
  multiFactor,
  TotpMultiFactorGenerator,
  type MultiFactorError,
  type MultiFactorResolver,
  type TotpSecret,
  type User,
} from "firebase/auth"
import { getAuthInstance } from "@/lib/firebase-auth"
import { syncMemberCookie } from "@/lib/member-session"

const DISABLED_CODES = new Set(["auth/operation-not-allowed", "auth/admin-restricted-operation", "auth/unsupported-first-factor"])

export type MfaFailure = "disabled" | "recent_login" | "unverified" | "bad_code" | "failed"

export function mfaFailure(error: unknown): MfaFailure {
  const code = (error as { code?: string } | null)?.code ?? ""
  if (DISABLED_CODES.has(code)) return "disabled"
  if (code === "auth/requires-recent-login") return "recent_login"
  if (code === "auth/unverified-email") return "unverified"
  if (code === "auth/invalid-verification-code") return "bad_code"
  return "failed"
}

export function enrolledTotp(user: User) {
  return multiFactor(user).enrolledFactors.filter((factor) => factor.factorId === TotpMultiFactorGenerator.FACTOR_ID)
}

export async function startTotpEnrolment(user: User) {
  const session = await multiFactor(user).getSession()
  const secret = await TotpMultiFactorGenerator.generateSecret(session)
  return { secret, key: secret.secretKey, uri: secret.generateQrCodeUrl(user.email ?? "account", "FlacronSport") }
}

export async function finishTotpEnrolment(user: User, secret: TotpSecret, code: string, name: string) {
  await multiFactor(user).enroll(TotpMultiFactorGenerator.assertionForEnrollment(secret, code), name)
}

export interface SecondFactorChallenge {
  resolver: MultiFactorResolver
  enrollmentId: string
}

/** Null when the error is not a second-factor request. */
export function startSecondFactor(error: unknown): SecondFactorChallenge | "unsupported" | null {
  if ((error as { code?: string } | null)?.code !== "auth/multi-factor-auth-required") return null
  const resolver = getMultiFactorResolver(getAuthInstance(), error as MultiFactorError)
  const hint = resolver.hints.find((item) => item.factorId === TotpMultiFactorGenerator.FACTOR_ID)
  return hint ? { resolver, enrollmentId: hint.uid } : "unsupported"
}

export async function completeTotpSignIn(challenge: SecondFactorChallenge, code: string) {
  const assertion = TotpMultiFactorGenerator.assertionForSignIn(challenge.enrollmentId, code)
  const credential = await challenge.resolver.resolveSignIn(assertion)
  await syncMemberCookie(credential.user)
  return credential.user
}
