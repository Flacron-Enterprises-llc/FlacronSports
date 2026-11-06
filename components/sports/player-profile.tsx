"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { User } from "lucide-react"
import { ErrorNotice } from "@/components/dashboard/controls"
import { DetailSkeleton, EmptyState, PageHeader, Panel } from "@/components/site/states"
import { FollowPlayerButton } from "@/components/sports/event-actions"
import { FavoriteStar } from "@/components/sports/parts"
import { authFetch } from "@/lib/auth-fetch"
import { TEAM_SPORTS, type PlayerProfile } from "@/lib/sports/player"
import { SPORTS } from "@/lib/sports/types"
import { useLocale } from "@/lib/use-locale"

export function PlayerProfileView({ id }: { id: string }) {
  const { locale, t, href } = useLocale()
  const copy = t.discover
  const [player, setPlayer] = useState<PlayerProfile | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "missing" | "failed">("loading")

  const load = useCallback(async () => {
    setState("loading")
    const response = await authFetch(`/api/players/${encodeURIComponent(id)}`).catch(() => null)
    if (response?.status === 404) return setState("missing")
    if (!response?.ok) return setState("failed")
    setPlayer(((await response.json()) as { player: PlayerProfile }).player)
    setState("ready")
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (state === "loading") return <div role="status" aria-label={t.ui.loading}><DetailSkeleton /></div>
  if (state === "failed") return <ErrorNotice onRetry={load}>{copy.playerFailed}</ErrorNotice>
  if (state === "missing" || !player) return <EmptyState icon={<User aria-hidden />} title={copy.playerNotFound} body={copy.playerNotFoundBody} action={{ href: href("/app/search"), label: copy.searchTitle }} />

  const sport = SPORTS.find((item) => item.id === player.sportId)
  const born = player.born ? new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${player.born}T12:00:00Z`)) : null
  const facts: [string, string | null][] = [
    [copy.position, player.position], [copy.nationality, player.nationality], [copy.born, born],
    [copy.number, player.number], [copy.height, player.height], [copy.weight, player.weight],
  ]
  const shown = facts.filter(([, value]) => value)
  const follow = TEAM_SPORTS.includes(player.sportId)
    ? <FollowPlayerButton player={{ id: player.id, name: player.name, team: player.team, sportId: player.sportId }} />
    : <FavoriteStar team={player.name} />

  return (
    <>
      <PageHeader title={player.name} lead={sport?.name[locale]} icon={<User aria-hidden />} actions={<span className="rounded-lg border border-line bg-surface">{follow}</span>} />
      <Panel>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          {player.team && (
            <div className="min-w-0">
              <dt className="text-ink-2">{copy.team}</dt>
              <dd className="mt-0.5 font-medium text-ink"><Link href={href(`/app/team/${encodeURIComponent(player.team)}?sport=${player.sportId}`)} className="text-hot-text underline-offset-2 hover:underline">{player.team}</Link></dd>
            </div>
          )}
          {shown.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-ink-2">{label}</dt>
              <dd className="mt-0.5 font-medium text-ink">{value}</dd>
            </div>
          ))}
        </dl>
        {!player.team && shown.length === 0 && <p className="text-sm text-ink-2">{copy.playerNoDetails}</p>}
      </Panel>
    </>
  )
}
