"use client"

import { useState } from "react"
import Link from "next/link"
import { Download, LoaderCircle } from "lucide-react"
import { btn } from "@/components/site/states"
import { authFetch } from "@/lib/auth-fetch"
import { trackFeatureUsed } from "@/lib/growth-engine"
import { useAuthUser } from "@/lib/hooks/useAuthUser"
import { useLocale } from "@/lib/use-locale"

/** A match report by default. A comparison passes its own endpoint, request body and label. */
export function ExportButton({ matchId, endpoint = "/api/exports", body, label, fileName = "flacronsport-match-report.pdf" }: { matchId?: string; endpoint?: string; body?: Record<string, unknown>; label?: string; fileName?: string }) {
  const { t, href } = useLocale()
  const user = useAuthUser()
  const [state, setState] = useState<"idle" | "working" | "no_credits" | "failed">("idle")

  if (!user) return null

  const download = async () => {
    setState("working")
    const response = await authFetch(endpoint, { method: "POST", body: JSON.stringify(body ?? { matchId }) }).catch(() => null)
    if (!response?.ok) return setState(response?.status === 403 ? "no_credits" : "failed")
    const url = URL.createObjectURL(await response.blob())
    const link = document.createElement("a")
    link.href = url
    link.download = fileName
    link.click()
    URL.revokeObjectURL(url)
    setState("idle")
    trackFeatureUsed("report_exported", { kind: endpoint === "/api/exports" ? "match" : "comparison" })
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={state === "working"} onClick={download} className={btn("outline")}>
        {state === "working" ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Download aria-hidden className="size-4" />}
        {label ?? t.match.exportPdf}
      </button>
      {state === "no_credits" && (
        <p role="status" className="text-sm text-ink-2">
          {t.match.exportNoCredits} <Link href={href("/app/billing#addons")} className="font-semibold text-hot-text underline">{t.match.exportBuy}</Link>
        </p>
      )}
      {state === "failed" && <p role="alert" className="text-sm text-bad">{t.account.failed}</p>}
    </div>
  )
}
