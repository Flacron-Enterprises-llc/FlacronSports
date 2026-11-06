import Link from "next/link"
import { Newspaper, Search, X } from "lucide-react"
import { ErrorNotice } from "@/components/dashboard/controls"
import { AppPage, btn, EmptyState, PageHeader } from "@/components/site/states"
import { LocalTime } from "@/components/sports/parts"
import { listPublishedReports } from "@/lib/content/reports"
import { pageContext, titled } from "@/lib/page-context"

export const generateMetadata = titled((t) => t.news.title)
export const dynamic = "force-dynamic"

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string }> }

export default async function NewsPage({ params, searchParams }: Props) {
  const { locale, t, href } = await pageContext(params)
  const q = ((await searchParams).q ?? "").trim().slice(0, 80)
  const { state, reports } = await listPublishedReports(locale)

  const needle = q.toLowerCase()
  const shown = reports.filter((report) => !needle || [report.title, report.competition, ...report.participants].some((text) => text.toLowerCase().includes(needle)))

  return (
    <AppPage>
      <PageHeader title={t.news.title} lead={t.news.lead} icon={<Newspaper aria-hidden />} />

      {state === "unavailable" && <ErrorNotice>{t.reports.unavailable}</ErrorNotice>}
      {state === "ok" && reports.length === 0 && <EmptyState icon={<Newspaper aria-hidden />} title={t.news.empty} body={t.news.emptyBody} action={{ href: href("/app/scores"), label: t.news.cta }} />}

      {reports.length > 0 && (
        <>
          <form role="search" className="fs-rise relative max-w-xl">
            <label htmlFor="news-q" className="sr-only">{t.reports.search}</label>
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <input id="news-q" type="search" name="q" defaultValue={q} placeholder={t.reports.search} className="fs-input h-10 pl-9 pr-24 text-sm" />
            <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-1">
              {q && <Link href={href("/app/news")} aria-label={t.ui.clearSearch} className="inline-flex size-8 items-center justify-center rounded-md text-ink-3 hover:bg-surface-muted hover:text-ink"><X aria-hidden className="size-4" /></Link>}
              <button type="submit" className={btn("navy", "sm", "min-h-8")}>{t.reports.searchButton}</button>
            </div>
          </form>
          <p className="mt-3 text-xs leading-5 text-ink-3">{t.reports.labelHelp}</p>

          <ul className="fs-stagger mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((report) => (
              <li key={report.id} className="fs-lift flex min-w-0 flex-col rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-sm)]">
                <p className="text-xs font-semibold text-hot-text">{t.reports.label}</p>
                <h2 className="mt-1 text-[15px] font-semibold leading-6 text-ink">
                  <Link href={href(`/app/news/${report.slug}`)} className="underline-offset-2 hover:underline">{report.title}</Link>
                </h2>
                <p className="mt-1 text-sm text-ink-2">{report.competition}</p>
                <p className="mt-auto pt-3 text-xs text-ink-3">
                  <span className="block border-t border-line pt-3">
                    {t.reports.source}: {t.reports.verifiedData}
                    {report.publishedAt && <> · <LocalTime iso={report.publishedAt} mode="datetime" /></>}
                  </span>
                </p>
              </li>
            ))}
          </ul>
          {shown.length === 0 && <EmptyState className="mt-4" compact icon={<Search aria-hidden />} title={t.reports.noMatches} action={{ href: href("/app/news"), label: t.ui.clearFilters }} />}
        </>
      )}
    </AppPage>
  )
}
