import Link from "next/link"
import { CalendarClock } from "lucide-react"
import { ErrorNotice } from "@/components/dashboard/controls"
import { MemberDataPending } from "@/components/dashboard/member-data-pending"
import { AppPage, EmptyState, Notice, PageHeader, Panel } from "@/components/site/states"
import { LocalTime } from "@/components/sports/parts"
import type { Dictionary, Locale } from "@/lib/i18n"
import { pageContext, titled, type LocaleParams } from "@/lib/page-context"
import { RACE_SERIES, type RaceWeekend } from "@/lib/sports/seasons"
import { getRaceSchedule } from "@/lib/sports/service"
import { cn } from "@/lib/utils"

export const generateMetadata = titled((t) => t.motorsport.title, { robots: { index: false } })
export const dynamic = "force-dynamic"

type Props = LocaleParams & { searchParams: Promise<{ series?: string }> }

function Weekend({ weekend, t, locale, href }: { weekend: RaceWeekend; t: Dictionary; locale: Locale; href(path: string): string }) {
  const copy = t.motorsport
  const day = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" })
  const place = [weekend.venue, weekend.country].filter(Boolean).join(", ")
  return (
    <Panel title={weekend.name} description={[weekend.round ? copy.round.replace("{round}", String(weekend.round)) : null, place || null].filter(Boolean).join(" · ") || undefined}>
      <ul className="divide-y divide-line">
        {weekend.sessions.map((session) => (
          <li key={session.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
            <Link href={href(`/app/match/${session.id}`)} aria-label={`${copy.sessionLink}: ${session.name ?? weekend.name}`} className="min-w-0 font-medium text-ink underline-offset-2 hover:underline">{session.name ?? weekend.name}</Link>
            <span className="shrink-0 text-right text-ink-2">
              {session.startUTC && !session.dateOnly && <LocalTime iso={session.startUTC} mode="datetime" />}
              {session.startUTC && session.dateOnly && <>{day.format(new Date(session.startUTC))} · {copy.timeTbc}</>}
              {!session.startUTC && copy.timeTbc}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
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

  return (
    <AppPage width="md">
      <PageHeader title={copy.title} lead={copy.lead} icon={<CalendarClock aria-hidden />} />
      <nav aria-label={copy.choose} className="fs-rise mb-5 flex flex-wrap gap-2">
        {RACE_SERIES.map((item) => (
          <Link key={item.id} href={href(`/app/motorsport?series=${item.id}`)} aria-current={item.id === chosen.id ? "page" : undefined} className={cn("inline-flex min-h-9 items-center rounded-lg border px-3 text-[13px] font-semibold transition-colors", item.id === chosen.id ? "border-navy bg-navy text-white" : "border-line bg-surface text-ink-2 hover:text-ink")}>{item.name}</Link>
        ))}
      </nav>

      {schedule.state === "unavailable" && <ErrorNotice>{copy.unavailable}</ErrorNotice>}
      {schedule.state === "empty" && <EmptyState icon={<CalendarClock aria-hidden />} title={copy.empty} body={copy.emptyBody} />}
      {schedule.state === "stale" && <Notice className="mb-4" tone="warning" role="status">{copy.stale}</Notice>}

      {schedule.items.length > 0 && (
        <div className="space-y-4">
          {upcoming.length > 0 && <h2 className="text-sm font-semibold text-ink-2">{copy.upcoming}: {schedule.competition} {schedule.season}</h2>}
          {upcoming.map((weekend) => <Weekend key={weekend.key} weekend={weekend} {...shared} />)}
          {earlier.length > 0 && (
            <details className="rounded-xl border border-line bg-surface p-4">
              <summary className="cursor-pointer text-sm font-semibold text-ink">{copy.earlier}</summary>
              <div className="mt-3 space-y-3">
                {earlier.map((weekend) => <Weekend key={weekend.key} weekend={weekend} {...shared} />)}
              </div>
            </details>
          )}
        </div>
      )}

      {schedule.state !== "unavailable" && <p className="mt-4 text-xs leading-5 text-ink-3">{t.feed.updated}: <LocalTime iso={schedule.fetchedAt} mode="datetime" /></p>}
    </AppPage>
  )
}
