import { DashboardHome } from "@/components/dashboard/dashboard-home"
import { pageContext, type LocaleParams } from "@/lib/page-context"
import { getEvents } from "@/lib/sports/service"

export const dynamic = "force-dynamic"

export default async function DashboardPage({ params }: LocaleParams) {
  const { t, href } = await pageContext(params)
  const feed = await getEvents()
  return <DashboardHome feed={feed} t={t} href={href} />
}
