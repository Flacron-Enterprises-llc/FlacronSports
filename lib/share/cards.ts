import { randomBytes } from "node:crypto"
import type { DocDb } from "@/lib/doc-db"
import { getDictionary, localePath, type Locale } from "@/lib/i18n"
import { eventTitle, hasResult, isDuel, resultLine } from "@/lib/sports/presentation"
import type { SportEvent } from "@/lib/sports/types"

const SHARES = "share_cards"

/** Holds no account link, so a shared card stays valid and personal data does not move with it. */
export interface ShareRecord {
  matchId: string
  locale: Locale
  /** The sharer's own choice. Never set by whoever opens the link. */
  reveal: boolean
  createdAtUTC: string
}

export interface ShareCard {
  kind: "fixture" | "result"
  heading: string
  competition: string
  sides: string[]
  when: string | null
  score: string | null
  title: string
  description: string
  locale: Locale
  matchPath: string
}

export const isShareId = (id: string): boolean => /^[A-Za-z0-9_-]{16}$/.test(id)

export async function createShare(db: Pick<DocDb, "set">, matchId: string, locale: Locale, reveal: boolean, now: Date = new Date()): Promise<string> {
  const id = randomBytes(12).toString("base64url")
  await db.set(`${SHARES}/${id}`, { matchId, locale, reveal, createdAtUTC: now.toISOString() } satisfies ShareRecord)
  return id
}

export const readShare = (db: Pick<DocDb, "get">, id: string): Promise<ShareRecord | null> => (isShareId(id) ? db.get<ShareRecord>(`${SHARES}/${id}`) : Promise.resolve(null))

export const sharePath = (id: string, locale: Locale): string => localePath(locale, `/share/${id}`)

function formatWhen(event: SportEvent, locale: Locale): string | null {
  if (!event.scheduledStartUTC) return null
  const options: Intl.DateTimeFormatOptions = event.dateOnly ? { dateStyle: "long", timeZone: "UTC" } : { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }
  const text = new Intl.DateTimeFormat(locale, options).format(new Date(event.scheduledStartUTC))
  return event.dateOnly ? text : `${text} UTC`
}

/**
 * Everything a card, its page and its link preview may state. The score enters here
 * and only when the sharer chose it, so no later step can leak one by accident.
 */
export function shareCard(event: SportEvent, share: Pick<ShareRecord, "locale" | "reveal">): ShareCard {
  const t = getDictionary(share.locale)
  const finished = hasResult(event) && event.status !== "live"
  const score = share.reveal && hasResult(event) ? resultLine(event, t) : null
  const title = eventTitle(event)
  const kind = finished ? "result" : "fixture"
  return {
    kind,
    heading: t.share[kind],
    competition: event.competition.name,
    sides: isDuel(event) ? event.participants.map((participant) => participant.name) : [title],
    when: formatWhen(event, share.locale),
    score,
    title: score ? `${title}: ${score}` : title,
    description: `${t.share[kind]}, ${event.competition.name}`,
    locale: share.locale,
    matchPath: `/app/match/${event.id}`,
  }
}
