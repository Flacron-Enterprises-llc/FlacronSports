import { Bookmark } from "lucide-react"
import { SavedReports } from "@/components/reports/saved-reports"
import { AppPage, PageHeader } from "@/components/site/states"
import { pageContext, titled, type LocaleParams } from "@/lib/page-context"

export const generateMetadata = titled((t) => t.discover.saved, { robots: { index: false } })

export default async function SavedReportsPage({ params }: LocaleParams) {
  const { t } = await pageContext(params)
  return (
    <AppPage width="md">
      <PageHeader title={t.discover.saved} lead={t.discover.savedLead} icon={<Bookmark aria-hidden />} />
      <SavedReports />
    </AppPage>
  )
}
