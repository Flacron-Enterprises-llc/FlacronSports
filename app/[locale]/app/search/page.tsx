import { Suspense } from "react"
import { Search } from "lucide-react"
import { SearchResults } from "@/components/search/search-results"
import { AppPage, ListSkeleton, PageHeader } from "@/components/site/states"
import { pageContext, titled, type LocaleParams } from "@/lib/page-context"

export const generateMetadata = titled((t) => t.discover.searchTitle, { robots: { index: false } })

export default async function SearchPage({ params }: LocaleParams) {
  const { t } = await pageContext(params)
  return (
    <AppPage>
      <PageHeader title={t.discover.searchTitle} lead={t.discover.searchLead} icon={<Search aria-hidden />} />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <SearchResults />
      </Suspense>
    </AppPage>
  )
}
