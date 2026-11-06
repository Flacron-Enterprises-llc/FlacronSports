"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Flag } from "lucide-react"
import { ErrorNotice, useConfirm } from "@/components/dashboard/controls"
import { btn, EmptyState, Notice, PageHeader, Panel, Skeleton } from "@/components/site/states"
import { authFetch } from "@/lib/auth-fetch"
import { SPORTS } from "@/lib/sports/types"
import { useLocale } from "@/lib/use-locale"
import { useCommunityGate } from "./community-gate"
import { MessageList } from "./message-list"

interface Club {
  id: string
  name: string
  kind: "team" | "sport"
  sportId: string
  members: number
  locked: boolean
  joined: boolean
}

/** A sport club is one club for every language, so its name follows the reader's. */
export function clubName(club: Pick<Club, "name" | "kind" | "sportId">, locale: "en" | "fr"): string {
  return (club.kind === "sport" && SPORTS.find((sport) => sport.id === club.sportId)?.name[locale]) || club.name
}

export function ClubView({ id }: { id: string }) {
  const { t, href, locale } = useLocale()
  const { confirm, dialog } = useConfirm()
  const gate = useCommunityGate()
  const [club, setClub] = useState<Club | null>(null)
  const [state, setState] = useState<"loading" | "missing" | "failed" | "ready">("loading")
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    const response = await authFetch(`/api/clubs/${id}`).catch(() => null)
    if (response?.ok) {
      setClub(await response.json())
      setState("ready")
    } else setState(response?.status === 404 ? "missing" : "failed")
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const join = async () => {
    setNotice(null)
    const response = await authFetch(`/api/clubs/${id}`, { method: "POST" }).catch(() => null)
    const data = await response?.json().catch(() => null)
    if (response?.ok) return load()
    if (gate.intercept(data?.code, join)) return
    setNotice(data?.code === "removed_from_club" ? t.community.removedFromClub : data?.code === "sanctioned" ? t.community.sanctioned : t.community.sendFailed)
  }

  const leave = async () => {
    if (!(await confirm(t.community.confirmLeaveClub))) return
    const response = await authFetch(`/api/clubs/${id}`, { method: "DELETE" }).catch(() => null)
    if (response?.ok) await load()
    else setNotice(t.community.sendFailed)
  }

  const back = <Link href={href("/app/clubs")} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-hot-text hover:underline"><ArrowLeft aria-hidden className="size-4" />{t.community.clubsTitle}</Link>

  if (state === "failed") return <>{back}<ErrorNotice onRetry={load}>{t.community.clubsFailed}</ErrorNotice></>
  if (state === "missing") return <>{back}<EmptyState icon={<Flag aria-hidden />} title={t.community.clubMissing} action={{ href: href("/app/clubs"), label: t.community.clubsTitle }} /></>
  if (!club) return <div role="status" aria-label={t.ui.loading} className="space-y-3"><Skeleton className="h-8 w-1/2" /><Skeleton className="h-40 w-full" /></div>

  return (
    <>
      {back}
      {dialog}
      <PageHeader
        title={clubName(club, locale)}
        lead={t.community.clubMembers.replace("{count}", String(club.members))}
        icon={<Flag aria-hidden />}
        actions={club.joined ? <button type="button" className={btn("outline", "sm")} onClick={leave}>{t.community.leaveClub}</button> : <button type="button" className={btn("primary")} onClick={join}>{t.community.joinClub}</button>}
      />
      {notice && <div className="mb-4"><Notice tone="danger" role="alert">{notice}</Notice></div>}
      {gate.prompt}
      {club.locked && <div className="mb-4"><Notice tone="warning" role="status">{t.community.locked}</Notice></div>}
      <Panel title={t.community.clubChat}>
        {club.joined ? <MessageList scope="room" scopeId={id} path={`/api/rooms/${id}/messages`} /> : <p className="text-sm text-ink-2">{t.community.clubJoinToChat}</p>}
      </Panel>
    </>
  )
}
