"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { btn } from "@/components/site/states"
import { authFetch } from "@/lib/auth-fetch"
import { useLocale } from "@/lib/use-locale"

function GatePrompt({ onAccepted, onCancel }: { onAccepted(): void; onCancel?: () => void }) {
  const { t, href } = useLocale()
  const [age, setAge] = useState(false)
  const [rules, setRules] = useState(false)
  const [failed, setFailed] = useState(false)

  const confirm = async (event: React.FormEvent) => {
    event.preventDefault()
    const response = await authFetch("/api/community/accept", {
      method: "POST",
      body: JSON.stringify({ ageConfirmed: age, guidelinesAccepted: rules }),
    }).catch(() => null)
    if (response?.ok) onAccepted()
    else setFailed(true)
  }

  return (
    <form onSubmit={confirm} role="group" aria-label={t.community.gateTitle} data-testid="community-gate" className="fs-pop space-y-2 rounded-xl border border-line bg-surface-muted p-4 text-sm text-ink">
      <p className="font-semibold">{t.community.gateTitle}</p>
      <p className="text-ink-2">{t.community.gateBody}</p>
      <label className="flex items-start gap-2"><input type="checkbox" required className="mt-1" checked={age} onChange={(e) => setAge(e.target.checked)} />{t.community.gateAge}</label>
      <label className="flex items-start gap-2">
        <input type="checkbox" required className="mt-1" checked={rules} onChange={(e) => setRules(e.target.checked)} />
        <span>{t.community.gateRules} <Link href={href("/community-guidelines")} target="_blank" className="font-semibold text-hot-text underline">{t.community.guidelines}</Link></span>
      </label>
      {failed && <p role="status">{t.community.sendFailed}</p>}
      <div className="flex gap-2 pt-1">
        <button type="submit" className={btn("navy")}>{t.community.gateConfirm}</button>
        {onCancel && <button type="button" onClick={onCancel} className={btn("outline")}>{t.community.gateCancel}</button>}
      </div>
    </form>
  )
}

// Shared by every panel on the page, so one confirmation opens all of them at once.
let accepted: boolean | null = null
let checking = false
const listeners = new Set<() => void>()

function publish(next: boolean) {
  accepted = next
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** An unreadable answer must not hide the feature: the server has the last word. */
function checkAcceptance() {
  if (accepted !== null || checking) return
  checking = true
  authFetch("/api/community/accept")
    .then((response) => (response.ok ? response.json() : null))
    .then((data: { accepted?: boolean } | null) => publish(data ? data.accepted === true : true))
    .catch(() => publish(true))
    .finally(() => {
      checking = false
    })
}

/**
 * Asks first: until the member has accepted, `locked` keeps the action off the page and
 * `prompt` stands in its place. The server still decides, so a refusal shows the prompt
 * and runs the action again. `locked` opens if the check itself fails, for the same reason.
 */
export function useCommunityGate() {
  const state = useSyncExternalStore(subscribe, () => accepted, () => null)
  const [retry, setRetry] = useState<(() => void) | null>(null)

  useEffect(checkAcceptance, [])

  const intercept = (code: string | undefined, action: () => void) => {
    if (code !== "guidelines_required") return false
    publish(false)
    setRetry(() => action)
    return true
  }

  const done = () => {
    publish(true)
    setRetry(null)
    retry?.()
  }

  const prompt = (retry || state === false) && <GatePrompt onAccepted={done} onCancel={retry ? () => setRetry(null) : undefined} />

  return { intercept, prompt, locked: state !== true }
}
