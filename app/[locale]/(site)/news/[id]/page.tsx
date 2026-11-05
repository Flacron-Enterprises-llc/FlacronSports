import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { LocalTime, SpoilerGuard } from "@/components/sports/parts"
import { getPublishedReport, type Report } from "@/lib/content/reports"
import { isLocale } from "@/lib/i18n"
import { pageContext } from "@/lib/page-context"

export const dynamic = "force-dynamic"

const CORRECTIONS_EMAIL = "contact@flacronenterprises.com"

type Props = { params: Promise<{ locale: string; id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params
  if (!isLocale(locale)) return {}
  const report = await getPublishedReport(id, locale).catch(() => null)
  return report ? { title: report.title } : { robots: { index: false } }
}

export default async function ReportPage({ params }: Props) {
  const { id } = await params
  const { locale, t, href } = await pageContext(params)

  let report: Report | null = null
  let failed = false
  try {
    report = await getPublishedReport(id, locale)
  } catch {
    failed = true
  }
  if (!report && !failed) notFound()

  const back = <Link href={href("/news")} className="text-sm font-semibold text-hot-text hover:underline">{t.reports.back}</Link>

  if (!report) {
    return (
      <main id="main" className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {back}
        <p role="alert" className="mt-6 rounded-lg border border-line bg-surface p-4 text-sm text-bad">{t.reports.unavailable}</p>
      </main>
    )
  }

  const subject = encodeURIComponent(`${t.reports.reportError}: ${report.title} (${report.id})`)

  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      {back}
      <article className="mt-6 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-md)]">
        <p className="text-xs font-semibold text-hot-text">{t.reports.label}</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">{report.title}</h1>
        <p className="mt-1 text-sm text-ink-2">{report.competition}</p>
        <div className="mt-5 leading-7 text-ink">
          <SpoilerGuard label={t.reports.reveal}><p>{report.body}</p></SpoilerGuard>
        </div>
        {report.correctionNote && (
          <aside className="mt-5 rounded-lg border border-line p-3 text-sm text-ink-2">
            <p className="font-semibold text-ink">{t.reports.correction}</p>
            <p className="mt-1">{report.correctionNote}</p>
          </aside>
        )}
        <p className="mt-5 text-xs leading-5 text-ink-3">{t.reports.labelHelp}</p>
        <dl className="mt-4 grid gap-3 border-t border-line pt-4 text-sm sm:grid-cols-3">
          {report.publishedAt && <div><dt className="text-ink-3">{t.reports.published}</dt><dd className="text-ink"><LocalTime iso={report.publishedAt} mode="datetime" /></dd></div>}
          <div><dt className="text-ink-3">{t.reports.updated}</dt><dd className="text-ink"><LocalTime iso={report.updatedAt} mode="datetime" /></dd></div>
          <div><dt className="text-ink-3">{t.reports.source}</dt><dd className="text-ink">{report.sources.map((source) => source.provider).join(", ")}</dd></div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold">
          <Link href={href(`/match/${report.matchId}`)} className="text-hot-text hover:underline">{t.reports.matchLink}</Link>
          <a href={`mailto:${CORRECTIONS_EMAIL}?subject=${subject}`} className="text-hot-text hover:underline">{t.reports.reportError}</a>
        </div>
      </article>
    </main>
  )
}
