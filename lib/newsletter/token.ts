import { createHmac, timingSafeEqual } from "node:crypto"

// The purpose prefix keeps these signatures unusable for anything else signed
// with CRON_SECRET. Rotating that secret invalidates links in mail already sent.
const signature = (uid: string, secret: string) => createHmac("sha256", secret).update(`newsletter-unsubscribe:${uid}`).digest("base64url")

export function unsubscribeToken(uid: string, secret = process.env.CRON_SECRET): string | null {
  return secret ? `${uid}.${signature(uid, secret)}` : null
}

/** Returns the uid only for an untampered token. Fails closed without a secret. */
export function verifyUnsubscribeToken(token: string | null | undefined, secret = process.env.CRON_SECRET): string | null {
  if (!secret || !token) return null
  const split = token.lastIndexOf(".")
  if (split <= 0) return null
  const uid = token.slice(0, split)
  const given = Buffer.from(token.slice(split + 1))
  const expected = Buffer.from(signature(uid, secret))
  return given.length === expected.length && timingSafeEqual(given, expected) ? uid : null
}
