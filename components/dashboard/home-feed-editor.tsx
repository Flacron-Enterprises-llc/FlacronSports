"use client"

import { useState } from "react"
import { ArrowDown, ArrowUp, SlidersHorizontal, X } from "lucide-react"
import { toast } from "sonner"
import { usePreferences } from "@/components/account/prefs-provider"
import { btn, Panel } from "@/components/site/states"
import type { HomeFeed, HomeSection } from "@/lib/me/preferences-defaults"
import { moveItem } from "@/lib/sports/following"
import { resolveHomeFeed } from "@/lib/sports/home-feed"
import { useLocale } from "@/lib/use-locale"
import { Switch } from "./controls"

const ICON = "inline-flex size-10 shrink-0 items-center justify-center rounded-md text-ink-2 hover:bg-surface-muted hover:text-ink disabled:pointer-events-none disabled:opacity-35"

export function HomeFeedEditor() {
  const { t } = useLocale()
  const copy = t.discover
  const { prefs, mutate } = usePreferences()
  const [open, setOpen] = useState(false)
  const feed = resolveHomeFeed(prefs.homeFeed)

  const save = async (change: (current: HomeFeed) => HomeFeed) => {
    const result = await mutate((current) => ({ homeFeed: change(resolveHomeFeed(current.homeFeed)) }))
    if (result !== "saved") toast(t.ui.saveFailed)
  }
  const move = (section: HomeSection, delta: -1 | 1) => save((current) => ({ ...current, order: moveItem(current.order, current.order.indexOf(section), delta) }))
  const show = (section: HomeSection, visible: boolean) => save((current) => ({ ...current, hidden: visible ? current.hidden.filter((item) => item !== section) : [...current.hidden, section] }))

  if (!open) return <button type="button" onClick={() => setOpen(true)} className={btn("outline", "sm")}><SlidersHorizontal aria-hidden className="size-3.5" /> {copy.customise}</button>

  return (
    <Panel
      className="w-full basis-full"
      title={copy.customise}
      description={copy.customiseLead}
      icon={<SlidersHorizontal aria-hidden />}
      actions={<button type="button" aria-label={copy.customiseDone} title={copy.customiseDone} onClick={() => setOpen(false)} className={ICON}><X aria-hidden className="size-4" /></button>}
    >
      <ol className="divide-y divide-line">
        {feed.order.map((section, index) => (
          <li key={section} className="flex items-center gap-2 py-1.5">
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{copy.sections[section]}</span>
            <button type="button" disabled={index === 0} onClick={() => move(section, -1)} aria-label={`${copy.moveUp}: ${copy.sections[section]}`} className={ICON}><ArrowUp aria-hidden className="size-4" /></button>
            <button type="button" disabled={index === feed.order.length - 1} onClick={() => move(section, 1)} aria-label={`${copy.moveDown}: ${copy.sections[section]}`} className={ICON}><ArrowDown aria-hidden className="size-4" /></button>
            <Switch label={copy.showSection.replace("{section}", copy.sections[section])} checked={!feed.hidden.includes(section)} onChange={(visible) => show(section, visible)} />
          </li>
        ))}
      </ol>
    </Panel>
  )
}
