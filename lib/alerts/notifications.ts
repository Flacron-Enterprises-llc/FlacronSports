import type { Firestore } from "firebase-admin/firestore"
import type { PlanId } from "@/lib/billing/plans"
import { brandedEmail } from "@/lib/email-service"
import { getDictionary, localePath } from "@/lib/i18n"
import type { Preferences } from "@/lib/me/preferences-defaults"
import type { SportEvent } from "@/lib/sports/types"
import { buildAlert, buildSummary, detailAlerts, dueAlerts, followsEvent, localClock, summaryDue, suppressionReason, type DueAlert, type NoticeType } from "./rules"

export const NOTIFICATIONS_COLLECTION = "notifications"
// Holds no personal data: one line per followed event, the time it was last seen at.
const KICKOFFS_COLLECTION = "event_kickoffs"
const ALREADY_EXISTS = 6
const DAY = 86_400_000
const SUMMARY_SOURCE_LIMIT = 100

export interface NotificationRecord {
  uid: string
  eventId: string
  type: NoticeType | "summary"
  title: string
  body: string
  spoilerFreeBody: string
  path: string
  locale: Preferences["locale"]
  createdAt: string
  emailStatus: "not_requested" | "sent" | "failed" | "no_address"
  kickoffUTC?: string | null
  /** Tells apart repeats of one type: each new score is its own alert. */
  alertKey?: string
  /** uid#createdAt. A range on one field needs no composite index. */
  feedKey: string
}

/** The kickoff is part of a start alert's identity, so a moved event alerts again at its new time. */
export const notificationId = (uid: string, eventId: string, type: NotificationRecord["type"], kickoffUTC?: string | null, alertKey?: string) =>
  `${uid}_${eventId}_${type}${type === "start" && kickoffUTC ? `_${Date.parse(kickoffUTC)}` : ""}${alertKey ? `_${alertKey}` : ""}`

/** create() fails on an existing document, so a duplicate is impossible rather than unlikely. */
export async function claimNotification(db: Firestore, record: NotificationRecord): Promise<boolean> {
  const ref = db.collection(NOTIFICATIONS_COLLECTION).doc(notificationId(record.uid, record.eventId, record.type, record.kickoffUTC, record.alertKey))
  try {
    await ref.create(record)
    return true
  } catch (error) {
    if ((error as { code?: number }).code === ALREADY_EXISTS) return false
    throw error
  }
}

export interface AlertDeps {
  db: Firestore
  events: SportEvent[]
  users: Iterable<UserRow> | AsyncIterable<UserRow>
  planFor(uid: string): Promise<PlanId>
  /** Whether a lineup or an approved video really exists. Without this those alerts are not sent. */
  confirm?(event: SportEvent, type: "participants" | "highlights"): Promise<boolean>
  emailFor(uid: string): Promise<string | null>
  send(email: { to: string; subject: string; html: string; text: string }): Promise<boolean>
  siteUrl: string
  now: Date
}

export interface UserRow {
  uid: string
  prefs: Preferences
}

export interface AlertCounts {
  users: number
  created: number
  duplicate: number
  suppressed: number
  emailed: number
  emailFailed: number
  failed: number
  summaries: number
}

interface KickoffChange {
  previousKickoffUTC: string
  /** Includes the time it moved from, so moving back and forth is told each time. */
  key: string
}

/**
 * Remembers when each followed event was last due to start. New times are saved only
 * after every member has been told, so the first member cannot hide the move from the rest.
 */
function kickoffTracker(db: Firestore, now: Date) {
  const changes = new Map<string, Promise<KickoffChange | null>>()
  const updates = new Map<string, { kickoffUTC: string; status: string }>()

  const read = async (event: SportEvent): Promise<KickoffChange | null> => {
    const current = { kickoffUTC: event.scheduledStartUTC as string, status: event.status }
    const stored = (await db.collection(KICKOFFS_COLLECTION).doc(event.id).get()).data() as typeof current | undefined
    if (stored?.kickoffUTC === current.kickoffUTC && stored.status === current.status) return null
    updates.set(event.id, current)
    if (!stored) return null
    const moved = stored.kickoffUTC !== current.kickoffUTC
    const justPostponed = current.status === "postponed" && stored.status !== "postponed"
    const stillAhead = current.status === "postponed" || Date.parse(current.kickoffUTC) > now.getTime()
    if ((!moved && !justPostponed) || !stillAhead) return null
    return { previousKickoffUTC: stored.kickoffUTC, key: `${Date.parse(stored.kickoffUTC)}-${Date.parse(current.kickoffUTC)}-${current.status}` }
  }

  return {
    changeFor(event: SportEvent) {
      if (!changes.has(event.id)) changes.set(event.id, read(event))
      return changes.get(event.id) as Promise<KickoffChange | null>
    },
    async save() {
      await Promise.all([...updates].map(([id, mark]) => db.collection(KICKOFFS_COLLECTION).doc(id).set({ ...mark, updatedAt: now.toISOString() })))
    },
  }
}

/** A date with no real start cannot move: gaining a time is not a correction. */
const canMove = (event: SportEvent) => Boolean(event.scheduledStartUTC) && !event.dateOnly && (event.status === "scheduled" || event.status === "postponed")

async function deliver(deps: AlertDeps, user: UserRow, event: SportEvent, type: NoticeType, counts: AlertCounts, change?: KickoffChange): Promise<void> {
  const { db, now, siteUrl } = deps
  const { uid, prefs } = user
  const content = buildAlert(event, type, prefs, change?.previousKickoffUTC)
  const path = `/app/match/${event.id}`
  const createdAt = now.toISOString()
  const alertKey = change?.key ?? (type === "scoring" && event.score.kind === "team" ? `${event.score.home}-${event.score.away}` : undefined)
  const record: NotificationRecord = {
    uid, eventId: event.id, type, ...content, path, locale: prefs.locale, createdAt, kickoffUTC: event.scheduledStartUTC, ...(alertKey ? { alertKey } : {}),
    emailStatus: "not_requested", feedKey: `${uid}#${createdAt}`,
  }
  if (!(await claimNotification(db, record))) {
    counts.duplicate += 1
    return
  }
  counts.created += 1
  if (!prefs.alerts.email) return

  const { alerts: copy } = getDictionary(prefs.locale)
  const ref = db.collection(NOTIFICATIONS_COLLECTION).doc(notificationId(uid, event.id, type, event.scheduledStartUTC, alertKey))
  const to = await deps.emailFor(uid)
  if (!to) {
    await ref.update({ emailStatus: "no_address" })
    return
  }
  // The claim above is what prevents a second email, so a failure is recorded and not retried.
  const sent = await deps
    .send({
      to,
      subject: content.title,
      ...brandedEmail({
        heading: content.title, body: content.body, cta: copy.emailCta,
        url: `${siteUrl}${localePath(prefs.locale, path)}`,
        footnote: copy.emailFootnote, siteUrl, lang: prefs.locale,
      }),
    })
    .catch(() => false)
  await ref.update({ emailStatus: sent ? "sent" : "failed" })
  counts[sent ? "emailed" : "emailFailed"] += 1
}

/** In-app only, and silent on a day with nothing to report. */
async function deliverSummary(deps: AlertDeps, user: UserRow, counts: AlertCounts): Promise<void> {
  const { db, now } = deps
  const { uid, prefs } = user
  const since = new Date(now.getTime() - DAY).toISOString()
  const snapshot = await db
    .collection(NOTIFICATIONS_COLLECTION)
    .where("feedKey", ">=", `${uid}#${since}`)
    .where("feedKey", "<", `${uid}$`)
    .orderBy("feedKey", "desc")
    .limit(SUMMARY_SOURCE_LIMIT)
    .get()
  const alerts = snapshot.docs.map((doc) => doc.data() as NotificationRecord).filter((record) => record.uid === uid && record.type !== "summary" && !(prefs.spoilerMode && record.type === "scoring"))
  if (!alerts.length) return

  const createdAt = now.toISOString()
  const record: NotificationRecord = {
    uid, eventId: "daily", type: "summary", ...buildSummary(alerts, prefs), path: "/app/notifications", locale: prefs.locale, createdAt,
    alertKey: localClock(now, prefs.timeZone).date, emailStatus: "not_requested", feedKey: `${uid}#${createdAt}`,
  }
  if (await claimNotification(db, record)) counts.summaries += 1
}

export async function runAlerts(deps: AlertDeps): Promise<AlertCounts> {
  const { events, now } = deps
  const counts: AlertCounts = { users: 0, created: 0, duplicate: 0, suppressed: 0, emailed: 0, emailFailed: 0, failed: 0, summaries: 0 }
  const kickoffs = kickoffTracker(deps.db, now)
  const movable = events.filter(canMove)
  const due = events.flatMap((event) => [...dueAlerts(event, now), ...detailAlerts(event, now)].map((type) => ({ event, type })))
  const confirmed = new Map<string, Promise<boolean>>()
  // Followed games only reach this, and each is asked about once per run however many fans it has.
  const exists = (event: SportEvent, type: "participants" | "highlights") => {
    const key = `${event.id}:${type}`
    if (!confirmed.has(key)) confirmed.set(key, deps.confirm ? deps.confirm(event, type).catch(() => false) : Promise.resolve(false))
    return confirmed.get(key) as Promise<boolean>
  }

  for await (const user of deps.users) {
    const { uid, prefs } = user
    if (prefs.alerts.muted) continue
    try {
      if (summaryDue(prefs, now) && (await deps.planFor(uid)) !== "none") await deliverSummary(deps, user, counts)
    } catch (error) {
      counts.failed += 1
      console.error("Summary delivery failed", error instanceof Error ? error.message : "unknown")
    }
    const reminded = new Set(prefs.reminders.map((reminder) => reminder.eventId))
    if (!prefs.favorites.length && !reminded.size) continue
    const mine = due.filter(({ event, type }) => followsEvent(prefs.favorites, event) || (type === "start" && reminded.has(event.id)))
    const watched = movable.filter((event) => followsEvent(prefs.favorites, event) || reminded.has(event.id))
    if (!mine.length && !watched.length) continue
    try {
      const moves = (await Promise.all(watched.map(async (event) => ({ event, change: await kickoffs.changeFor(event) })))).filter(({ change }) => change)
      if (!mine.length && !moves.length) continue
      counts.users += 1
      const plan = await deps.planFor(uid)
      for (const { event, change } of moves) {
        // A notice on top of the start alert, which still goes out at the new time.
        if (suppressionReason(prefs, plan, "start", now, event)) counts.suppressed += 1
        else await deliver(deps, user, event, "correction", counts, change as KickoffChange)
      }
      for (const { event, type } of mine) {
        // A bell on a game is its own request, whatever the general start alert is set to.
        const effective = type === "start" && reminded.has(event.id) ? { ...prefs, alerts: { ...prefs.alerts, types: [...prefs.alerts.types, type] } } : prefs
        if (suppressionReason(effective, plan, type, now, event)) {
          counts.suppressed += 1
          continue
        }
        if ((type === "participants" || type === "highlights") && !(await exists(event, type))) continue
        await deliver(deps, user, event, type, counts)
      }
    } catch (error) {
      counts.failed += 1
      console.error("Alert delivery failed", error instanceof Error ? error.message : "unknown")
    }
  }
  await kickoffs.save()
  return counts
}

export async function listNotifications(db: Firestore, uid: string, spoilerMode: boolean, limit = 50) {
  const snapshot = await db
    .collection(NOTIFICATIONS_COLLECTION)
    .where("feedKey", ">=", `${uid}#`)
    .where("feedKey", "<", `${uid}$`)
    .orderBy("feedKey", "desc")
    .limit(limit)
    .get()
  return snapshot.docs
    .map((doc) => doc.data() as NotificationRecord)
    // Alerts from before spoiler mode was turned on would otherwise still say the score moved.
    .filter((record) => record.uid === uid && !(spoilerMode && record.type === "scoring"))
    .map(({ eventId, type, title, body, spoilerFreeBody, path, createdAt, kickoffUTC, alertKey }) => ({
      id: notificationId(uid, eventId, type, kickoffUTC, alertKey),
      type, title, path, createdAt,
      body: spoilerMode ? spoilerFreeBody : body,
    }))
}

/** Used by account deletion and export, so the new collections stay inside both. */
export async function userMessageRecords(db: Firestore, uid: string) {
  const [alerts, sends] = await Promise.all([
    db.collection(NOTIFICATIONS_COLLECTION).where("uid", "==", uid).get(),
    db.collection("newsletter_sends").where("uid", "==", uid).get(),
  ])
  return { alerts: alerts.docs, sends: sends.docs }
}
