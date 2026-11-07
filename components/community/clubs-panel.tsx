"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronRight, Flag } from "lucide-react"
import { ErrorNotice } from "@/components/dashboard/controls"
import { SportIcon } from "@/components/site/sport-icon"
import { btn, EmptyState, ListSkeleton, Notice, SectionHeading } from "@/components/site/states"
import { Crest } from "@/components/sports/parts"
import { authFetch } from "@/lib/auth-fetch"
import type { SportId } from "@/lib/sports/types"
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

  const tile = "flex min-w-0 items-center gap-3 rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow-sm)]"
  const mark = "inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-brand"

  return (
    <div className="space-y-5">
      {notice && <Notice tone="danger" role="alert">{notice}</Notice>}
      {gate.prompt}
      {list.mine.length === 0 ? (
        <EmptyState inline icon={<Flag aria-hidden />} title={t.community.noClubs} body={t.community.noClubsBody} />
      ) : (
        <section aria-label={t.community.yourClubs}>
          <SectionHeading title={t.community.yourClubs} />
          <ul className="fs-settle mt-2 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {list.mine.map((club) => (
              <li key={club.id}>
                <Link href={href(`/app/clubs/${club.id}`)} className={`fs-lift ${tile}`}>
                  <span className={mark}><SportIcon id={club.sportId as SportId} className="size-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{clubName(club, locale)}</span>
                    <span className="tabular block text-xs text-ink-2">{members(club.members)}</span>
                  </span>
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {list.followed.length > 0 && (
        <section aria-label={t.community.teamClubs}>
          <SectionHeading title={t.community.teamClubs} />
          <p className="text-[13px] leading-5 text-ink-2">{t.community.teamClubsLead}</p>
          <ul className="fs-settle mt-2 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {list.followed.map((team) => (
              <li key={team} className={tile}>
                <Crest name={team} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{team}</span>
                {!gate.locked && <button type="button" className={btn("outline", "sm")} onClick={() => join({ kind: "team", team })}>{t.community.joinClub}<span className="sr-only">: {team}</span></button>}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-label={t.community.sportClubs}>
        <SectionHeading title={t.community.sportClubs} />
        <ul className="fs-settle mt-2 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {list.sports.map((club) => (
            <li key={club.id} className={tile}>
              <span className={mark}><SportIcon id={club.sportId as SportId} className="size-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{clubName({ ...club, kind: "sport" }, locale)}</span>
                <span className="tabular block text-xs text-ink-2">{members(club.members)}</span>
              </span>
              {club.joined ? (
                <Link href={href(`/app/clubs/${club.id}`)} className={btn("ghost", "sm")}>{t.community.openClub}<span className="sr-only">: {club.name}</span></Link>
              ) : !gate.locked && (
                <button type="button" className={btn("outline", "sm")} onClick={() => join({ kind: "sport", sportId: club.sportId })}>{t.community.joinClub}<span className="sr-only">: {club.name}</span></button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
