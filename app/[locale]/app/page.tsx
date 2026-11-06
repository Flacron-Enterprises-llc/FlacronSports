import { DashboardHome } from "@/components/dashboard/dashboard-home"
import { listPublishedReports } from "@/lib/content/reports"
import { pageContext, titled, type LocaleParams } from "@/lib/page-context"
import { getEvents } from "@/lib/sports/service"

export const dynamic = "force-dynamic"
export const generateMetadata = titled((t) => t.dash.dashboard)

export default async function DashboardPage({ params }: LocaleParams) {
  const { locale } = await pageContext(params)
  const [feed, { reports }] = await Promise.all([getEvents(), listPublishedReports(locale, 30)])
  const teasers = reports.slice(0, 30).map(({ id, slug, title, competition, participants, publishedAt }) => ({ id, slug, title, competition, participants, publishedAt }))
  return <DashboardHome feed={feed} reports={teasers} />
}
