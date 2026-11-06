import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowRight, Flag } from "lucide-react"
import { ErrorNotice } from "@/components/dashboard/controls"
import { MemberDataPending } from "@/components/dashboard/member-data-pending"
import { AppPage, Notice } from "@/components/site/states"
import { FullReportSection } from "@/components/reports/paid-report"
import { ReportSportIcon, sportOf } from "@/components/reports/news-card"
import { ReportAudio } from "@/components/reports/report-audio"
import { SaveReportButton } from "@/components/reports/saved-reports"
import { LocalTime, SpoilerGuard } from "@/components/sports/parts"
import { getPublishedReport, type Report } from "@/lib/content/reports"
import { isLocale } from "@/lib/i18n"
import { MemberAccessRequired } from "@/lib/member-fetch"
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
  } catch (error) {
    if (error instanceof MemberAccessRequired) return <MemberDataPending />
    failed = true
  }
  if (!report && !failed) notFound()

  const back = (
    <Link href={href("/app/news")} className="inline-flex min-h-8 items-center gap-1.5 text-sm font-semibold text-hot-text hover:underline">
      <ArrowLeft aria-hidden className="size-4" /> {t.reports.back}
    </Link>
  )

  if (!report) {
    return (
      <AppPage width="sm">
        {back}
        <div className="mt-5"><ErrorNotice>{t.reports.unavailable}</ErrorNotice></div>
      </AppPage>
    )
  }

  const subject = encodeURIComponent(`${t.reports.reportError}: ${report.title}`)

  return (
    <AppPage width="sm">
      {back}
      <header className="fs-band fs-rise relative mt-4 overflow-hidden rounded-2xl p-5 sm:p-8">
        <div aria-hidden className="fs-grid pointer-events-none absolute inset-0" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-white/85">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1"><ReportSportIcon report={report} className="size-3.5" />{sportOf(report, locale)?.name ?? t.news.allSports}</span>
            <span className="rounded-full bg-white/10 px-2.5 py-1">{t.reports.types[report.type]}</span>
            <span>{t.reports.label}</span>
          </div>
          <h1 className="mt-3 text-2xl font-semibold leading-tight text-white sm:text-[2rem]">{report.title}</h1>
          {report.competition && <p className="mt-2 text-sm text-white/80">{report.competition}</p>}
          {report.publishedAt && <p className="mt-1 text-xs text-white/70"><LocalTime iso={report.publishedAt} mode="datetime" /></p>}
        </div>
      </header>
      <article className="fs-rise mt-4 rounded-xl border border-line bg-surface p-5 shadow-[var(--shadow-sm)] sm:p-8">
        <SaveReportButton slug={report.slug} />
        <div className="mt-5 text-[15.5px] leading-7 text-ink">
          <SpoilerGuard label={t.reports.reveal}>
            <ReportAudio text={`${report.title}. ${report.body}`} />
            <p className="whitespace-pre-line">{report.body}</p>
          </SpoilerGuard>
        </div>
        {(report.type === "result" || report.type === "recap") && <FullReportSection slug={report.slug} />}
        {report.correctionNote && (
          <Notice className="mt-5" role="note" title={t.reports.correction}>
            <SpoilerGuard label={t.reports.reveal}>{report.correctionNote}</SpoilerGuard>
          </Notice>
        )}
        <p className="mt-5 text-xs leading-5 text-ink-3">{t.reports.labelHelp}</p>
        <dl className="mt-4 grid gap-3 border-t border-line pt-4 text-sm sm:grid-cols-3">
          {report.publishedAt && <div><dt className="text-ink-2">{t.reports.published}</dt><dd className="mt-0.5 font-medium text-ink"><LocalTime iso={report.publishedAt} mode="datetime" /></dd></div>}
          <div><dt className="text-ink-2">{t.reports.updated}</dt><dd className="mt-0.5 font-medium text-ink"><LocalTime iso={report.updatedAt} mode="datetime" /></dd></div>
          <div><dt className="text-ink-2">{t.reports.source}</dt><dd className="mt-0.5 font-medium text-ink">{t.reports.verifiedData}</dd></div>
        </dl>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
          {report.type !== "roundup" && <Link href={href(`/app/match/${report.matchId}`)} className="inline-flex items-center gap-1.5 text-hot-text hover:underline">{t.reports.matchLink}<ArrowRight aria-hidden className="size-3.5" /></Link>}
          <a href={`mailto:${CORRECTIONS_EMAIL}?subject=${subject}`} className="inline-flex items-center gap-1.5 text-ink-2 hover:text-ink hover:underline"><Flag aria-hidden className="size-3.5" />{t.reports.reportError}</a>
        </div>
      </article>
    </AppPage>
  )
}
