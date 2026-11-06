import Link from "next/link"
import { ArrowRight, Newspaper } from "lucide-react"
import { btn } from "@/components/site/states"
import { SportIcon } from "@/components/site/sport-icon"
import { LocalTime, SpoilerGuard } from "@/components/sports/parts"
import type { Report } from "@/lib/content/reports"
import type { Dictionary, Locale } from "@/lib/i18n"
import { SPORTS, type SportId } from "@/lib/sports/types"
import { cn } from "@/lib/utils"

export const newsChip = (active: boolean) =>
  cn("inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors", active ? "fs-chip-hot" : "border-line bg-surface text-ink-2 hover:text-ink")

/** The shared daily roundup has no single sport. */
export const sportOf = (report: Pick<Report, "sportId">, locale: Locale) => {
  const sport = SPORTS.find((item) => item.id === report.sportId)
  return sport ? { id: sport.id as SportId, name: sport.name[locale] } : null
}

export function ReportSportIcon({ report, className }: { report: Pick<Report, "sportId">; className?: string }) {
  const sport = SPORTS.find((item) => item.id === report.sportId)
  return sport ? <SportIcon id={sport.id} className={className} /> : <Newspaper aria-hidden className={className} />
}

const stamp = (report: Report) => report.publishedAt ?? report.updatedAt

export function NewsCard({ report, t, locale, href }: { report: Report; t: Dictionary; locale: Locale; href: (path: string) => string }) {
  const sport = sportOf(report, locale)
  return (
    <article className="fs-lift relative flex h-full min-w-0 flex-col rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-sm)]">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="fs-tint-brand inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-brand">
          <ReportSportIcon report={report} className="size-4" />
        </span>
        <p className="min-w-0 text-xs leading-5">
          <span className="block truncate font-semibold text-ink">{sport?.name ?? t.news.allSports}</span>
          {report.competition && <span className="block truncate text-ink-2">{report.competition}</span>}
        </p>
      </div>
      <h2 className="mt-3 text-[15px] font-semibold leading-6 text-ink">
        <Link href={href(`/app/news/${report.slug}`)} className="underline-offset-2 after:absolute after:inset-0 hover:underline">{report.title}</Link>
      </h2>
      <div className="mt-auto pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <span className="fs-chip-hot inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold">{t.reports.types[report.type]}</span>
          <span className="text-xs text-ink-3"><LocalTime iso={stamp(report)} mode="datetime" /></span>
        </div>
        <p className="mt-2 text-xs text-ink-3">{t.reports.label} · {t.reports.verifiedData}</p>
      </div>
    </article>
  )
}

export function LeadStory({ report, t, locale, href }: { report: Report; t: Dictionary; locale: Locale; href: (path: string) => string }) {
  const sport = sportOf(report, locale)
  const opening = report.body.split("\n")[0]
  return (
    <article className="fs-band relative flex h-full min-h-64 flex-col overflow-hidden rounded-2xl p-5 sm:p-7">
      <div aria-hidden className="fs-grid pointer-events-none absolute inset-0" />
      <div className="relative flex flex-wrap items-center gap-2 text-xs font-semibold text-white/85">
        <span className="rounded-full bg-white/10 px-2.5 py-1">{t.news.topStory}</span>
        <span className="rounded-full bg-white/10 px-2.5 py-1">{t.reports.types[report.type]}</span>
      </div>
      <div className="relative mt-auto pt-8">
        <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-white/80">
          <ReportSportIcon report={report} className="size-4 shrink-0" />
          <span className="min-w-0 truncate">{[sport?.name, report.competition].filter(Boolean).join(" · ") || t.news.allSports}</span>
        </p>
        <h2 className="mt-2 text-2xl font-semibold leading-tight text-white sm:text-[1.75rem]">
          <Link href={href(`/app/news/${report.slug}`)} className="underline-offset-4 hover:underline">{report.title}</Link>
        </h2>
        {report.type === "preview"
          ? <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80">{opening}</p>
          : <div className="mt-3 max-w-2xl text-sm leading-6 text-white/80"><SpoilerGuard quiet label={t.reports.reveal}><p>{opening}</p></SpoilerGuard></div>}
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href={href(`/app/news/${report.slug}`)} className={btn("primary", "sm")}>{t.reports.read}<ArrowRight aria-hidden className="size-3.5" /></Link>
          <span className="text-xs text-white/70"><LocalTime iso={stamp(report)} mode="datetime" /> · {t.reports.label}</span>
        </div>
      </div>
    </article>
  )
}
