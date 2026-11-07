"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Globe2, Newspaper, Search, Shield, Trophy, User } from "lucide-react"
import { ErrorNotice } from "@/components/dashboard/controls"
import { SportIcon } from "@/components/site/sport-icon"
import { CardGridSkeleton, chipClass, EmptyState, ListSkeleton, Notice, Panel, SectionHeading } from "@/components/site/states"
import { EventCard } from "@/components/sports/event-card"
import { FollowLeagueButton, FollowPlayerButton } from "@/components/sports/event-actions"
import { FavoriteStar, LocalTime } from "@/components/sports/parts"
import { authFetch } from "@/lib/auth-fetch"
import type { SearchResults as Results } from "@/lib/search/global"
import { canHaveTable } from "@/lib/sports/calculated"
import type { CompetitionHit } from "@/lib/search/match"
import { playerPath, TEAM_SPORTS } from "@/lib/sports/player"
import { useLocale } from "@/lib/use-locale"

const row = "flex min-h-11 min-w-0 items-center gap-2.5 py-1"

function Competitions({ items, standings }: { items: CompetitionHit[]; standings: boolean }) {
  const { t, href } = useLocale()
  return (
    <ul className="divide-y divide-line">
      {items.map((item) => (
        <li key={item.id} className={row}>
          <SportIcon id={item.sportId} className="size-4 shrink-0 text-brand" />
          <span className="min-w-0 flex-1">
            <Link href={href(standings && (item.sportId === "football" || canHaveTable(item.sportId, item.name)) ? `/app/standings/${item.id}` : `/app/scores?q=${encodeURIComponent(item.name)}`)} className="block truncate text-sm font-medium text-ink underline-offset-2 hover:underline">{item.name}</Link>
            {item.today > 0 && <span className="text-xs text-ink-2">{t.discover.gamesToday.replace("{count}", String(item.today))}</span>}
          </span>
          <FollowLeagueButton league={{ id: item.id, name: item.name, sportId: item.sportId }} />
        </li>
      ))}
    </ul>
  )
}

function Africa({ data }: { data: Results["africa"] }) {
  const { t, href } = useLocale()
  const copy = t.discover
  if (data.teams.length + data.competitions.length + data.fixtures.length === 0) return null
  return (
    <section aria-label={copy.africaTitle} className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-[17px] font-semibold text-ink"><Globe2 aria-hidden className="size-[18px] text-brand" /> {copy.africaTitle}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-2">{copy.africaLead}</p>
      </div>
      {data.fixtures.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-ink">{copy.africaFixtures}</h3>
          <div className="fs-settle mt-2 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.fixtures.map((event) => <EventCard key={event.id} event={event} t={t} href={href} />)}
          </div>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {data.teams.length > 0 && (
          <Panel title={copy.africaTeams} icon={<Shield aria-hidden />}>
            <ul className="flex flex-wrap gap-1.5">
              {data.teams.map((name) => (
                <li key={name}><Link href={href(`/app/team/${encodeURIComponent(name)}?sport=football`)} className={chipClass(false)}>{name}</Link></li>
              ))}
            </ul>
          </Panel>
        )}
        {data.competitions.length > 0 && <Panel title={copy.africaCompetitions} icon={<Trophy aria-hidden />}><Competitions items={data.competitions} standings /></Panel>}
      </div>
    </section>
  )
}

export function SearchResults() {
  const { locale, t, href } = useLocale()
  const copy = t.discover
  const params = useSearchParams()
  const q = (params?.get("q") ?? "").trim().slice(0, 80)
  const sport = params?.get("sport") ?? ""
  const [data, setData] = useState<Results | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading")

  const load = useCallback(async () => {
    setState("loading")
    const query = new URLSearchParams({ q, locale, ...(sport ? { sport } : {}) })
    const response = await authFetch(`/api/search?${query}`).catch(() => null)
    if (!response?.ok) return setState("failed")
    setData(await response.json())
    setState("ready")
  }, [q, locale, sport])

  useEffect(() => {
    void load()
  }, [load])

  if (state === "failed") return <ErrorNotice onRetry={load}>{copy.failed}</ErrorNotice>
  if (state === "loading" || !data) return <div role="status" aria-label={t.ui.loading} className="space-y-5"><ListSkeleton rows={3} /><CardGridSkeleton count={3} /></div>

  const named = q.length >= 2
  const total = data.teams.length + data.fixtures.length + data.competitions.length + data.players.length + data.reports.length

  return (
    <div className="space-y-7">
      {data.partial && <Notice tone="warning" role="status">{copy.partial}</Notice>}
      {!named && <p className="text-sm text-ink-2">{copy.typeMore}</p>}
      {named && total === 0 && <EmptyState compact icon={<Search aria-hidden />} title={copy.noResults} body={copy.noResultsBody} />}

      {data.fixtures.length > 0 && (
        <section aria-label={copy.fixtures}>
          <SectionHeading title={copy.fixtures} />
          <div className="fs-settle mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.fixtures.map((event) => <EventCard key={event.id} event={event} t={t} href={href} />)}
          </div>
        </section>
      )}

      {(data.teams.length > 0 || data.players.length > 0 || data.competitions.length > 0 || data.reports.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.teams.length > 0 && (
            <Panel title={copy.teams} icon={<Shield aria-hidden />}>
              <ul className="divide-y divide-line">
                {data.teams.map((team) => (
                  <li key={`${team.sportId}-${team.name}`} className={row}>
                    <SportIcon id={team.sportId} className="size-4 shrink-0 text-brand" />
                    <Link href={href(`/app/team/${encodeURIComponent(team.name)}?sport=${team.sportId}`)} className="min-w-0 flex-1 truncate text-sm font-medium text-ink underline-offset-2 hover:underline">{team.name}</Link>
                    <FavoriteStar team={team.name} />
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {data.players.length > 0 && (
            <Panel title={copy.players} icon={<User aria-hidden />}>
              <ul className="divide-y divide-line">
                {data.players.map((player) => (
                  <li key={player.id} className={row}>
                    <SportIcon id={player.sportId} className="size-4 shrink-0 text-brand" />
                    <span className="min-w-0 flex-1">
                      <Link href={href(playerPath(player.id))} className="block truncate text-sm font-medium text-ink underline-offset-2 hover:underline">{player.name}</Link>
                      {player.team && <span className="block truncate text-xs text-ink-2">{player.team}</span>}
                    </span>
                    {TEAM_SPORTS.includes(player.sportId) ? <FollowPlayerButton player={{ id: player.id, name: player.name, team: player.team, sportId: player.sportId }} /> : <FavoriteStar team={player.name} />}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {data.competitions.length > 0 && <Panel title={copy.competitions} icon={<Trophy aria-hidden />}><Competitions items={data.competitions} standings /></Panel>}
          {data.reports.length > 0 && (
            <Panel title={copy.reports} icon={<Newspaper aria-hidden />}>
              <ul className="divide-y divide-line">
                {data.reports.map((report) => (
                  <li key={report.id} className="py-2">
                    <Link href={href(`/app/news/${report.slug}`)} className="block text-sm font-medium leading-5 text-ink underline-offset-2 hover:underline">{report.title}</Link>
                    <p className="mt-0.5 truncate text-xs text-ink-2">{report.competition}{report.publishedAt && <> · <LocalTime iso={report.publishedAt} mode="datetime" /></>}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      )}

      <Africa data={data.africa} />
    </div>
  )
}
