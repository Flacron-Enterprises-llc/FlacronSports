import { createHash, randomBytes } from "node:crypto"
import type { DocDb } from "@/lib/doc-db"

// Only a hash is stored, so a read of the database cannot be turned into a working feed link.
const feedPath = (hash: string) => `calendar_feeds/${hash}`
const ownerPath = (uid: string) => `user_calendar_feeds/${uid}`

interface FeedOwner {
  uid: string
  hash: string
  createdAtUTC: string
}

export const hashFeedToken = (token: string): string => createHash("sha256").update(token).digest("hex")

export const isFeedToken = (token: string): boolean => /^[A-Za-z0-9_-]{43}$/.test(token)

export async function feedStatus(db: Pick<DocDb, "get">, uid: string): Promise<{ active: boolean; createdAtUTC: string | null }> {
  const owner = await db.get<FeedOwner>(ownerPath(uid))
  return { active: Boolean(owner), createdAtUTC: owner?.createdAtUTC ?? null }
}

/** The old link stops working in the same transaction. The new token is returned this once. */
export function regenerateFeed(db: Pick<DocDb, "transaction">, uid: string, now: Date = new Date()): Promise<{ token: string; createdAtUTC: string }> {
  const token = randomBytes(32).toString("base64url")
  const hash = hashFeedToken(token)
  const createdAtUTC = now.toISOString()
  return db.transaction(async (tx) => {
    const owner = await tx.get<FeedOwner>(ownerPath(uid))
    if (owner) tx.delete(feedPath(owner.hash))
    tx.set(feedPath(hash), { uid, createdAtUTC })
    tx.set(ownerPath(uid), { uid, hash, createdAtUTC })
    return { token, createdAtUTC }
  })
}

export function revokeFeed(db: Pick<DocDb, "transaction">, uid: string): Promise<void> {
  return db.transaction(async (tx) => {
    const owner = await tx.get<FeedOwner>(ownerPath(uid))
    if (owner) tx.delete(feedPath(owner.hash))
    tx.delete(ownerPath(uid))
  })
}

export async function feedOwner(db: Pick<DocDb, "get">, token: string): Promise<string | null> {
  if (!isFeedToken(token)) return null
  return (await db.get<{ uid: string }>(feedPath(hashFeedToken(token))))?.uid ?? null
}
