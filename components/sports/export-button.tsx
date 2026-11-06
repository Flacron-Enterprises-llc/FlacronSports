"use client"

import { useState } from "react"
import Link from "next/link"
import { Download, LoaderCircle } from "lucide-react"
import { btn } from "@/components/site/states"
import { authFetch } from "@/lib/auth-fetch"
import { useAuthUser } from "@/lib/hooks/useAuthUser"
import { useLocale } from "@/lib/use-locale"

export function ExportButton({ matchId }: { matchId: string }) {
  const { t, href } = useLocale()
  const user = useAuthUser()
  const [state, setState] = useState<"idle" | "working" | "no_credits" | "failed">("idle")

  if (!user) return null

  const download = async () => {
    setState("working")
    const response = await authFetch("/api/exports", { method: "POST", body: JSON.stringify({ matchId }) }).catch(() => null)
    if (!response?.ok) return setState(response?.status === 403 ? "no_credits" : "failed")
    const url = URL.createObjectURL(await response.blob())
    const link = document.createElement("a")
    link.href = url
    link.download = "flacronsport-match-report.pdf"
    link.click()
    URL.revokeObjectURL(url)
    setState("idle")
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={state === "working"} onClick={download} className={btn("outline")}>
        {state === "working" ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Download aria-hidden className="size-4" />}
        {t.match.exportPdf}
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
