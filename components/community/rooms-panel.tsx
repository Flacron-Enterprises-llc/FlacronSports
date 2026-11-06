"use client"

import { useCallback, useEffect, useState } from "react"
import { MessagesSquare, Plus, Users } from "lucide-react"
import { useAccount } from "@/components/dashboard/account-context"
import { CopyButton, ErrorNotice, useConfirm } from "@/components/dashboard/controls"
import { btn, EmptyState, ListSkeleton, Notice, Panel, Skeleton } from "@/components/site/states"
import { authFetch } from "@/lib/auth-fetch"
import { useLocale } from "@/lib/use-locale"
import { cn } from "@/lib/utils"
import { useCommunityGate } from "./community-gate"
import { MessageList } from "./message-list"

interface RoomRow {
  id: string
  role: "host" | "member"
  name: string
  matchId: string
  memberCount: number
  expiresAtUTC: string
}

interface RoomDetail {
  isHost: boolean
  room: { participantCap: number; memberCount: number; inviteActive: boolean }
  members: { ref: string; displayName: string; role: string }[]
}

const ERRORS: Record<string, "planRequired" | "roomLimit" | "roomFull" | "inviteInvalid" | "removedFromRoom" | "expired"> = {
  plan_required: "planRequired",
  room_limit: "roomLimit",
  room_full: "roomFull",
  invite_invalid: "inviteInvalid",
  removed_from_room: "removedFromRoom",
  room_expired: "expired",
}

/** The token is only ever shown as part of the link a host shares. */
function InviteLink({ token }: { token: string }) {
  const { t, href } = useLocale()
  const link = `${window.location.origin}${href(`/app/rooms/join/${token}`)}`
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

function RoomView({ id, name, onClosed }: { id: string; name: string; onClosed(): void }) {
  const { t } = useLocale()
  const { confirm, dialog } = useConfirm()
  const [detail, setDetail] = useState<RoomDetail | null>(null)
  const [failed, setFailed] = useState(false)
  const [invite, setInvite] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setFailed(false)
    const response = await authFetch(`/api/rooms/${id}`).catch(() => null)
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
    const response = await act(`/api/rooms/${id}/invite`, method)
    if (!response) return
    setInvite(method === "POST" ? (await response.json()).inviteToken : null)
    await load()
  }

  const remove = async (ref: string) => {
    if (await act(`/api/rooms/${id}/members/${ref}`, "DELETE")) await load()
  }

  const leave = async () => {
    if (await confirm(t.ui.confirmLeave)) {
      if (await act(`/api/rooms/${id}/members/me`, "DELETE")) onClosed()
    }
  }

  const close = async () => {
    if (await confirm(t.ui.confirmCloseRoom, true)) {
      if (await act(`/api/rooms/${id}`, "DELETE")) onClosed()
    }
  }

  return (
    <Panel
      title={name}
      description={detail ? `${t.community.participants} ${detail.room.memberCount} / ${detail.room.participantCap}` : undefined}
      icon={<MessagesSquare aria-hidden />}
      actions={detail && (detail.isHost ? <button type="button" className={btn("danger", "sm")} onClick={close}>{t.community.closeRoom}</button> : <button type="button" className={btn("outline", "sm")} onClick={leave}>{t.community.leave}</button>)}
    >
      {dialog}
      {failed && <ErrorNotice onRetry={load}>{t.community.loadFailed}</ErrorNotice>}
      {!detail && !failed && <div role="status" aria-label={t.ui.loading} className="space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-16 w-full" /></div>}
      <p className="text-[13px] leading-5 text-ink-2">{t.community.independentVideo}</p>
      {notice && <div className="mt-3"><Notice tone="danger" role="alert">{notice}</Notice></div>}
      {detail?.isHost && (
        <div className="mt-3 border-t border-line pt-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn("outline", "sm")} onClick={() => rotate("POST")}>{t.community.newInvite}</button>
            {detail.room.inviteActive && <button type="button" className={btn("ghost", "sm")} onClick={() => rotate("DELETE")}>{t.community.revokeInvite}</button>}
          </div>
          {invite && <InviteLink token={invite} />}
          {detail.members.some((member) => member.role !== "host") && (
            <ul className="mt-3 divide-y divide-line text-sm text-ink">
              {detail.members.filter((member) => member.role !== "host").map((member) => (
                <li key={member.ref} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="min-w-0 truncate">{member.displayName}</span>
                  <button type="button" className={btn("ghost", "sm")} onClick={() => remove(member.ref)}>{t.community.remove}<span className="sr-only">: {member.displayName}</span></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="mt-4 border-t border-line pt-4"><MessageList scope="room" scopeId={id} path={`/api/rooms/${id}/messages`} /></div>
    </Panel>
  )
}

export function RoomsPanel({ matchId, inviteToken = null }: { matchId: string | null; inviteToken?: string | null }) {
  const { t, href } = useLocale()
  const { user } = useAccount()
  const gate = useCommunityGate()
  const [rooms, setRooms] = useState<RoomRow[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [invited, setInvited] = useState(inviteToken)
  const [limit, setLimit] = useState("")
  const [created, setCreated] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setFailed(false)
    const response = await authFetch("/api/rooms").catch(() => null)
    if (response?.ok) setRooms((await response.json()).rooms)
    else setFailed(true)
  }, [])

  useEffect(() => {
    if (user) void load()
  }, [user, load])

  const failure = (data: { code?: string } | null | undefined) => setNotice(t.community[ERRORS[data?.code ?? ""] ?? "sendFailed"])

  const createRoom = async () => {
    setNotice(null)
    const body = { matchId, name, ...(limit ? { participantLimit: Number(limit) } : {}) }
    const response = await authFetch("/api/rooms", { method: "POST", body: JSON.stringify(body) }).catch(() => null)
    const data = await response?.json().catch(() => null)
    if (!response?.ok) return gate.intercept(data?.code, createRoom) || failure(data)
    setCreated(data.inviteToken)
    setName("")
    setLimit("")
    await load()
  }

  const join = async () => {
    setNotice(null)
    const response = await authFetch("/api/rooms/join", { method: "POST", body: JSON.stringify({ token: invited }) }).catch(() => null)
    const data = await response?.json().catch(() => null)
    if (!response?.ok) return gate.intercept(data?.code, join) || failure(data)
    setInvited(null)
    window.history.replaceState(null, "", href("/app/rooms"))
    setSelected(data.id)
    await load()
  }

  const current = rooms?.find((room) => room.id === selected)

  return (
    <div className="space-y-4">
      {notice && <Notice tone="danger" role="alert">{notice}</Notice>}
      {gate.prompt}
      {invited && (
        <Notice tone="info" title={t.community.invited} action={<button type="button" onClick={join} className={btn("primary")}>{t.community.join}</button>}>{t.community.independentVideo}</Notice>
      )}
      <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          {failed && <ErrorNotice onRetry={load}>{t.community.loadFailed}</ErrorNotice>}
          {!rooms && !failed && <div role="status" aria-label={t.ui.loading}><ListSkeleton rows={3} /></div>}
          {rooms && rooms.length > 0 && (
            <ul aria-label={t.community.roomsTitle} className="fs-stagger space-y-2">
              {rooms.map((room) => (
                <li key={room.id}>
                  <button type="button" aria-pressed={selected === room.id} onClick={() => setSelected(room.id)} className={cn("fs-lift flex w-full items-center gap-3 rounded-xl border bg-surface p-3 text-left shadow-[var(--shadow-sm)]", selected === room.id ? "border-orange" : "border-line")}>
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-brand"><Users aria-hidden className="size-4" /></span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{room.name}</span>
                    <span className="tabular rounded-full bg-surface-muted px-2 py-0.5 text-xs font-semibold text-ink-2" aria-label={`${t.community.participants} ${room.memberCount}`}>{room.memberCount}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {matchId ? (
            <Panel title={t.community.createRoom} icon={<Plus aria-hidden />}>
              <form onSubmit={(event) => { event.preventDefault(); void createRoom() }} className="space-y-3">
                <label className="block text-sm font-medium text-ink">{t.community.roomName}<input className="fs-input mt-1 h-10 px-3 text-sm" required maxLength={60} value={name} onChange={(event) => setName(event.target.value)} /></label>
                <label className="block text-sm font-medium text-ink">{t.community.participantLimit}<input className="fs-input mt-1 h-10 px-3 text-sm" type="number" min={2} max={50} value={limit} onChange={(event) => setLimit(event.target.value)} /></label>
                <button type="submit" className={btn("primary", "md", "w-full")}>{t.community.createRoom}</button>
              </form>
              {created && <InviteLink token={created} />}
            </Panel>
          ) : (
            <p className="text-[13px] leading-5 text-ink-2">{t.community.createFromMatch} {t.community.joinHelp}</p>
          )}
        </div>
        <div className="min-w-0">
          {selected && current ? (
            <RoomView key={selected} id={selected} name={current.name} onClosed={() => { setSelected(null); void load() }} />
          ) : rooms?.length === 0 ? (
            <EmptyState icon={<Users aria-hidden />} title={t.community.noRooms} body={t.community.createFromMatch} action={{ href: href("/app/scores"), label: t.myTeams.browse }} />
          ) : (
            <EmptyState compact icon={<MessagesSquare aria-hidden />} title={t.ui.pickRoom} />
          )}
        </div>
      </div>
    </div>
  )
}
