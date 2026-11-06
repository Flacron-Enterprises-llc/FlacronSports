"use client"

import { useState } from "react"
import Link from "next/link"
import { btn } from "@/components/site/states"
import { authFetch } from "@/lib/auth-fetch"
import { useLocale } from "@/lib/use-locale"

function GatePrompt({ onAccepted, onCancel }: { onAccepted(): void; onCancel(): void }) {
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
    <form onSubmit={confirm} role="group" aria-label={t.community.gateTitle} className="fs-pop mt-3 space-y-2 rounded-xl border border-line bg-surface-muted p-4 text-sm text-ink">
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
        <button type="button" onClick={onCancel} className={btn("outline")}>{t.community.gateCancel}</button>
      </div>
    </form>
  )
}

/** The server decides: an action that comes back refused shows the prompt, then runs again. */
export function useCommunityGate() {
  const [retry, setRetry] = useState<(() => void) | null>(null)

  const intercept = (code: string | undefined, action: () => void) => {
    if (code !== "guidelines_required") return false
    setRetry(() => action)
    return true
  }

  const prompt = retry && (
    <GatePrompt
      onAccepted={() => {
        setRetry(null)
        retry()
      }}
      onCancel={() => setRetry(null)}
    />
  )

  return { intercept, prompt }
}
