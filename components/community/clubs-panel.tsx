"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Flag } from "lucide-react"
import { ErrorNotice } from "@/components/dashboard/controls"
import { btn, EmptyState, ListSkeleton, Notice, Panel } from "@/components/site/states"
import { authFetch } from "@/lib/auth-fetch"
import { useLocale } from "@/lib/use-locale"
import { clubName } from "./club-view"
import { useCommunityGate } from "./community-gate"

interface MyClub {
  id: string
  name: string
  kind: "team" | "sport"
  sportId: string
  members: number
}

interface ClubList {
  mine: MyClub[]
  sports: { id: string; sportId: string; name: string; members: number; joined: boolean }[]
  followed: string[]
}

export function ClubsPanel() {
  const { t, href, locale } = useLocale()
  const router = useRouter()
  const gate = useCommunityGate()
  const [list, setList] = useState<ClubList | null>(null)
  const [failed, setFailed] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setFailed(false)
    const response = await authFetch("/api/clubs").catch(() => null)
    if (response?.ok) setList(await response.json())
    else setFailed(true)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const join = async (body: object) => {
    setNotice(null)
    const response = await authFetch("/api/clubs", { method: "POST", body: JSON.stringify(body) }).catch(() => null)
    const data = await response?.json().catch(() => null)
    if (response?.ok) return router.push(href(`/app/clubs/${data.id}`))
    if (gate.intercept(data?.code, () => join(body))) return
    setNotice(data?.code === "team_not_found" ? t.community.teamNotFound : data?.code === "removed_from_club" ? t.community.removedFromClub : data?.code === "sanctioned" ? t.community.sanctioned : t.community.sendFailed)
  }

  const members = (count: number) => t.community.clubMembers.replace("{count}", String(count))

  if (failed) return <ErrorNotice onRetry={load}>{t.community.clubsFailed}</ErrorNotice>
  if (!list) return <div role="status" aria-label={t.ui.loading}><ListSkeleton rows={4} /></div>

  return (
    <div className="space-y-5">
      {notice && <Notice tone="danger" role="alert">{notice}</Notice>}
      {gate.prompt}
      <Panel title={t.community.yourClubs} icon={<Flag aria-hidden />}>
        {list.mine.length === 0 ? (
          <EmptyState compact title={t.community.noClubs} body={t.community.noClubsBody} />
        ) : (
          <ul className="divide-y divide-line text-sm">
            {list.mine.map((club) => (
              <li key={club.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <Link href={href(`/app/clubs/${club.id}`)} className="min-w-0 truncate font-semibold text-hot-text hover:underline">{clubName(club, locale)}</Link>
                <span className="tabular shrink-0 text-ink-2">{members(club.members)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {list.followed.length > 0 && (
        <Panel title={t.community.teamClubs} description={t.community.teamClubsLead}>
          <ul className="divide-y divide-line text-sm">
            {list.followed.map((team) => (
              <li key={team} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <span className="min-w-0 truncate font-medium text-ink">{team}</span>
                <button type="button" className={btn("outline", "sm")} onClick={() => join({ kind: "team", team })}>{t.community.joinClub}<span className="sr-only">: {team}</span></button>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <Panel title={t.community.sportClubs}>
        <ul className="divide-y divide-line text-sm">
          {list.sports.map((club) => (
            <li key={club.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
              <span className="min-w-0"><span className="block truncate font-medium text-ink">{clubName({ ...club, kind: "sport" }, locale)}</span><span className="tabular text-xs text-ink-2">{members(club.members)}</span></span>
              {club.joined ? (
                <Link href={href(`/app/clubs/${club.id}`)} className={btn("ghost", "sm")}>{t.community.openClub}<span className="sr-only">: {club.name}</span></Link>
              ) : (
                <button type="button" className={btn("outline", "sm")} onClick={() => join({ kind: "sport", sportId: club.sportId })}>{t.community.joinClub}<span className="sr-only">: {club.name}</span></button>
              )}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}
