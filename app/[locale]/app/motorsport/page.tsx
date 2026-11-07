import Link from "next/link"
import { CalendarClock, ChevronRight } from "lucide-react"
import { ErrorNotice } from "@/components/dashboard/controls"
import { MemberDataPending } from "@/components/dashboard/member-data-pending"
import { AppPage, chipClass, EmptyState, Notice, PageHeader } from "@/components/site/states"
import { LocalTime } from "@/components/sports/parts"
import type { Dictionary, Locale } from "@/lib/i18n"
import { pageContext, titled, type LocaleParams } from "@/lib/page-context"
import { RACE_SERIES, type RaceWeekend } from "@/lib/sports/seasons"
import { getRaceSchedule } from "@/lib/sports/service"
import { cn } from "@/lib/utils"

export const generateMetadata = titled((t) => t.motorsport.title, { robots: { index: false } })
export const dynamic = "force-dynamic"

type Props = LocaleParams & { searchParams: Promise<{ series?: string }> }

function Weekend({ weekend, next, t, locale, href }: { weekend: RaceWeekend; next?: boolean; t: Dictionary; locale: Locale; href(path: string): string }) {
  const copy = t.motorsport
  const day = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" })
  const place = [weekend.venue, weekend.country].filter(Boolean).join(", ")
  // The feed gives the main race the weekend's own name, so a list of sessions would repeat the heading.
  const sessionName = (name: string | null) => name ?? (weekend.sessions.length > 1 ? t.sportTerms.sessions.race : weekend.name)
  return (
    <section aria-label={weekend.name} className={cn("flex min-w-0 flex-col overflow-hidden rounded-xl border bg-surface shadow-[var(--shadow-sm)]", next ? "border-orange" : "border-line")}>
      <header className="fs-foot flex items-start gap-3 border-b border-line px-4 py-3">
        {weekend.round !== null && <span className="tabular inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-navy font-display text-sm font-bold text-white dark:bg-brand dark:text-brand-on" aria-hidden>{weekend.round}</span>}
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold leading-5 text-ink">{weekend.name}</h2>
          {(weekend.round || place) && <p className="mt-0.5 text-xs leading-5 text-ink-2">{[weekend.round ? copy.round.replace("{round}", String(weekend.round)) : null, place || null].filter(Boolean).join(" · ")}</p>}
        </div>
      </header>
      <ul className="divide-y divide-line">
        {weekend.sessions.map((session) => (
          <li key={session.id} className="fs-row flex min-h-10 items-center justify-between gap-3 px-4 py-1.5 text-sm">
            <Link href={href(`/app/match/${session.id}`)} aria-label={`${copy.sessionLink}: ${sessionName(session.name)}`} className="min-w-0 font-medium text-ink underline-offset-2 hover:underline">{sessionName(session.name)}</Link>
            <span className="shrink-0 text-right text-[13px] text-ink-2">
              {session.startUTC && !session.dateOnly && <LocalTime iso={session.startUTC} mode="datetime" />}
              {session.startUTC && session.dateOnly && <span title={copy.timeTbc}>{day.format(new Date(session.startUTC))}</span>}
              {!session.startUTC && copy.timeTbc}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default async function MotorsportPage({ params, searchParams }: Props) {
  const { locale, t, href } = await pageContext(params)
  const { series } = await searchParams
  const chosen = RACE_SERIES.find((item) => item.id === series) ?? RACE_SERIES[0]
  const schedule = await getRaceSchedule(chosen.id)
  if (schedule.state === "withheld") return <MemberDataPending />
  const copy = t.motorsport
  const upcoming = schedule.items.filter((weekend) => !weekend.over)
  const earlier = schedule.items.filter((weekend) => weekend.over).reverse()
  const shared = { t, locale, href }
  const untimed = schedule.items.some((weekend) => weekend.sessions.some((session) => session.dateOnly))

  return (
    <AppPage>
      <PageHeader title={copy.title} lead={copy.lead} icon={<CalendarClock aria-hidden />} />
      <nav aria-label={copy.choose} className="fs-noscrollbar fs-rise -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {RACE_SERIES.map((item) => (
          <Link key={item.id} href={href(`/app/motorsport?series=${item.id}`)} aria-current={item.id === chosen.id ? "page" : undefined} className={chipClass(item.id === chosen.id)}>{item.name}</Link>
        ))}
      </nav>

      {schedule.state === "unavailable" && <ErrorNotice>{copy.unavailable}</ErrorNotice>}
      {schedule.state === "empty" && <EmptyState icon={<CalendarClock aria-hidden />} title={copy.empty} body={copy.emptyBody} />}
      {schedule.state === "stale" && <Notice className="mb-4" tone="warning" role="status">{copy.stale}</Notice>}

      {schedule.items.length > 0 && (
        <div className="space-y-4">
          {upcoming.length > 0 && (
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <h2 className="text-[17px] font-semibold text-ink">{copy.upcoming}: {schedule.competition} {schedule.season}</h2>
              {untimed && <p className="text-[13px] text-ink-2">{copy.timeTbc}</p>}
            </div>
          )}
          {upcoming.length > 0 && <div className="fs-settle grid items-start gap-3 lg:grid-cols-2">{upcoming.map((weekend, index) => <Weekend key={weekend.key} weekend={weekend} next={index === 0} {...shared} />)}</div>}
          {earlier.length > 0 && (
            <details className="rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-sm)]">
              <summary className="fs-summary flex min-h-8 cursor-pointer items-center gap-1 text-sm font-semibold text-ink"><ChevronRight aria-hidden className="fs-chevron size-4" />{copy.earlier}</summary>
              <div className="mt-3 grid items-start gap-3 lg:grid-cols-2">
                {earlier.map((weekend) => <Weekend key={weekend.key} weekend={weekend} {...shared} />)}
              </div>
            </details>
          )}
        </div>
      )}

      {schedule.state !== "unavailable" && <p className="mt-4 text-xs leading-5 text-ink-2">{t.feed.updated}: <LocalTime iso={schedule.fetchedAt} mode="datetime" /></p>}
    </AppPage>
  )
}
