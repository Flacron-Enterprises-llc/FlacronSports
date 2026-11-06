export type AuthErrorKey =
  | "wrongPassword"
  | "emailInUse"
  | "weakPassword"
  | "invalidEmail"
  | "tooManyAttempts"
  | "network"
  | "accountDisabled"
  | "otherMethod"
  | "popupBlocked"
  | "expiredLink"
  | "failed"

const CODES = new Map<string, AuthErrorKey | "cancelled">([
  ["auth/wrong-password", "wrongPassword"],
  ["auth/invalid-credential", "wrongPassword"],
  ["auth/invalid-login-credentials", "wrongPassword"],
  ["auth/user-not-found", "wrongPassword"],
  ["auth/email-already-in-use", "emailInUse"],
  ["auth/weak-password", "weakPassword"],
  ["auth/password-does-not-meet-requirements", "weakPassword"],
  ["auth/invalid-email", "invalidEmail"],
  ["auth/missing-email", "invalidEmail"],
  ["auth/too-many-requests", "tooManyAttempts"],
  ["auth/network-request-failed", "network"],
  ["auth/timeout", "network"],
  ["auth/user-disabled", "accountDisabled"],
  ["auth/account-exists-with-different-credential", "otherMethod"],
  ["auth/credential-already-in-use", "otherMethod"],
  ["auth/popup-blocked", "popupBlocked"],
  ["auth/expired-action-code", "expiredLink"],
  ["auth/invalid-action-code", "expiredLink"],
  ["auth/popup-closed-by-user", "cancelled"],
  ["auth/cancelled-popup-request", "cancelled"],
  ["auth/user-cancelled", "cancelled"],
])

/** "cancelled" means the person closed the sign-in window, which is not an error to show. */
export function authErrorKey(cause: unknown): AuthErrorKey | "cancelled" {
  const code = (cause as { code?: unknown } | null | undefined)?.code
  return (typeof code === "string" && CODES.get(code)) || "failed"
}

export function authErrorField(key: AuthErrorKey): "email" | "password" | null {
  if (key === "emailInUse" || key === "invalidEmail") return "email"
  return key === "weakPassword" ? "password" : null
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
}

export function passwordChecks(password: string) {
  return { length: password.length >= 8, mix: /[A-Za-z]/.test(password) && /[\d\W_]/.test(password) }
}

export function passwordAccepted(password: string): boolean {
  const { length, mix } = passwordChecks(password)
  return length && mix
}

/** Post-auth redirects stay inside the dashboard. */
export function safeNext(next: string | null | undefined): string | null {
  return next && /^\/app(?:[/?#]|$)/.test(next) ? next : null
}
