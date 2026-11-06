import { Star } from "lucide-react"
import { MyTeams } from "@/components/account/my-teams"
import { AppPage, PageHeader } from "@/components/site/states"
import { pageContext, titled, type LocaleParams } from "@/lib/page-context"
import { getEvents } from "@/lib/sports/service"

export const dynamic = "force-dynamic"
export const generateMetadata = titled((t) => t.myTeams.title, { robots: { index: false } })

export default async function MyTeamsPage({ params }: LocaleParams) {
  const { t } = await pageContext(params)
  const feed = await getEvents()
  return (
    <AppPage width="md">
      <PageHeader title={t.myTeams.title} lead={t.myTeams.lead} icon={<Star aria-hidden />} />
      <MyTeams feed={feed} />
    </AppPage>
  )
}
