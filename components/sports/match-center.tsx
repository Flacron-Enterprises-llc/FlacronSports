"use client"

import { useCallback, useEffect, useState } from "react"
import { ExternalLink, FileText, LayoutList, MessagesSquare, PlayCircle, Radio } from "lucide-react"
import { usePreferences } from "@/components/account/prefs-provider"
import { ErrorNotice, Tabs } from "@/components/dashboard/controls"
import { btn, Panel, Skeleton } from "@/components/site/states"
import { useLocale } from "@/lib/use-locale"
import type { ViewingResult } from "@/lib/video/viewing"

type TabId = "overview" | "result" | "viewing" | "community"

export function MatchTabs({ overview, result, viewing, community }: { overview: React.ReactNode; result?: React.ReactNode; viewing: React.ReactNode; community?: React.ReactNode }) {
  const { t } = useLocale()
  const [tab, setTab] = useState<TabId>("overview")
  const icon = "size-4"
  const tabs = [
    { value: "overview" as const, label: t.match.overview, icon: <LayoutList aria-hidden className={icon} /> },
    ...(result ? [{ value: "result" as const, label: t.event.result, icon: <FileText aria-hidden className={icon} /> }] : []),
    { value: "viewing" as const, label: t.match.viewing, icon: <PlayCircle aria-hidden className={icon} /> },
    ...(community ? [{ value: "community" as const, label: t.community.title, icon: <MessagesSquare aria-hidden className={icon} /> }] : []),
  ]
  return (
    <Tabs<TabId> value={tab} onChange={setTab} tabs={tabs} label={t.ui.matchCenter}>
      {tab === "overview" && overview}
      {tab === "result" && result}
      {tab === "viewing" && viewing}
      {tab === "community" && community}
    </Tabs>
  )
}

/** Viewing is checked for this browser's country at request time. Low-data mode checks only when asked. */
export function ViewingPanel({ matchId }: { matchId: string }) {
  const { t } = useLocale()
  const { prefs, ready } = usePreferences()
  const [result, setResult] = useState<ViewingResult | null>(null)
  const [state, setState] = useState<"idle" | "loading" | "failed">("idle")

  const check = useCallback(async () => {
    setState("loading")
    const response = await fetch(`/api/matches/${encodeURIComponent(matchId)}/viewing-options`).catch(() => null)
    if (!response?.ok) return setState("failed")
    setResult(await response.json())
    setState("idle")
  }, [matchId])

  useEffect(() => {
    if (ready !== false && !prefs.lowData) void check()
  }, [check, prefs.lowData, ready])

  const official = result?.options.find((option) => option.action === "official_broadcaster" && option.url)
  const following = result?.options.some((option) => option.action === "follow_live")

  return (
    <Panel title={t.match.viewing} icon={<PlayCircle aria-hidden />}>
      {state === "failed" && <ErrorNotice onRetry={check}>{t.ui.viewingFailed}</ErrorNotice>}
      {state === "loading" && <div role="status" aria-label={t.ui.loading} className="space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /></div>}
      {state === "idle" && !result && prefs.lowData && (
        <div>
          <p className="text-sm leading-6 text-ink-2">{t.ui.lowDataVideo}</p>
          <button type="button" onClick={check} className={btn("navy", "md", "mt-3")}><PlayCircle aria-hidden className="size-4" /> {t.ui.checkViewing}</button>
        </div>
      )}
      {state === "idle" && result && (
        <div className="space-y-3">
          {!official && <p className="text-sm leading-6 text-ink-2">{t.match.noVideo}</p>}
          {official?.url && <a href={official.url} rel="noreferrer" target="_blank" className={btn("navy")}><ExternalLink aria-hidden className="size-4" /> {t.ui.officialBroadcaster}<span className="sr-only"> {t.footer.newTab}</span></a>}
          {following && <p className="flex items-center gap-2 text-sm font-semibold text-ink"><Radio aria-hidden className="size-4 text-live" /> {t.match.followLive}</p>}
        </div>
      )}
    </Panel>
  )
}
