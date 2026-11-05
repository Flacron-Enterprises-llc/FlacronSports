import type { Firestore } from "firebase-admin/firestore"
import { brandedEmail } from "@/lib/email-service"
import { getDictionary, localePath } from "@/lib/i18n"
import type { Preferences } from "@/lib/me/preferences-defaults"
import type { SportEvent } from "@/lib/sports/types"
import { buildAlert, dueAlerts, followsEvent, suppressionReason, type DueAlert } from "./rules"

export const NOTIFICATIONS_COLLECTION = "notifications"
const ALREADY_EXISTS = 6

export interface NotificationRecord {
  uid: string
  eventId: string
  type: DueAlert
  title: string
  body: string
  spoilerFreeBody: string
  path: string
  locale: Preferences["locale"]
  createdAt: string
  emailStatus: "not_requested" | "sent" | "failed" | "no_address"
  kickoffUTC?: string | null
  /** uid#createdAt. A range on one field needs no composite index. */
  feedKey: string
}

/** The kickoff is part of a start alert's identity, so a moved event alerts again at its new time. */
export const notificationId = (uid: string, eventId: string, type: DueAlert, kickoffUTC?: string | null) =>
  `${uid}_${eventId}_${type}${type === "start" && kickoffUTC ? `_${Date.parse(kickoffUTC)}` : ""}`

/** create() fails on an existing document, so a duplicate is impossible rather than unlikely. */
export async function claimNotification(db: Firestore, record: NotificationRecord): Promise<boolean> {
  const ref = db.collection(NOTIFICATIONS_COLLECTION).doc(notificationId(record.uid, record.eventId, record.type, record.kickoffUTC))
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
  planFor(uid: string): Promise<"free" | "plus" | "premium">
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
}

async function deliver(deps: AlertDeps, user: UserRow, event: SportEvent, type: DueAlert, counts: AlertCounts): Promise<void> {
  const { db, now, siteUrl } = deps
  const { uid, prefs } = user
  const content = buildAlert(event, type, prefs)
  const path = `/app/match/${event.id}`
  const createdAt = now.toISOString()
  const record: NotificationRecord = {
    uid, eventId: event.id, type, ...content, path, locale: prefs.locale, createdAt, kickoffUTC: event.scheduledStartUTC,
    emailStatus: "not_requested", feedKey: `${uid}#${createdAt}`,
  }
  if (!(await claimNotification(db, record))) {
    counts.duplicate += 1
    return
  }
  counts.created += 1
  if (!prefs.alerts.email) return

  const { alerts: copy } = getDictionary(prefs.locale)
  const ref = db.collection(NOTIFICATIONS_COLLECTION).doc(notificationId(uid, event.id, type, event.scheduledStartUTC))
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

export async function runAlerts(deps: AlertDeps): Promise<AlertCounts> {
  const { events, now } = deps
  const counts: AlertCounts = { users: 0, created: 0, duplicate: 0, suppressed: 0, emailed: 0, emailFailed: 0, failed: 0 }
  const due = events.flatMap((event) => dueAlerts(event, now).map((type) => ({ event, type })))

  for await (const user of deps.users) {
    const { uid, prefs } = user
    if (!prefs.favorites.length || prefs.alerts.muted) continue
    const mine = due.filter(({ event }) => followsEvent(prefs.favorites, event))
    if (!mine.length) continue
    counts.users += 1
    try {
      const plan = await deps.planFor(uid)
      for (const { event, type } of mine) {
        if (suppressionReason(prefs, plan, type, now)) {
          counts.suppressed += 1
          continue
        }
        await deliver(deps, user, event, type, counts)
      }
    } catch (error) {
      counts.failed += 1
      console.error("Alert delivery failed", error instanceof Error ? error.message : "unknown")
    }
  }
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
    .filter((record) => record.uid === uid)
    .map(({ eventId, type, title, body, spoilerFreeBody, path, createdAt, kickoffUTC }) => ({
      id: notificationId(uid, eventId, type, kickoffUTC),
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
