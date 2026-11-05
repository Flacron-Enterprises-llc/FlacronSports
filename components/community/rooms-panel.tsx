"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { authFetch } from "@/lib/auth-fetch"
import { useAuthUser } from "@/lib/hooks/useAuthUser"
import { useLocale } from "@/lib/use-locale"
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
  members: { uid: string; displayName: string; role: string }[]
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

  const remove = async (uid: string) => {
    await authFetch(`/api/rooms/${id}/members/${uid}`, { method: "DELETE" }).catch(() => null)
    await load()
  }

  const close = async () => {
    await authFetch(`/api/rooms/${id}`, { method: "DELETE" }).catch(() => null)
    onClosed()
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      {detail && <p className="text-sm text-ink-2">{t.community.participants} {detail.room.memberCount} / {detail.room.participantCap}</p>}
      <p className="mt-1 text-sm text-ink-2">{t.community.independentVideo}</p>
      {detail?.isHost && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={BUTTON} onClick={() => rotate("POST")}>{t.community.newInvite}</button>
            <button type="button" className={BUTTON} onClick={() => rotate("DELETE")}>{t.community.revokeInvite}</button>
            <button type="button" className={BUTTON} onClick={close}>{t.community.closeRoom}</button>
          </div>
          {invite && <code className="block break-all rounded-md border border-line bg-surface-muted p-2 text-xs text-ink">{invite}</code>}
          <ul className="space-y-1 text-sm text-ink-2">
            {detail.members.filter((member) => member.role !== "host").map((member) => (
              <li key={member.uid} className="flex items-center justify-between gap-2">
                {member.displayName}
                <button type="button" className={BUTTON} onClick={() => remove(member.uid)}>{t.community.remove}</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-4"><MessageList scope="room" scopeId={id} path={`/api/rooms/${id}/messages`} /></div>
    </section>
  )
}

export function RoomsPanel({ matchId }: { matchId: string | null }) {
  const { t, href } = useLocale()
  const user = useAuthUser()
  const [rooms, setRooms] = useState<RoomRow[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [token, setToken] = useState("")
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

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    setNotice(null)
    const response = await authFetch("/api/rooms", { method: "POST", body: JSON.stringify({ matchId, name }) }).catch(() => null)
    const data = await response?.json().catch(() => null)
    if (!response?.ok) return failed(data)
    setCreated(data.inviteToken)
    setName("")
    await load()
  }

  const join = async (event: React.FormEvent) => {
    event.preventDefault()
    setNotice(null)
    const response = await authFetch("/api/rooms/join", { method: "POST", body: JSON.stringify({ token: token.trim() }) }).catch(() => null)
    const data = await response?.json().catch(() => null)
    if (!response?.ok) return failed(data)
    setToken("")
    setSelected(data.id)
    await load()
  }

  return (
    <div className="space-y-5">
      {notice && <p role="status" className="rounded-lg border border-line bg-surface p-3 text-sm text-ink">{notice}</p>}
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

      <form onSubmit={join} className="rounded-2xl border border-line bg-surface p-5">
        <label className="block text-sm font-medium text-ink">{t.community.inviteToken}<input className={FIELD} required value={token} onChange={(e) => setToken(e.target.value)} /></label>
        <button type="submit" className="mt-3 rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep">{t.community.join}</button>
      </form>

      {matchId ? (
        <form onSubmit={create} className="rounded-2xl border border-line bg-surface p-5">
          <label className="block text-sm font-medium text-ink">{t.community.roomName}<input className={FIELD} required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} /></label>
          <button type="submit" className="mt-3 rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep">{t.community.createRoom}</button>
          {created && (
            <div className="mt-3">
              <p className="text-sm text-ink-2">{t.community.inviteOnce}</p>
              <code className="mt-1 block break-all rounded-md border border-line bg-surface-muted p-2 text-xs text-ink">{created}</code>
            </div>
          )}
        </form>
      ) : (
        <p className="text-sm text-ink-2">{t.community.createFromMatch}</p>
      )}
    </div>
  )
}
