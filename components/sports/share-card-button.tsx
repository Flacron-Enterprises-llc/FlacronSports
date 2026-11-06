"use client"

import { useState } from "react"
import { LoaderCircle, Share2 } from "lucide-react"
import { toast } from "sonner"
import { CopyButton, Switch } from "@/components/dashboard/controls"
import { btn, Panel } from "@/components/site/states"
import { authFetch } from "@/lib/auth-fetch"
import { useLocale } from "@/lib/use-locale"

/** Nothing is created until the member asks, and the score stays off unless they turn it on. */
export function ShareCardButton({ matchId, hasResult }: { matchId: string; hasResult: boolean }) {
  const { locale, t } = useLocale()
  const copy = t.share
  const [open, setOpen] = useState(false)
  const [reveal, setReveal] = useState(false)
  const [busy, setBusy] = useState(false)
  const [card, setCard] = useState<{ url: string; image: string } | null>(null)

  const create = async () => {
    setBusy(true)
    const response = await authFetch("/api/share", { method: "POST", body: JSON.stringify({ matchId, locale, reveal: hasResult && reveal }) }).catch(() => null)
    setBusy(false)
    if (!response?.ok) return void toast(copy.failed)
    setCard(await response.json())
  }

  if (!open) return <button type="button" onClick={() => setOpen(true)} className={btn("outline")}><Share2 aria-hidden className="size-4" /> {copy.button}</button>

  return (
    <Panel title={copy.button} icon={<Share2 aria-hidden />}>
      {!card && (
        <div className="space-y-3">
          {hasResult && (
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p id="share-score" className="text-sm font-medium text-ink">{copy.includeScore}</p>
                <p className="mt-0.5 text-[13px] leading-5 text-ink-2">{copy.includeHelp}</p>
              </div>
              <Switch labelledBy="share-score" checked={reveal} onChange={setReveal} />
            </div>
          )}
          <button type="button" onClick={create} disabled={busy} className={btn("navy")}>
            {busy && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
            {copy.create}
          </button>
        </div>
      )}
      {card && (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={card.image} alt={copy.preview} width={1200} height={630} className="h-auto w-full max-w-lg rounded-lg border border-line" />
          <p role="status" className="text-sm text-ink-2">{copy.ready}</p>
          <div className="flex flex-wrap gap-2">
            <CopyButton value={card.url} label={copy.copy} done={copy.copied} />
            {typeof navigator !== "undefined" && "share" in navigator && (
              <button type="button" onClick={() => navigator.share({ url: card.url }).catch(() => undefined)} className={btn("outline", "sm")}><Share2 aria-hidden className="size-3.5" /> {copy.send}</button>
            )}
          </div>
        </div>
      )}
    </Panel>
  )
}
