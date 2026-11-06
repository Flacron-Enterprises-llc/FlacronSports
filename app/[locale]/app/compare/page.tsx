import { GitCompareArrows } from "lucide-react"
import { CompareTool } from "@/components/compare/compare-tool"
import { AppPage, PageHeader } from "@/components/site/states"
import { pageContext, titled, type LocaleParams } from "@/lib/page-context"
import { enabledSports } from "@/lib/sports/service"
import type { SportId } from "@/lib/sports/types"

export const generateMetadata = titled((t) => t.compare.title, { robots: { index: false } })

// Athletes and race entrants have no team record to compare.
const NOT_TEAM_SPORTS: SportId[] = ["tennis", "combat-sports", "motorsport"]

export default async function ComparePage({ params }: LocaleParams) {
  const { locale, t } = await pageContext(params)
  const sports = enabledSports().filter((sport) => !NOT_TEAM_SPORTS.includes(sport.id)).map((sport) => ({ id: sport.id, name: sport.name[locale] }))
  return (
    <AppPage width="md">
      <PageHeader title={t.compare.title} lead={t.compare.lead} icon={<GitCompareArrows aria-hidden />} />
      <CompareTool sports={sports} />
    </AppPage>
  )
}
