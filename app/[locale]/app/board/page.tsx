import { LayoutGrid } from "lucide-react"
import { AppPage, PageHeader } from "@/components/site/states"
import { MultiBoard } from "@/components/sports/multi-board"
import { pageContext, titled, type LocaleParams } from "@/lib/page-context"

export const generateMetadata = titled((t) => t.discover.boardTitle, { robots: { index: false } })

export default async function BoardPage({ params }: LocaleParams) {
  const { t } = await pageContext(params)
  return (
    <AppPage>
      <PageHeader title={t.discover.boardTitle} lead={t.discover.boardLead} icon={<LayoutGrid aria-hidden />} />
      <MultiBoard />
    </AppPage>
  )
}
