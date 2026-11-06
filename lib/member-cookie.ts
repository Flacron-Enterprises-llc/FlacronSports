export const MEMBER_COOKIE = "fs_member"

const MAX_AGE_SECONDS = 3600
const RETRY_WINDOW_MS = 60_000

const attributes = (maxAge: number, secure: boolean) => `Path=/; Max-Age=${maxAge}; SameSite=Lax${secure ? "; Secure" : ""}`

/** Readable by script on purpose: Firebase keeps the same token in browser storage, and pages only read with it. */
export const memberCookie = (token: string, secure: boolean) => `${MEMBER_COOKIE}=${token}; ${attributes(MAX_AGE_SECONDS, secure)}`
export const clearedMemberCookie = (secure: boolean) => `${MEMBER_COOKIE}=; ${attributes(0, secure)}`

const attempts = new Map<string, number>()

/** One automatic reload per page per minute, so a render that stays empty cannot loop. */
export function claimRecovery(path: string, now = Date.now()): boolean {
  const last = attempts.get(path)
  if (last !== undefined && now - last < RETRY_WINDOW_MS) return false
  attempts.set(path, now)
  return true
}

export const forgetRecovery = (path: string): void => {
  attempts.delete(path)
}
