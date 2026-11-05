import type { Metadata } from "next"
import { EmptyState, PageHeader } from "@/components/site/states"
import { pageContext, type LocaleParams } from "@/lib/page-context"

export const metadata: Metadata = { title: "Watch" }

export default async function WatchPage({ params }: LocaleParams) {
  const { t, href } = await pageContext(params)
  return (
    <main id="main" className="mx-auto max-w-7xl px-4 sm:px-6">
      <PageHeader title={t.watch.title} lead={t.watch.lead} />
      <EmptyState title={t.watch.empty} body={t.watch.emptyBody} action={{ href: href("/app/scores"), label: t.watch.cta }} />
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {t.watch.sections.map((section) => (
          <li key={section} className="rounded-xl border border-line bg-surface p-4 text-sm font-semibold text-ink-2">{section}</li>
        ))}
      </ul>
      <p className="mt-6 text-sm leading-6 text-ink-2">{t.watch.disclaimer}</p>
    </main>
  )
}
