"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { MessagesSquare, Plus, Users } from "lucide-react"
import { useAccount } from "@/components/dashboard/account-context"
import { ErrorNotice, ShareLink, useConfirm } from "@/components/dashboard/controls"
import { btn, EmptyState, Initials, ListSkeleton, Notice, Panel, Skeleton } from "@/components/site/states"
import { authFetch } from "@/lib/auth-fetch"
import { ROOM_PASS_PARTICIPANTS } from "@/lib/billing/addons"
import { PLANS } from "@/lib/billing/plans"
import { useLocale } from "@/lib/use-locale"
import { cn } from "@/lib/utils"
import { useCommunityGate } from "./community-gate"
import { MessageList } from "./message-list"
import { GamePicker } from "./upcoming-games"

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
  room: { participantCap: number; memberCount: number; inviteActive: boolean; locked: boolean; status: "active" | "closed"; expiresAtUTC: string }
  members: { ref: string; displayName: string; role: "host" | "member"; mine: boolean }[]
}

const ERRORS: Record<string, "planRequired" | "roomLimit" | "roomFull" | "inviteInvalid" | "removedFromRoom" | "expired" | "matchOver" | "sanctioned"> = {
  plan_required: "planRequired",
  room_limit: "roomLimit",
  room_full: "roomFull",
  invite_invalid: "inviteInvalid",
  removed_from_room: "removedFromRoom",
  room_expired: "expired",
  match_over: "matchOver",
  sanctioned: "sanctioned",
}

// Someone joining shows up for the host without a reload.
const MEMBERS_REFRESH_MS = 15_000

const hasEnded = (expiresAtUTC: string) => Date.now() >= Date.parse(expiresAtUTC)

/** The token is only ever shown as part of the link a host shares. */
function InviteLink({ token }: { token: string }) {
  const { t, href } = useLocale()
  const link = `${window.location.origin}${href(`/app/rooms/join/${token}`)}`
  return <ShareLink testId="room-invite-link" value={link} label={t.community.inviteLink} copy={t.community.copy} copied={t.community.copied} note={t.community.inviteOnce} />
}

/** A numbered step of the create form. */
function Step({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span aria-hidden className="tabular mt-px inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-navy text-[11px] font-semibold text-white dark:bg-brand dark:text-brand-on">{number}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  )
}

function RoomView({ id, name, matchId, firstInvite, onClosed, onGone }: { id: string; name: string; matchId: string; firstInvite: string | null; onClosed(): void; onGone(): void }) {
  const { t, href } = useLocale()
  const { confirm, dialog } = useConfirm()
  const [detail, setDetail] = useState<RoomDetail | null>(null)
  const [failed, setFailed] = useState(false)
  const [invite, setInvite] = useState(firstInvite)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    const response = await authFetch(`/api/rooms/${id}`).catch(() => null)
    if (response?.status === 404) return onGone()
    if (!response?.ok) return setFailed(true)
    const data: RoomDetail = await response.json()
    if (data.room.status !== "active") return onGone()
    setFailed(false)
    setDetail(data)
  }, [id, onGone])

  useEffect(() => {
    void load()
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) void load()
    }, MEMBERS_REFRESH_MS)
    return () => clearInterval(timer)
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

  const remove = async (ref: string, displayName: string) => {
    if (!(await confirm(t.community.confirmRemove.replace("{name}", displayName), true))) return
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

  const ended = detail ? hasEnded(detail.room.expiresAtUTC) : false

  return (
    <Panel
      id="room-view"
      title={name}
      description={detail ? `${t.community.participants} ${detail.room.memberCount} / ${detail.room.participantCap}` : undefined}
      icon={<MessagesSquare aria-hidden />}
      actions={detail && (detail.isHost ? <button type="button" className={btn("danger", "sm")} onClick={close}>{t.community.closeRoom}</button> : <button type="button" className={btn("outline", "sm")} onClick={leave}>{t.community.leave}</button>)}
    >
      {dialog}
      {failed && !detail && <ErrorNotice onRetry={load}>{t.community.loadFailed}</ErrorNotice>}
      {!detail && !failed && <div role="status" aria-label={t.ui.loading} className="space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-16 w-full" /></div>}
      <p className="text-[13px] leading-5 text-ink-2">{t.community.independentVideo} <Link href={href(`/app/match/${matchId}`)} className="font-semibold text-hot-text hover:underline">{t.community.openMatch}</Link></p>
      {notice && <div className="mt-3"><Notice tone="danger" role="alert">{notice}</Notice></div>}
      {detail && (
        <section aria-label={t.community.membersTitle} className="mt-3 border-t border-line pt-3">
          <h3 className="text-[13px] font-semibold text-ink">{t.community.membersTitle}</h3>
          <ul data-testid="room-members" className="mt-1.5 grid gap-1.5 text-sm text-ink sm:grid-cols-2">
            {detail.members.map((member) => (
              <li key={member.ref} data-testid="room-member" className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg bg-surface-muted px-2 py-1">
                <Initials name={member.displayName} mine={member.mine} className="size-7" />
                <span className="min-w-0 flex-1 truncate font-medium">{member.displayName}{member.mine && <span className="font-normal text-ink-2"> {t.community.you}</span>}</span>
                <span className="shrink-0 text-xs font-semibold text-ink-2">{member.role === "host" ? t.community.roleHost : t.community.roleMember}</span>
                {detail.isHost && member.role !== "host" && <button type="button" className={btn("ghost", "sm")} onClick={() => remove(member.ref, member.displayName)}>{t.community.remove}<span className="sr-only">: {member.displayName}</span></button>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {detail?.isHost && !ended && (
        <div className="mt-3 space-y-3 border-t border-line pt-3">
          {invite && <InviteLink token={invite} />}
          {!invite && <p className="text-[13px] leading-5 text-ink-2">{detail.room.inviteActive ? t.community.inviteActiveHint : t.community.noInviteActive}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn("outline", "sm")} onClick={() => rotate("POST")}>{t.community.newInvite}</button>
            {detail.room.inviteActive && <button type="button" className={btn("ghost", "sm")} onClick={() => rotate("DELETE")}>{t.community.revokeInvite}</button>}
          </div>
        </div>
      )}
      <div className="mt-4 border-t border-line pt-4">
        <MessageList scope="room" scopeId={id} path={`/api/rooms/${id}/messages`} closed={ended ? t.community.roomEndedBody : detail?.room.locked ? t.community.locked : null} />
      </div>
    </Panel>
  )
}

export function RoomsPanel({ matchId, inviteToken = null }: { matchId: string | null; inviteToken?: string | null }) {
  const { t, href } = useLocale()
  const { user, plan, addons, loaded } = useAccount()
  const gate = useCommunityGate()
  const [rooms, setRooms] = useState<RoomRow[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [game, setGame] = useState(matchId)
  const [name, setName] = useState("")
  const [invited, setInvited] = useState(inviteToken)
  const [limit, setLimit] = useState("")
  const [created, setCreated] = useState<{ id: string; token: string } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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
    if (!game) return setNotice(t.community.chooseGameFirst)
    setNotice(null)
    setBusy(true)
    const body = { matchId: game, name, ...(limit ? { participantLimit: Number(limit) } : {}) }
    const response = await authFetch("/api/rooms", { method: "POST", body: JSON.stringify(body) }).catch(() => null)
    const data = await response?.json().catch(() => null)
    setBusy(false)
    if (!response?.ok) return gate.intercept(data?.code, createRoom) || failure(data)
    setName("")
    setLimit("")
    await load()
    setCreated({ id: data.id, token: data.inviteToken })
    setSelected(data.id)
  }

  const join = async () => {
    setNotice(null)
    const response = await authFetch("/api/rooms/join", { method: "POST", body: JSON.stringify({ token: invited }) }).catch(() => null)
    const data = await response?.json().catch(() => null)
    if (!response?.ok) return gate.intercept(data?.code, join) || failure(data)
    setInvited(null)
    window.history.replaceState(null, "", href("/app/rooms"))
    await load()
    setSelected(data.id)
  }

  const closedRoom = useCallback(() => {
    setSelected(null)
    setCreated(null)
    void load()
  }, [load])

  const lostRoom = useCallback(() => {
    closedRoom()
    setNotice(t.community.roomGone)
  }, [closedRoom, t])

  const current = rooms?.find((room) => room.id === selected)
  const canHost = Boolean(PLANS[plan].privateRooms) || addons.includes("room")
  const maxParticipants = PLANS[plan].privateRooms?.participantsPerRoom ?? ROOM_PASS_PARTICIPANTS

  return (
    <div className="space-y-4">
      {notice && <Notice tone="danger" role="alert">{notice}</Notice>}
      {invited && (
        <Notice tone="info" title={t.community.invited} action={gate.locked ? undefined : <button type="button" onClick={join} data-testid="room-join" className={btn("primary")}>{t.community.join}</button>}>{t.community.independentVideo}</Notice>
      )}
      {invited && gate.prompt}
      <div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          {failed && <ErrorNotice onRetry={load}>{t.community.loadFailed}</ErrorNotice>}
          {!rooms && !failed && <div role="status" aria-label={t.ui.loading}><ListSkeleton rows={3} /></div>}
          {rooms && rooms.length > 0 && (
            <ul aria-label={t.community.roomsTitle} className="fs-settle space-y-2">
              {rooms.map((room) => (
                <li key={room.id}>
                  <button type="button" data-testid="room-row" aria-pressed={selected === room.id} onClick={() => { setSelected(room.id); setCreated(null) }} className={cn("fs-lift flex w-full items-center gap-3 rounded-xl border bg-surface p-3 text-left shadow-[var(--shadow-sm)]", selected === room.id ? "border-orange" : "border-line")}>
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-brand"><Users aria-hidden className="size-4" /></span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{room.name}</span>
                    {hasEnded(room.expiresAtUTC) && <span className="shrink-0 text-xs font-medium text-ink-2">{t.community.roomEnded}</span>}
                    <span className="tabular rounded-full bg-surface-muted px-2 py-0.5 text-xs font-semibold text-ink-2" aria-label={`${t.community.participants} ${room.memberCount}`}>{room.memberCount}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {loaded && !canHost && (
            <Notice tone="warning" role="status" title={t.community.createRoom} action={<Link href={href("/app/billing")} className={btn("outline", "sm")}>{t.community.upgradeRoom}</Link>}>{t.community.planRequired}</Notice>
          )}
          {loaded && canHost && (
            <Panel id="room-create" title={t.community.createRoom} icon={<Plus aria-hidden />}>
              {gate.locked ? (
                !invited && gate.prompt
              ) : (
                <form onSubmit={(event) => { event.preventDefault(); void createRoom() }}>
                  <ol className="space-y-4">
                    <Step number={1}><GamePicker value={game} onChange={setGame} presetMatch={matchId} /></Step>
                    <Step number={2}><label className="block text-sm font-medium text-ink">{t.community.roomName}<input data-testid="room-name" className="fs-input mt-1 h-10 px-3 text-sm" required maxLength={60} value={name} onChange={(event) => setName(event.target.value)} /></label></Step>
                    <Step number={3}>
                      <label className="block text-sm font-medium text-ink">
                        {t.community.participantLimit}
                        <input data-testid="room-limit" className="fs-input mt-1 h-10 px-3 text-sm" type="number" min={2} max={maxParticipants} value={limit} onChange={(event) => setLimit(event.target.value)} />
                        <span className="mt-1 block text-xs font-normal text-ink-2">{t.community.participantLimitHint.replace("{max}", String(maxParticipants))}</span>
                      </label>
                    </Step>
                  </ol>
                  <button type="submit" disabled={busy} data-testid="room-create-submit" className={btn("primary", "md", "mt-4 w-full")}>{t.community.createRoom}</button>
                </form>
              )}
            </Panel>
          )}
          <p className="text-[13px] leading-5 text-ink-2">{t.community.joinHelp}</p>
        </div>
        <div className="min-w-0">
          {selected && current ? (
            <RoomView key={selected} id={selected} name={current.name} matchId={current.matchId} firstInvite={created?.id === selected ? created.token : null} onClosed={closedRoom} onGone={lostRoom} />
          ) : rooms?.length === 0 ? (
            <EmptyState icon={<Users aria-hidden />} title={t.community.noRooms} body={t.community.noRoomsBody} action={{ href: href("/app/scores?status=upcoming"), label: t.myTeams.browse }} />
          ) : (
            <EmptyState compact icon={<MessagesSquare aria-hidden />} title={t.ui.pickRoom} />
          )}
        </div>
      </div>
    </div>
  )
}
