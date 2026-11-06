"use client"

import { useCallback, useEffect, useState } from "react"
import { Trophy, Users } from "lucide-react"
import { CopyButton, ErrorNotice, useConfirm } from "@/components/dashboard/controls"
import { btn, EmptyState, ListSkeleton, Notice, Panel, Skeleton } from "@/components/site/states"
import { authFetch } from "@/lib/auth-fetch"
import type { Badge } from "@/lib/community/badges"
import { useLocale } from "@/lib/use-locale"
import { cn } from "@/lib/utils"
import { BadgeList } from "./badge-list"
import { useCommunityGate } from "./community-gate"

interface GroupRow {
  id: string
  name: string
  role: "owner" | "member"
  memberCount: number
}

interface GroupDetail {
  name: string
  memberCount: number
  cap: number
  isOwner: boolean
  inviteActive: boolean
  entries: { rank: number; points: number; ref: string; displayName: string; role: string; mine: boolean; badges: Badge[] }[]
}

const ERRORS: Record<string, "groupLimit" | "groupFull" | "inviteInvalid" | "removedFromGroup" | "sanctioned"> = {
  group_limit: "groupLimit",
  group_full: "groupFull",
  invite_invalid: "inviteInvalid",
  removed_from_group: "removedFromGroup",
  sanctioned: "sanctioned",
}

function GroupInvite({ token }: { token: string }) {
  const { t, href } = useLocale()
  const link = `${window.location.origin}${href(`/app/predictions/join/${token}`)}`
  return (
    <div className="mt-3 rounded-lg border border-line bg-surface-muted p-3">
      <p className="text-sm text-ink-2">{t.community.inviteOnce}</p>
      <label className="mt-2 block text-sm font-medium text-ink">
        {t.community.inviteLink}
        <input readOnly value={link} onFocus={(event) => event.target.select()} className="fs-input mt-1 h-10 px-3 text-sm" />
      </label>
      <div className="mt-2"><CopyButton value={link} label={t.community.copy} done={t.community.copied} /></div>
    </div>
  )
}

function GroupView({ id, onClosed, firstInvite }: { id: string; onClosed(): void; firstInvite: string | null }) {
  const { t } = useLocale()
  const { confirm, dialog } = useConfirm()
  const [detail, setDetail] = useState<GroupDetail | null>(null)
  const [failed, setFailed] = useState(false)
  const [invite, setInvite] = useState(firstInvite)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setFailed(false)
    const response = await authFetch(`/api/groups/${id}`).catch(() => null)
    if (response?.ok) setDetail(await response.json())
    else setFailed(true)
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const act = async (path: string, method: "POST" | "DELETE") => {
    setNotice(null)
    const response = await authFetch(path, { method }).catch(() => null)
    if (!response?.ok) setNotice(t.community.sendFailed)
    return response?.ok ? response : null
  }

  const rotate = async (method: "POST" | "DELETE") => {
    const response = await act(`/api/groups/${id}/invite`, method)
    if (!response) return
    setInvite(method === "POST" ? (await response.json()).inviteToken : null)
    await load()
  }

  const remove = async (ref: string) => {
    if (await act(`/api/groups/${id}/members/${ref}`, "DELETE")) await load()
  }

  const leave = async () => {
    if ((await confirm(t.community.confirmLeaveGroup)) && (await act(`/api/groups/${id}/members/me`, "DELETE"))) onClosed()
  }

  const close = async () => {
    if ((await confirm(t.community.confirmCloseGroup, true)) && (await act(`/api/groups/${id}`, "DELETE"))) onClosed()
  }

  return (
    <Panel
      title={detail?.name ?? t.community.leaderboard}
      description={detail ? `${t.community.participants} ${detail.memberCount} / ${detail.cap}` : undefined}
      icon={<Trophy aria-hidden />}
      actions={detail && (detail.isOwner ? <button type="button" className={btn("danger", "sm")} onClick={close}>{t.community.closeGroup}</button> : <button type="button" className={btn("outline", "sm")} onClick={leave}>{t.community.leaveGroup}</button>)}
    >
      {dialog}
      {failed && <ErrorNotice onRetry={load}>{t.community.groupFailed}</ErrorNotice>}
      {!detail && !failed && <div role="status" aria-label={t.ui.loading} className="space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-16 w-full" /></div>}
      {notice && <div className="mb-3"><Notice tone="danger" role="alert">{notice}</Notice></div>}
      {detail && (
        <>
          <ol className="divide-y divide-line text-sm">
            {detail.entries.map((entry) => (
              <li key={entry.ref} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                <span className="tabular w-6 shrink-0 text-right font-semibold text-ink-2">{entry.rank}</span>
                <span className="min-w-0 flex-1">
                  <span className={cn("truncate font-medium", entry.mine ? "text-hot-text" : "text-ink")}>{entry.displayName}</span>{" "}
                  <BadgeList badges={entry.badges} />
                </span>
                <span className="tabular shrink-0 font-semibold text-ink">{entry.points}</span>
                {detail.isOwner && entry.role !== "owner" && <button type="button" className={btn("ghost", "sm")} onClick={() => remove(entry.ref)}>{t.community.remove}<span className="sr-only">: {entry.displayName}</span></button>}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[13px] leading-5 text-ink-2">{t.community.groupRules}</p>
          {detail.isOwner && (
            <div className="mt-3 border-t border-line pt-3">
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btn("outline", "sm")} onClick={() => rotate("POST")}>{t.community.newInvite}</button>
                {detail.inviteActive && <button type="button" className={btn("ghost", "sm")} onClick={() => rotate("DELETE")}>{t.community.revokeInvite}</button>}
              </div>
              {invite && <GroupInvite token={invite} />}
            </div>
          )}
        </>
      )}
    </Panel>
  )
}

export function GroupsPanel({ inviteToken = null }: { inviteToken?: string | null }) {
  const { t, href } = useLocale()
  const gate = useCommunityGate()
  const [groups, setGroups] = useState<GroupRow[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [invited, setInvited] = useState(inviteToken)
  const [created, setCreated] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setFailed(false)
    const response = await authFetch("/api/groups").catch(() => null)
    if (response?.ok) setGroups((await response.json()).groups)
    else setFailed(true)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const failure = (data: { code?: string } | null | undefined) => setNotice(t.community[ERRORS[data?.code ?? ""] ?? "sendFailed"])

  const create = async () => {
    setNotice(null)
    const response = await authFetch("/api/groups", { method: "POST", body: JSON.stringify({ name }) }).catch(() => null)
    const data = await response?.json().catch(() => null)
    if (!response?.ok) return gate.intercept(data?.code, create) || failure(data)
    setName("")
    setCreated(data.inviteToken)
    setSelected(data.id)
    await load()
  }

  const join = async () => {
    setNotice(null)
    const response = await authFetch("/api/groups/join", { method: "POST", body: JSON.stringify({ token: invited }) }).catch(() => null)
    const data = await response?.json().catch(() => null)
    if (!response?.ok) return gate.intercept(data?.code, join) || failure(data)
    setInvited(null)
    window.history.replaceState(null, "", href("/app/predictions"))
    setSelected(data.id)
    await load()
  }

  return (
    <section aria-label={t.community.groupsTitle} className="space-y-4">
      <h2 className="text-base font-semibold text-ink">{t.community.groupsTitle}</h2>
      {notice && <Notice tone="danger" role="alert">{notice}</Notice>}
      {gate.prompt}
      {invited && <Notice tone="info" title={t.community.groupInvited} action={<button type="button" onClick={join} className={btn("primary")}>{t.community.joinGroup}</button>}>{t.community.groupRules}</Notice>}
      <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          {failed && <ErrorNotice onRetry={load}>{t.community.groupFailed}</ErrorNotice>}
          {!groups && !failed && <div role="status" aria-label={t.ui.loading}><ListSkeleton rows={2} /></div>}
          {groups && groups.length > 0 && (
            <ul aria-label={t.community.groupsTitle} className="space-y-2">
              {groups.map((group) => (
                <li key={group.id}>
                  <button type="button" aria-pressed={selected === group.id} onClick={() => { setSelected(group.id); setCreated(null) }} className={cn("fs-lift flex w-full items-center gap-3 rounded-xl border bg-surface p-3 text-left shadow-[var(--shadow-sm)]", selected === group.id ? "border-orange" : "border-line")}>
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-brand"><Users aria-hidden className="size-4" /></span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{group.name}</span>
                    <span className="tabular rounded-full bg-surface-muted px-2 py-0.5 text-xs font-semibold text-ink-2" aria-label={`${t.community.participants} ${group.memberCount}`}>{group.memberCount}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={(event) => { event.preventDefault(); void create() }} className="space-y-3 rounded-xl border border-line bg-surface p-4">
            <label className="block text-sm font-medium text-ink">{t.community.groupName}<input className="fs-input mt-1 h-10 px-3 text-sm" required maxLength={60} value={name} onChange={(event) => setName(event.target.value)} /></label>
            <button type="submit" className={btn("primary", "md", "w-full")}>{t.community.createGroup}</button>
          </form>
        </div>
        <div className="min-w-0">
          {selected ? (
            <GroupView key={selected} id={selected} firstInvite={created} onClosed={() => { setSelected(null); setCreated(null); void load() }} />
          ) : (
            <EmptyState compact icon={<Trophy aria-hidden />} title={groups?.length === 0 ? t.community.noGroups : t.community.pickGroup} body={t.community.groupsLead} />
          )}
        </div>
      </div>
    </section>
  )
}
