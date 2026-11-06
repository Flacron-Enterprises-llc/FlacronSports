import { Bell } from "lucide-react"
import { NotificationList } from "@/components/account/notification-list"
import { AppPage, PageHeader } from "@/components/site/states"
import { pageContext, titled, type LocaleParams } from "@/lib/page-context"

export const generateMetadata = titled((t) => t.notifications.title, { robots: { index: false } })

export default async function Page({ params }: LocaleParams) {
  const { t } = await pageContext(params)
  return (
    <AppPage width="sm">
      <PageHeader title={t.notifications.title} lead={t.notifications.lead} icon={<Bell aria-hidden />} />
      <NotificationList />
    </AppPage>
  )
}
