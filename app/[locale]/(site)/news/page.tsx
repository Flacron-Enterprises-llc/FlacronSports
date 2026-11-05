import type { Metadata } from "next"
import Link from "next/link"
import { EmptyState, PageHeader } from "@/components/site/states"
import { LocalTime } from "@/components/sports/parts"
import { listPublishedReports } from "@/lib/content/reports"
import { pageContext } from "@/lib/page-context"

export const metadata: Metadata = { title: "News" }
export const dynamic = "force-dynamic"

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string }> }

export default async function NewsPage({ params, searchParams }: Props) {
  const { locale, t, href } = await pageContext(params)
  const q = ((await searchParams).q ?? "").trim().slice(0, 80)
  const { state, reports } = await listPublishedReports(locale)

  const needle = q.toLowerCase()
  const shown = reports.filter((report) => !needle || [report.title, report.competition, ...report.participants].some((text) => text.toLowerCase().includes(needle)))

  return (
    <main id="main" className="mx-auto max-w-7xl px-4 sm:px-6">
      <PageHeader title={t.news.title} lead={t.news.lead} />

      {state === "unavailable" && <p role="alert" className="rounded-lg border border-line bg-surface p-3 text-sm text-bad">{t.reports.unavailable}</p>}
      {state === "ok" && reports.length === 0 && <EmptyState title={t.news.empty} body={t.news.emptyBody} action={{ href: href("/scores"), label: t.news.cta }} />}

      {reports.length > 0 && (
        <>
          <form className="flex flex-wrap items-end gap-3">
            <label className="min-w-56 flex-1 text-sm font-medium text-ink">
              {t.reports.search}
              <input type="search" name="q" defaultValue={q} className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2 text-ink" />
            </label>
            <button type="submit" className="rounded-md bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-deep">{t.reports.searchButton}</button>
          </form>
          <p className="mt-3 text-xs leading-5 text-ink-3">{t.reports.labelHelp}</p>

          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((report) => (
              <li key={report.id} className="rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-sm)]">
                <p className="text-xs font-semibold text-hot-text">{t.reports.label}</p>
                <h2 className="mt-1 font-semibold text-ink">
                  <Link href={href(`/news/${report.slug}`)} className="underline-offset-2 hover:underline">{report.title}</Link>
                </h2>
                <p className="mt-1 text-sm text-ink-2">{report.competition}</p>
                <p className="mt-3 border-t border-line pt-3 text-xs text-ink-3">
                  {t.reports.source}: {report.sources.map((source) => source.provider).join(", ")}
                  {report.publishedAt && <> · <LocalTime iso={report.publishedAt} mode="datetime" /></>}
                </p>
              </li>
            ))}
          </ul>
          {shown.length === 0 && <p className="mt-4 text-sm text-ink-2">{t.reports.noMatches}</p>}
        </>
      )}
    </main>
  )
}
