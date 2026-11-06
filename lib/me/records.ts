import type { Firestore } from "firebase-admin/firestore"

/** Personal records outside the preference, message and community stores. Export and deletion share this list. */
export async function userOwnedRecords(db: Firestore, uid: string) {
  const [compareViews, follows, assistantUsage, savedReports, calendarSubscriptions, calendarFeeds] = await Promise.all([
    db.collection("compare_views").where("uid", "==", uid).get(),
    db.collection("user-follows").where("userId", "==", uid).get(),
    db.collection("assistant_usage").where("uid", "==", uid).get(),
    db.collection("saved_reports").where("uid", "==", uid).get(),
    db.collection("user_calendar_feeds").where("uid", "==", uid).get(),
    db.collection("calendar_feeds").where("uid", "==", uid).get(),
  ])
  return { compareViews: compareViews.docs, follows: follows.docs, assistantUsage: assistantUsage.docs, savedReports: savedReports.docs, calendarSubscriptions: calendarSubscriptions.docs, calendarFeeds: calendarFeeds.docs }
}
