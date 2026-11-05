import type { Metadata } from "next"
import { NotificationList } from "@/components/account/notification-list"
import { PageHeader } from "@/components/site/states"
import { pageContext, type LocaleParams } from "@/lib/page-context"

export const metadata: Metadata = { title: "Notifications", robots: { index: false } }

export default async function NotificationsPage({ params }: LocaleParams) {
  const { t } = await pageContext(params)
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 sm:px-6">
      <PageHeader title={t.notifications.title} lead={t.notifications.lead} />
      <NotificationList />
    </main>
  )
}
