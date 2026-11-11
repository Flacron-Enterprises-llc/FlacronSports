"use client"

import { useRef, useState } from "react"
import { Camera, Loader2, Trash2, UserRound } from "lucide-react"
import { toast } from "sonner"
import { updateProfile } from "firebase/auth"
import { useAccount } from "@/components/dashboard/account-context"
import { btn, Panel } from "@/components/site/states"
import { authFetch } from "@/lib/auth-fetch"
import { useLocale } from "@/lib/use-locale"
import { publishProfileChange, useProfile, UserAvatar } from "./user-avatar"

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"]
const MAX_SOURCE_BYTES = 10 * 1024 * 1024
const SIDE = 512

/** Squares the picture to its centre and scales it to 512 px, so uploads stay small. */
async function resize(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const target = Math.min(SIDE, side)
  const canvas = document.createElement("canvas")
  canvas.width = target
  canvas.height = target
  const context = canvas.getContext("2d")
  if (!context) throw new Error("canvas")
  context.imageSmoothingQuality = "high"
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, target, target)
  bitmap.close()
  return canvas.toDataURL("image/jpeg", 0.86).split(",")[1] ?? ""
}

/** Photo and display name, shared with the mobile app through the same account. */
export function ProfilePanel() {
  const { t } = useLocale()
  const { user } = useAccount()
  const profile = useProfile(user)
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<"photo" | "remove" | "name" | null>(null)
  const [name, setName] = useState(profile.name ?? "")

  async function refresh() {
    await user?.reload()
    await user?.getIdToken(true)
    publishProfileChange()
  }

  async function upload(file: File) {
    if (!ACCEPTED.includes(file.type)) return toast.error(t.settings.photoUnsupported)
    if (file.size > MAX_SOURCE_BYTES) return toast.error(t.settings.photoTooLarge)
    setBusy("photo")
    try {
      const image = await resize(file)
      const response = await authFetch("/api/me/avatar", { method: "PUT", body: JSON.stringify({ image }) })
      if (!response.ok) throw new Error(String(response.status))
      await refresh()
      toast.success(t.settings.photoSaved)
    } catch {
      toast.error(t.settings.photoFailed)
    } finally {
      setBusy(null)
      if (input.current) input.current.value = ""
    }
  }

  async function remove() {
    setBusy("remove")
    try {
      const response = await authFetch("/api/me/avatar", { method: "DELETE" })
      if (!response.ok) throw new Error(String(response.status))
      await refresh()
      toast.success(t.settings.photoRemoved)
    } catch {
      toast.error(t.settings.photoFailed)
    } finally {
      setBusy(null)
    }
  }

  async function saveName(event: React.FormEvent) {
    event.preventDefault()
    if (!user) return
    setBusy("name")
    try {
      await updateProfile(user, { displayName: name.trim() || null })
      await refresh()
      toast.success(t.settings.nameSaved)
    } catch {
      toast.error(t.settings.photoFailed)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Panel id="profile" title={t.settings.profile} icon={<UserRound aria-hidden />}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="flex items-center gap-4">
          <div className="relative">
            <UserAvatar user={user} className="size-20 text-xl" />
            {busy === "photo" && (
              <span className="absolute inset-0 inline-flex items-center justify-center rounded-full bg-black/45">
                <Loader2 aria-hidden className="size-6 animate-spin text-white" />
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">{t.settings.photo}</p>
            <p className="mt-0.5 max-w-xs text-[13px] leading-5 text-ink-2">{t.settings.photoHelp}</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button type="button" className={btn("outline", "sm")} disabled={busy !== null} onClick={() => input.current?.click()}>
                <Camera aria-hidden className="size-4" />
                {profile.photoURL ? t.settings.changePhoto : t.settings.uploadPhoto}
              </button>
              {profile.photoURL && (
                <button type="button" className={btn("ghost", "sm")} disabled={busy !== null} onClick={() => void remove()}>
                  {busy === "remove" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Trash2 aria-hidden className="size-4" />}
                  {t.settings.removePhoto}
                </button>
              )}
            </div>
            <input
              ref={input}
              type="file"
              accept={ACCEPTED.join(",")}
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void upload(file)
              }}
            />
          </div>
        </div>
      </div>

      <form onSubmit={saveName} className="mt-5 grid gap-3 border-t border-line pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="block min-w-0">
          <span className="text-sm font-medium text-ink">{t.settings.displayName}</span>
          <span className="mt-0.5 block text-[13px] leading-5 text-ink-2">{t.settings.displayNameHelp}</span>
          <input className="fs-input mt-2 h-10 w-full px-3 text-sm" value={name} maxLength={60} autoComplete="name" onChange={(event) => setName(event.target.value)} />
        </label>
        <button type="submit" className={btn("primary", "sm")} disabled={busy !== null || name.trim() === (profile.name ?? "")}>
          {busy === "name" && <Loader2 aria-hidden className="size-4 animate-spin" />}
          {t.settings.saveName}
        </button>
      </form>
      {profile.email && (
        <p className="mt-4 text-[13px] text-ink-2">
          {t.settings.email}: <span className="font-medium text-ink">{profile.email}</span>
        </p>
      )}
    </Panel>
  )
}
