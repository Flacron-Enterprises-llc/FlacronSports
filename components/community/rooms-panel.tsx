"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { authFetch } from "@/lib/auth-fetch"
import { useAuthUser } from "@/lib/hooks/useAuthUser"
import { useLocale } from "@/lib/use-locale"
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

const FIELD = "mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-ink"
const BUTTON = "rounded-md border border-line px-3 py-1.5 text-sm font-semibold text-ink hover:bg-surface-muted"

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
  const [copied, setCopied] = useState(false)
  const link = `${window.location.origin}${href(`/app/rooms/join/${token}`)}`

  const copy = async () => {
    await navigator.clipboard.writeText(link).then(() => setCopied(true)).catch(() => undefined)
  }

  return (
    <div className="mt-3">
      <p className="text-sm text-ink-2">{t.community.inviteOnce}</p>
      <label className="mt-1 block text-sm font-medium text-ink">
        {t.community.inviteLink}
        <input readOnly value={link} onFocus={(event) => event.target.select()} className={FIELD} />
      </label>
      <button type="button" className={`mt-2 ${BUTTON}`} onClick={copy}>{copied ? t.community.copied : t.community.copy}</button>
    </div>
  )
}

function RoomView({ id, onClosed }: { id: string; onClosed(): void }) {
  const { t } = useLocale()
  const [detail, setDetail] = useState<RoomDetail | null>(null)
  const [invite, setInvite] = useState<string | null>(null)

  const load = useCallback(async () => {
    const response = await authFetch(`/api/rooms/${id}`).catch(() => null)
    setDetail(response?.ok ? await response.json() : null)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const rotate = async (method: "POST" | "DELETE") => {
    const response = await authFetch(`/api/rooms/${id}/invite`, { method }).catch(() => null)
    if (response?.ok) setInvite((await response.json()).inviteToken)
    await load()
  }

  const remove = async (ref: string) => {
    await authFetch(`/api/rooms/${id}/members/${ref}`, { method: "DELETE" }).catch(() => null)
    await load()
  }

  const leave = async () => {
    await authFetch(`/api/rooms/${id}/members/me`, { method: "DELETE" }).catch(() => null)
    onClosed()
  }

  const close = async () => {
    await authFetch(`/api/rooms/${id}`, { method: "DELETE" }).catch(() => null)
    onClosed()
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      {detail && <p className="text-sm text-ink-2">{t.community.participants} {detail.room.memberCount} / {detail.room.participantCap}</p>}
      <p className="mt-1 text-sm text-ink-2">{t.community.independentVideo}</p>
      {detail && !detail.isHost && <button type="button" className={`mt-3 ${BUTTON}`} onClick={leave}>{t.community.leave}</button>}
      {detail?.isHost && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={BUTTON} onClick={() => rotate("POST")}>{t.community.newInvite}</button>
            <button type="button" className={BUTTON} onClick={() => rotate("DELETE")}>{t.community.revokeInvite}</button>
            <button type="button" className={BUTTON} onClick={close}>{t.community.closeRoom}</button>
          </div>
          {invite && <InviteLink token={invite} />}
          <ul className="space-y-1 text-sm text-ink-2">
            {detail.members.filter((member) => member.role !== "host").map((member) => (
              <li key={member.ref} className="flex items-center justify-between gap-2">
                {member.displayName}
                <button type="button" className={BUTTON} onClick={() => remove(member.ref)}>{t.community.remove}</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-4"><MessageList scope="room" scopeId={id} path={`/api/rooms/${id}/messages`} /></div>
    </section>
  )
}

export function RoomsPanel({ matchId, inviteToken = null }: { matchId: string | null; inviteToken?: string | null }) {
  const { t, href } = useLocale()
  const user = useAuthUser()
  const gate = useCommunityGate()
  const [rooms, setRooms] = useState<RoomRow[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [invited, setInvited] = useState(inviteToken)
  const [limit, setLimit] = useState("")
  const [created, setCreated] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    const response = await authFetch("/api/rooms").catch(() => null)
    if (response?.ok) setRooms((await response.json()).rooms)
  }, [])

  useEffect(() => {
    if (user) load()
  }, [user, load])

  if (!user) {
    return <p className="text-ink-2">{t.auth.required} <Link className="font-semibold text-hot-text underline" href={href("/signin")}>{t.nav.signIn}</Link></p>
  }

  const failed = (data: { code?: string } | null | undefined) => setNotice(t.community[ERRORS[data?.code ?? ""] ?? "sendFailed"])

  const createRoom = async () => {
    setNotice(null)
    const body = { matchId, name, ...(limit ? { participantLimit: Number(limit) } : {}) }
    const response = await authFetch("/api/rooms", { method: "POST", body: JSON.stringify(body) }).catch(() => null)
    const data = await response?.json().catch(() => null)
    if (!response?.ok) return gate.intercept(data?.code, createRoom) || failed(data)
    setCreated(data.inviteToken)
    setName("")
    setLimit("")
    await load()
  }

  const create = (event: React.FormEvent) => {
    event.preventDefault()
    createRoom()
  }

  const join = async () => {
    setNotice(null)
    const response = await authFetch("/api/rooms/join", { method: "POST", body: JSON.stringify({ token: invited }) }).catch(() => null)
    const data = await response?.json().catch(() => null)
    if (!response?.ok) return gate.intercept(data?.code, join) || failed(data)
    setInvited(null)
    window.history.replaceState(null, "", href("/app/rooms"))
    setSelected(data.id)
    await load()
  }

  return (
    <div className="space-y-5">
      {notice && <p role="status" className="rounded-lg border border-line bg-surface p-3 text-sm text-ink">{notice}</p>}
      {gate.prompt}
      {invited && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-sm font-semibold text-ink">{t.community.invited}</p>
          <p className="mt-1 text-sm text-ink-2">{t.community.independentVideo}</p>
          <button type="button" onClick={join} className="mt-3 rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep">{t.community.join}</button>
        </section>
      )}
      {rooms.length === 0 && <p className="text-sm text-ink-2">{t.community.noRooms}</p>}
      <ul className="space-y-2">
        {rooms.map((room) => (
          <li key={room.id}>
            <button type="button" aria-pressed={selected === room.id} onClick={() => setSelected(room.id)} className="w-full rounded-lg border border-line bg-surface p-3 text-left text-sm font-semibold text-ink hover:bg-surface-muted">
              {room.name} · {room.memberCount}
            </button>
          </li>
        ))}
      </ul>
      {selected && <RoomView key={selected} id={selected} onClosed={() => { setSelected(null); load() }} />}

      <p className="text-sm text-ink-2">{t.community.joinHelp}</p>

      {matchId ? (
        <form onSubmit={create} className="rounded-2xl border border-line bg-surface p-5">
          <label className="block text-sm font-medium text-ink">{t.community.roomName}<input className={FIELD} required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="mt-3 block text-sm font-medium text-ink">{t.community.participantLimit}<input className={FIELD} type="number" min={2} max={50} value={limit} onChange={(e) => setLimit(e.target.value)} /></label>
          <button type="submit" className="mt-3 rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep">{t.community.createRoom}</button>
          {created && <InviteLink token={created} />}
        </form>
      ) : (
        <p className="text-sm text-ink-2">{t.community.createFromMatch}</p>
      )}
    </div>
  )
}
