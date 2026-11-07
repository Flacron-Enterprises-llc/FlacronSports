// Supporter badges. Each one is worked out from what a member really did, and none
// can be bought. They are stored so chat and leaderboards can show them cheaply.

import type { DocDb } from "@/lib/doc-db"
import { BADGES } from "./badge-names"
import { PERFECT_PODIUM, POINTS } from "./pick-rules"

export { BADGES }
export type Badge = (typeof BADGES)[number]

export const PREDICTOR_AT = 10
export const VETERAN_AT = 50
export const SHARP_AT = 5

const badgePath = (uid: string) => `community_badges/${uid}`

interface Activity {
  favorites: number
  clubs: number
  predictions: number
  exact: number
  /** Correct winners and perfect podiums, so sports without a score pick can earn Sharp too. */
  correct: number
}

export function earnedBadges({ favorites, clubs, predictions, exact, correct }: Activity): Badge[] {
  return BADGES.filter((badge) => {
    if (badge === "supporter") return favorites > 0
    if (badge === "club_member") return clubs > 0
    if (badge === "predictor") return predictions >= PREDICTOR_AT
    if (badge === "veteran") return predictions >= VETERAN_AT
    return exact + correct >= SHARP_AT
  })
}

type BadgeDb = Pick<DocDb, "get" | "query" | "count" | "set">

/** Recomputed from the source records, so a repeat or a retry can never inflate anything. */
export async function refreshBadges(db: BadgeDb, uid: string, now: Date): Promise<Badge[]> {
  // No other pick lands on these two values.
  const correctAt = (value: number) => db.count("predictions", { where: [["uid", uid], ["points", value]] })
  const [prefs, points, memberships, predictions, stored, winners, podiums] = await Promise.all([
    db.get<{ favorites?: string[] }>(`user_preferences/${uid}`),
    db.get<{ exact?: number }>(`prediction_points/${uid}`),
    db.query<{ kind?: string }>("room_members", { where: [["uid", uid], ["status", "active"]] }),
    db.count("predictions", { where: [["uid", uid]] }),
    db.get<{ badges: Badge[] }>(badgePath(uid)),
    correctAt(POINTS.winner),
    correctAt(PERFECT_PODIUM),
  ])
  const badges = earnedBadges({
    favorites: prefs?.favorites?.length ?? 0,
    clubs: memberships.filter((member) => member.kind === "club").length,
    predictions,
    exact: points?.exact ?? 0,
    correct: winners + podiums,
  })
  if (stored?.badges.join() !== badges.join()) await db.set(badgePath(uid), { uid, badges, updatedAtUTC: now.toISOString() })
  return badges
}

/** A badge is a small extra, so a failed refresh must never fail what the member was doing. */
export function refreshBadgesQuietly(db: BadgeDb, uid: string, now: Date): Promise<void> {
  return refreshBadges(db, uid, now).then(
    () => undefined,
    (error) => console.error("Badge refresh failed", error instanceof Error ? error.message : "unknown"),
  )
}

export async function badgesFor(db: Pick<DocDb, "get">, uids: string[]): Promise<Map<string, Badge[]>> {
  const unique = [...new Set(uids.filter(Boolean))]
  const rows = await Promise.all(unique.map((uid) => db.get<{ badges: Badge[] }>(badgePath(uid))))
  return new Map(unique.map((uid, index) => [uid, rows[index]?.badges ?? []]))
}
