"use client"

import Link from "next/link"
import { ArrowDown, ArrowRight, ArrowUp, Bell, Star, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useAccount } from "@/components/dashboard/account-context"
import { EmptyState, Meter, Panel } from "@/components/site/states"
import { EventCard } from "@/components/sports/event-card"
import { Crest, LocalTime } from "@/components/sports/parts"
import { PLANS } from "@/lib/billing/plans"
import { favoriteTotal } from "@/lib/me/preferences-defaults"
import { followPriority, isFollowed, moveItem } from "@/lib/sports/following"
import { canHaveTable } from "@/lib/sports/calculated"
import { playerPath } from "@/lib/sports/player"
import { byStatusThenTime } from "@/lib/sports/priority"
import type { EventFeed, SportId } from "@/lib/sports/types"
import { useLocale } from "@/lib/use-locale"
import { MatchCalendar } from "./match-calendar"
import { usePreferences, type MutateResult } from "./prefs-provider"

const ROW = "flex min-h-14 min-w-0 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 shadow-[var(--shadow-sm)]"
const ICON = "inline-flex size-10 shrink-0 items-center justify-center rounded-md text-ink-2 hover:bg-surface-muted hover:text-ink disabled:pointer-events-none disabled:opacity-35"

function Order({ name, index, count, onMove }: { name: string; index: number; count: number; onMove(delta: -1 | 1): void }) {
  const { t } = useLocale()
  return (
    <span className="flex shrink-0">
      <button type="button" disabled={index === 0} onClick={() => onMove(-1)} aria-label={`${t.discover.moveUp}: ${name}`} title={t.discover.moveUp} className={ICON}><ArrowUp aria-hidden className="size-4" /></button>
      <button type="button" disabled={index === count - 1} onClick={() => onMove(1)} aria-label={`${t.discover.moveDown}: ${name}`} title={t.discover.moveDown} className={ICON}><ArrowDown aria-hidden className="size-4" /></button>
    </span>
  )
}

function RemoveButton({ name, onPress }: { name: string; onPress(): void }) {
  const { t } = useLocale()
  return <button type="button" onClick={onPress} aria-label={`${t.myTeams.remove}: ${name}`} title={t.myTeams.remove} className={`${ICON} hover:text-bad`}><Trash2 aria-hidden className="size-4" /></button>
}

export function MyTeams({ feed }: { feed: EventFeed }) {
  const { t, href } = useLocale()
  const copy = t.discover
  const { prefs, mutate } = usePreferences()
  const { plan, loaded } = useAccount()
  const limit = PLANS[plan].favoritesLimit
  const total = favoriteTotal(prefs)
  const { favorites: names, leagues, players, reminders } = prefs

  const save = async (build: Parameters<typeof mutate>[0]) => {
    const result: MutateResult = await mutate(build)
    if (result !== "saved") toast(t.ui.saveFailed)
  }

  const calendarLinks = (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
      <Link href={href("/app/settings#calendar")} className="text-hot-text hover:underline">{copy.feedManage}</Link>
      <Link href={href("/app/settings#alerts")} className="text-hot-text hover:underline">{copy.alertSettings}</Link>
    </p>
  )

  if (total === 0 && reminders.length === 0) {
    return <EmptyState icon={<Star aria-hidden />} title={t.myTeams.empty} body={t.myTeams.emptyBody} action={{ href: href("/app/scores"), label: t.myTeams.browse }} />
  }

  const today = feed.events
    .filter((event) => isFollowed(prefs, event))
    .sort((a, b) => followPriority(prefs, a) - followPriority(prefs, b) || byStatusThenTime(a, b))

  return (
    <div className="space-y-6">
      {loaded && limit !== null && (
        <Panel className="p-4 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium text-ink">{t.ui.favoritesUsed.replace("{count}", String(total)).replace("{limit}", String(limit))}</span>
            <Link href={href("/app/billing#plans")} data-fcge-upgrade="any" className="font-semibold text-hot-text hover:underline">{t.dash.upgrade}</Link>
          </div>
          <Meter value={total} max={limit} label={t.myTeams.following} className="mt-2" />
        </Panel>
      )}

      {names.length > 0 && (
        <section aria-label={copy.teamsAthletes}>
          <h2 className="text-[17px] font-semibold text-ink">{copy.teamsAthletes}</h2>
          <p className="mt-0.5 text-[13px] text-ink-2">{copy.priorityHelp}</p>
          <ul className="fs-settle mt-2 grid gap-2.5 sm:grid-cols-2">
            {names.map((name, index) => (
              <li key={name} className={ROW}>
                <Crest name={name} />
                <Link href={href(`/app/team/${encodeURIComponent(name)}`)} className="min-w-0 flex-1 truncate font-medium text-ink underline-offset-2 hover:underline">{name}</Link>
                <Order name={name} index={index} count={names.length} onMove={(delta) => save((current) => ({ favorites: moveItem(current.favorites, current.favorites.indexOf(name), delta) }))} />
                <Link href={href(`/app/scores?q=${encodeURIComponent(name)}`)} aria-label={`${t.nav.scores}: ${name}`} title={t.nav.scores} className={ICON}><ArrowRight aria-hidden className="size-4" /></Link>
                <RemoveButton name={name} onPress={() => save((current) => ({ favorites: current.favorites.filter((item) => item !== name) }))} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {leagues.length > 0 && (
        <section aria-label={copy.leagues}>
          <h2 className="text-[17px] font-semibold text-ink">{copy.leagues}</h2>
          <ul className="mt-2 grid gap-2.5 sm:grid-cols-2">
            {leagues.map((league, index) => (
              <li key={league.id} className={ROW}>
                <Link href={href(league.sportId === "football" || canHaveTable(league.sportId as SportId, league.name) ? `/app/standings/${league.id}` : `/app/league/${league.id}`)} className="min-w-0 flex-1 truncate font-medium text-ink underline-offset-2 hover:underline">{league.name}</Link>
                <Order name={league.name} index={index} count={leagues.length} onMove={(delta) => save((current) => ({ leagues: moveItem(current.leagues, current.leagues.findIndex((item) => item.id === league.id), delta) }))} />
                <RemoveButton name={league.name} onPress={() => save((current) => ({ leagues: current.leagues.filter((item) => item.id !== league.id) }))} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {players.length > 0 && (
        <section aria-label={copy.players}>
          <h2 className="text-[17px] font-semibold text-ink">{copy.players}</h2>
          <ul className="mt-2 grid gap-2.5 sm:grid-cols-2">
            {players.map((player) => (
              <li key={player.id} className={ROW}>
                <span className="min-w-0 flex-1">
                  <Link href={href(playerPath(player.id))} className="block truncate font-medium text-ink underline-offset-2 hover:underline">{player.name}</Link>
                  {player.team && <span className="block truncate text-xs text-ink-2">{player.team}</span>}
                </span>
                <RemoveButton name={player.name} onPress={() => save((current) => ({ players: current.players.filter((item) => item.id !== player.id) }))} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <MatchCalendar />

      {reminders.length > 0 && (
        <Panel title={copy.reminders} description={copy.remindersHelp} icon={<Bell aria-hidden />}>
          <ul className="divide-y divide-line">
            {reminders.map((reminder) => (
              <li key={reminder.eventId} className="flex min-h-12 min-w-0 items-center gap-2 py-1 text-sm">
                <span className="min-w-0 flex-1">
                  <Link href={href(`/app/match/${reminder.eventId}`)} className="block truncate font-medium text-ink underline-offset-2 hover:underline">{reminder.title}</Link>
                  {reminder.startUTC && <span className="block text-xs text-ink-2"><LocalTime iso={reminder.startUTC} mode="datetime" /></span>}
                </span>
                <RemoveButton name={reminder.title} onPress={() => save((current) => ({ reminders: current.reminders.filter((item) => item.eventId !== reminder.eventId) }))} />
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {calendarLinks}

      {today.length > 0 && (
        <section aria-label={t.dash.favorites}>
          <h2 className="text-[17px] font-semibold text-ink">{t.dash.favorites}</h2>
          <div className="fs-settle mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {today.map((event) => <EventCard key={event.id} event={event} t={t} href={href} />)}
          </div>
        </section>
      )}
    </div>
  )
}
