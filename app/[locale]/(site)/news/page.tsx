import type { Metadata } from "next"
import { EmptyState, PageHeader } from "@/components/site/states"
import { pageContext, type LocaleParams } from "@/lib/page-context"

export const metadata: Metadata = { title: "News" }

export default async function NewsPage({ params }: LocaleParams) {
  const { t, href } = await pageContext(params)
  return (
    <main id="main" className="mx-auto max-w-7xl px-4 sm:px-6">
      <PageHeader title={t.news.title} lead={t.news.lead} />
      <EmptyState title={t.news.empty} body={t.news.emptyBody} action={{ href: href("/scores"), label: t.news.cta }} />
    </main>
  )
}
