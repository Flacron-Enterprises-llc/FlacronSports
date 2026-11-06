"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { Activity, ExternalLink, LayoutList, ListChecks, MessagesSquare, PlayCircle, Radio, Users } from "lucide-react"
import { usePreferences } from "@/components/account/prefs-provider"
import { ErrorNotice, Tabs } from "@/components/dashboard/controls"
import { btn, Panel, Skeleton } from "@/components/site/states"
import { authFetch } from "@/lib/auth-fetch"
import { useLocale } from "@/lib/use-locale"
import type { MatchViewing } from "@/lib/video/catalog"
import { HighlightPlayer } from "@/components/video/highlight-player"

type TabId = "overview" | "updates" | "statistics" | "participants" | "chat"

export function MatchTabs({ overview, updates, statistics, participants, chat }: { overview: React.ReactNode; updates: React.ReactNode; statistics: React.ReactNode; participants: React.ReactNode; chat?: React.ReactNode }) {
  const { t } = useLocale()
  const [tab, setTab] = useState<TabId>("overview")
  const icon = "size-4"
  const tabs = [
    { value: "overview" as const, label: t.match.overview, icon: <LayoutList aria-hidden className={icon} /> },
    { value: "updates" as const, label: t.match.liveUpdates, icon: <ListChecks aria-hidden className={icon} /> },
    { value: "statistics" as const, label: t.match.statistics, icon: <Activity aria-hidden className={icon} /> },
    { value: "participants" as const, label: t.match.participants, icon: <Users aria-hidden className={icon} /> },
    ...(chat ? [{ value: "chat" as const, label: t.match.chat, icon: <MessagesSquare aria-hidden className={icon} /> }] : []),
  ]
  return (
    <Tabs<TabId> value={tab} onChange={setTab} tabs={tabs} label={t.ui.matchCenter}>
      {tab === "overview" && overview}
      {tab === "updates" && updates}
      {tab === "statistics" && statistics}
      {tab === "participants" && participants}
      {tab === "chat" && chat}
    </Tabs>
  )
}

interface ViewingState {
  matchId: string
  result: MatchViewing | null
  state: "idle" | "loading" | "failed"
  check(): Promise<void>
}

const ViewingContext = createContext<ViewingState | null>(null)

/** Viewing is checked for this browser's country at request time. Low-data mode checks only when asked. */
export function ViewingProvider({ matchId, children }: { matchId: string; children: React.ReactNode }) {
  const { prefs, ready } = usePreferences()
  const [result, setResult] = useState<MatchViewing | null>(null)
  const [state, setState] = useState<ViewingState["state"]>("idle")

  const check = useCallback(async () => {
    setState("loading")
    const response = await authFetch(`/api/matches/${encodeURIComponent(matchId)}/viewing-options`).catch(() => null)
    if (!response?.ok) return setState("failed")
    setResult(await response.json())
    setState("idle")
  }, [matchId])

  useEffect(() => {
    if (ready !== false && !prefs.lowData) void check()
  }, [check, prefs.lowData, ready])

  const value = useMemo(() => ({ matchId, result, state, check }), [matchId, result, state, check])
  return <ViewingContext.Provider value={value}>{children}</ViewingContext.Provider>
}

function useViewing(): ViewingState {
  const value = useContext(ViewingContext)
  if (!value) throw new Error("useViewing needs a ViewingProvider")
  return value
}

/** Sits above everything else when there is something to play, and takes no room when there is not. */
export function MatchPlayer({ title }: { title: string }) {
  const { t } = useLocale()
  const { prefs } = usePreferences()
  const { matchId, result, state, check } = useViewing()

  if (result?.video) {
    return (
      <section aria-label={t.match.viewing} className="fs-rise mt-4">
        <div className="mx-auto max-w-3xl"><HighlightPlayer matchId={matchId} title={title} channel={result.video.channel} /></div>
      </section>
    )
  }
  if (result || !prefs.lowData) return null
  return (
    <section aria-label={t.match.viewing} className="fs-rise mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4">
      <p className="min-w-0 flex-1 text-sm leading-6 text-ink-2">{t.ui.lowDataVideo}</p>
      <button type="button" onClick={check} disabled={state === "loading"} className={btn("navy", "md")}><PlayCircle aria-hidden className="size-4" /> {t.ui.checkViewing}</button>
    </section>
  )
}

export function ViewingPanel() {
  const { t } = useLocale()
  const { prefs } = usePreferences()
  const { result, state, check } = useViewing()

  const official = result?.options.find((option) => option.action === "official_broadcaster" && option.url)
  const following = result?.options.some((option) => option.action === "follow_live")

  return (
    <Panel title={t.match.viewing} icon={<PlayCircle aria-hidden />}>
      {state === "failed" && <ErrorNotice onRetry={check}>{t.ui.viewingFailed}</ErrorNotice>}
      {state === "loading" && <div role="status" aria-label={t.ui.loading} className="space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /></div>}
      {state === "idle" && !result && prefs.lowData && <p className="text-sm leading-6 text-ink-2">{t.ui.lowDataVideo}</p>}
      {state === "idle" && result && (
        <div className="space-y-3">
          {result.video && <p className="text-sm leading-6 text-ink-2">{t.match.videoAtTop}</p>}
          {result.broadcasts.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-ink">{t.ui.officialBroadcaster}</h3>
              <ul className="mt-1 space-y-1 text-sm text-ink-2">
                {result.broadcasts.map((item) => <li key={item.id}>{item.channel}{item.country ? ` · ${item.country}` : ""}</li>)}
              </ul>
            </div>
          )}
          {!official && !result.video && result.broadcasts.length === 0 && <p className="text-sm leading-6 text-ink-2">{t.match.noVideo}</p>}
          {official?.url && <a href={official.url} rel="noreferrer" target="_blank" className={btn("navy")}><ExternalLink aria-hidden className="size-4" /> {t.ui.officialBroadcaster}<span className="sr-only"> {t.footer.newTab}</span></a>}
          {following && <p className="flex items-center gap-2 text-sm font-semibold text-ink"><Radio aria-hidden className="size-4 text-live" /> {t.match.followLive}</p>}
        </div>
      )}
    </Panel>
  )
}
