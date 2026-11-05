import type { Firestore } from "firebase-admin/firestore"
import { followsEvent, localClock } from "@/lib/alerts/rules"
import type { UserRow } from "@/lib/alerts/notifications"
import { brandedEmail, type OutboundEmail } from "@/lib/email-service"
import { getDictionary, localePath, type Locale } from "@/lib/i18n"
import type { Preferences } from "@/lib/me/preferences-defaults"
import { eventTitle, isDuel, resultLine } from "@/lib/sports/presentation"
import type { SportEvent } from "@/lib/sports/types"
import { unsubscribeToken } from "./token"

export const NEWSLETTER_SENDS = "newsletter_sends"
export const DELIVERY_HOUR = 8
const ALREADY_EXISTS = 6
const MAX_ROWS = 12

export function isDeliveryHour(now: Date, timeZone: string): boolean {
  return localClock(now, timeZone).hour === DELIVERY_HOUR
}

export const sendId = (uid: string, localDate: string) => `${uid}_${localDate}`

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "")

function clockTime(iso: string, locale: Locale, timeZone: string): string {
  const options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" }
  try {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(new Date(iso))
  } catch {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(new Date(iso))
  }
}

export interface Digest {
  subject: string
  lines: string[]
}

/** Only rows the feed verified. Spoiler mode drops scores. Nothing to report gives null. */
export function buildDigest(prefs: Preferences, events: SportEvent[], now: Date): Digest | null {
  const dictionary = getDictionary(prefs.locale)
  const { newsletter: copy } = dictionary
  const pool = prefs.favorites.length ? events.filter((event) => followsEvent(prefs.favorites, event)) : events
  const today = localClock(now, prefs.timeZone).date

  const results = pool.flatMap((event) => {
    const result = resultLine(event, dictionary)
    if (event.status !== "finished" || !result) return []
    const name = eventTitle(event)
    if (event.score.kind !== "team") return [fill(prefs.spoilerMode ? copy.eventResultHidden : copy.eventResultLine, { event: name, result })]
    const [home, away] = event.participants.map((participant) => participant.name)
    return prefs.spoilerMode
      ? [fill(copy.resultHidden, { home, away })]
      : [fill(copy.resultLine, { home, away, homeScore: String(event.score.home), awayScore: String(event.score.away) })]
  })
  const fixtures = pool.flatMap((event) => {
    const iso = event.scheduledStartUTC
    if (event.status !== "scheduled" || !iso || event.dateOnly || localClock(new Date(iso), prefs.timeZone).date !== today) return []
    const time = clockTime(iso, prefs.locale, prefs.timeZone)
    if (!isDuel(event)) return [fill(copy.eventFixtureLine, { event: eventTitle(event), competition: event.competition.name, time })]
    const [home, away] = event.participants.map((participant) => participant.name)
    return [fill(copy.fixtureLine, { home, away, competition: event.competition.name, time })]
  })

  const section = (heading: string, rows: string[]) => (rows.length ? [heading, ...rows.slice(0, MAX_ROWS)] : [])
  const lines = [...section(copy.resultsHeading, results), ...section(copy.fixturesHeading, fixtures)]
  return lines.length ? { subject: copy.subject, lines } : null
}

export function digestEmail(uid: string, prefs: Preferences, digest: Digest, to: string, siteUrl: string): OutboundEmail | null {
  const token = unsubscribeToken(uid)
  if (!token) return null
  const { newsletter: copy } = getDictionary(prefs.locale)
  const unsubscribe = `${siteUrl}/api/newsletter/unsubscribe?${new URLSearchParams({ token, locale: prefs.locale })}`
  return {
    to,
    subject: digest.subject,
    ...brandedEmail({
      heading: copy.heading, body: copy.intro, lines: digest.lines, cta: copy.cta,
      url: `${siteUrl}${localePath(prefs.locale, "/app/scores")}`,
      footnote: copy.footnote, siteUrl, lang: prefs.locale,
      footerLink: { label: copy.unsubscribe, url: unsubscribe },
    }),
    headers: [
      { name: "List-Unsubscribe", value: `<${unsubscribe}>` },
      { name: "List-Unsubscribe-Post", value: "List-Unsubscribe=One-Click" },
    ],
  }
}

export interface NewsletterDeps {
  db: Firestore
  events: SportEvent[]
  users: Iterable<UserRow> | AsyncIterable<UserRow>
  emailFor(uid: string): Promise<string | null>
  send(email: OutboundEmail): Promise<boolean>
  siteUrl: string
  now: Date
}

export interface NewsletterCounts {
  due: number
  sent: number
  duplicate: number
  empty: number
  noAddress: number
  failed: number
}

// Bounces and complaints are dropped by the SES account suppression list, so no
// address tracking is kept here.
export async function runNewsletter(deps: NewsletterDeps): Promise<NewsletterCounts> {
  const { db, events, now, siteUrl } = deps
  const counts: NewsletterCounts = { due: 0, sent: 0, duplicate: 0, empty: 0, noAddress: 0, failed: 0 }

  for await (const { uid, prefs } of deps.users) {
    if (!prefs.newsletter.optedIn || !isDeliveryHour(now, prefs.timeZone)) continue
    counts.due += 1
    try {
      const digest = buildDigest(prefs, events, now)
      if (!digest) {
        counts.empty += 1
        continue
      }
      const to = await deps.emailFor(uid)
      if (!to) {
        counts.noAddress += 1
        continue
      }
      const email = digestEmail(uid, prefs, digest, to, siteUrl)
      if (!email) throw new Error("Unsubscribe signing is not configured")

      const localDate = localClock(now, prefs.timeZone).date
      const ref = db.collection(NEWSLETTER_SENDS).doc(sendId(uid, localDate))
      try {
        await ref.create({ uid, localDate, status: "sending", locale: prefs.locale, createdAt: now.toISOString() })
      } catch (error) {
        if ((error as { code?: number }).code === ALREADY_EXISTS) {
          counts.duplicate += 1
          continue
        }
        throw error
      }
      // Claimed before sending: a crash here costs one digest, never a second copy.
      const sent = await deps.send(email).catch(() => false)
      await ref.update({ status: sent ? "sent" : "failed" })
      counts[sent ? "sent" : "failed"] += 1
    } catch (error) {
      counts.failed += 1
      console.error("Newsletter delivery failed", error instanceof Error ? error.message : "unknown")
    }
  }
  return counts
}
