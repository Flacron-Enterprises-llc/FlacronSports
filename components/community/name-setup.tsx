"use client"

import { useState } from "react"
import { updateProfile, type User } from "firebase/auth"
import { btn } from "@/components/site/states"
import { useLocale } from "@/lib/use-locale"

const MIN_NAME = 2
const MAX_NAME = 40

/**
 * Email sign-ups never ask for a name, so such a member posts under the fallback until
 * they choose one. A new token carries it, which is what the server reads.
 */
export function NameSetup({ user }: { user: User }) {
  const { t } = useLocale()
  const [name, setName] = useState("")
  const [saved, setSaved] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user.displayName || saved) return null

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    const clean = name.trim()
    if (clean.length < MIN_NAME || clean.includes("@")) return setNotice(t.community.nameInvalid)
    setBusy(true)
    setNotice(null)
    try {
      await updateProfile(user, { displayName: clean })
      await user.getIdToken(true)
      setSaved(true)
    } catch {
      setNotice(t.community.sendFailed)
    }
    setBusy(false)
  }

  return (
    <form onSubmit={save} data-testid="community-name" className="mb-3 rounded-xl bg-surface-muted p-3 text-sm">
      <label className="block font-medium text-ink">
        {t.community.nameLabel}
        <span className="mt-0.5 block font-normal text-ink-2">{t.community.nameBody}</span>
        <input className="fs-input mt-2 h-10 px-3 text-sm" maxLength={MAX_NAME} value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <button type="submit" disabled={busy} className={btn("outline", "sm", "mt-2")}>{t.community.nameSave}</button>
      {notice && <p role="status" className="mt-2 text-ink">{notice}</p>}
    </form>
  )
}
