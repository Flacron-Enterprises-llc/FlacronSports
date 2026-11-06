"use client"

import { useState } from "react"
import { Bell, BellRing, Pin, PinOff, Star } from "lucide-react"
import { toast } from "sonner"
import { usePreferences, type MutateResult } from "@/components/account/prefs-provider"
import { MAX_BOARD_PINS, type FollowedLeague, type FollowedPlayer } from "@/lib/me/preferences-defaults"
import { canRemind, toggleReminder } from "@/lib/sports/following"
import type { SportEvent } from "@/lib/sports/types"
import { useLocale } from "@/lib/use-locale"
import { cn } from "@/lib/utils"

const ICON_BUTTON = "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-surface-muted hover:text-ink"

function useSaved() {
  const { t } = useLocale()
  return (result: MutateResult) => {
    if (result === "limit") toast(t.myTeams.limit)
    if (result === "failed") toast(t.ui.saveFailed)
  }
}

export function ReminderBell({ event }: { event: SportEvent }) {
  const { t } = useLocale()
  const { prefs, mutate } = usePreferences()
  const report = useSaved()
  const on = prefs.reminders.some((item) => item.eventId === event.id)
  // A bell already set stays removable after the game starts.
  if (!on && !canRemind(event)) return null
  const label = on ? t.discover.unremind : t.discover.remind
  const Icon = on ? BellRing : Bell
  return (
    <button type="button" aria-pressed={on} aria-label={label} title={label} onClick={async () => report(await mutate((current) => ({ reminders: toggleReminder(current.reminders, event) })))} className={ICON_BUTTON}>
      <Icon aria-hidden className={cn("size-4", on && "fill-orange text-orange")} />
    </button>
  )
}

export function PinButton({ eventId }: { eventId: string }) {
  const { t } = useLocale()
  const { prefs, mutate } = usePreferences()
  const report = useSaved()
  const on = prefs.boardPins.includes(eventId)
  const label = on ? t.discover.unpin : t.discover.pin
  const press = async () => {
    if (!on && prefs.boardPins.length >= MAX_BOARD_PINS) return void toast(t.discover.pinLimit)
    report(await mutate((current) => ({ boardPins: on ? current.boardPins.filter((id) => id !== eventId) : [...current.boardPins.filter((id) => id !== eventId), eventId] })))
  }
  const Icon = on ? PinOff : Pin
  return (
    <button type="button" aria-pressed={on} aria-label={label} title={label} onClick={press} className={ICON_BUTTON}>
      <Icon aria-hidden className={cn("size-4", on && "text-orange")} />
    </button>
  )
}

/** The bell and the pin, for any card or match page. */
export function EventActions({ event }: { event: SportEvent }) {
  return (
    <span className="flex shrink-0 items-center">
      <ReminderBell event={event} />
      <PinButton eventId={event.id} />
    </span>
  )
}

function FollowStar({ on, label, onPress }: { on: boolean; label: string; onPress(): Promise<void> }) {
  const [optimistic, setOptimistic] = useState<boolean | null>(null)
  const shown = optimistic ?? on
  return (
    <button
      type="button"
      aria-pressed={shown}
      aria-label={label}
      title={label}
      onClick={async () => {
        setOptimistic(!shown)
        await onPress()
        setOptimistic(null)
      }}
      className={ICON_BUTTON}
    >
      <Star aria-hidden className={cn("size-4", shown && "fs-star-on fill-orange text-orange")} />
    </button>
  )
}

export function FollowLeagueButton({ league }: { league: FollowedLeague }) {
  const { t } = useLocale()
  const { prefs, mutate } = usePreferences()
  const report = useSaved()
  const on = prefs.leagues.some((item) => item.id === league.id)
  return (
    <FollowStar
      on={on}
      label={`${on ? t.discover.unfollowLeague : t.discover.followLeague}: ${league.name}`}
      onPress={async () => report(await mutate((current) => ({ leagues: current.leagues.some((item) => item.id === league.id) ? current.leagues.filter((item) => item.id !== league.id) : [...current.leagues, league] })))}
    />
  )
}

export function FollowPlayerButton({ player }: { player: FollowedPlayer }) {
  const { t } = useLocale()
  const { prefs, mutate } = usePreferences()
  const report = useSaved()
  const on = prefs.players.some((item) => item.id === player.id)
  return (
    <FollowStar
      on={on}
      label={`${on ? t.discover.unfollowPlayer : t.discover.followPlayer}: ${player.name}`}
      onPress={async () => report(await mutate((current) => ({ players: current.players.some((item) => item.id === player.id) ? current.players.filter((item) => item.id !== player.id) : [...current.players, player] })))}
    />
  )
}
