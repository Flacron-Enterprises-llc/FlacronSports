// Viewing decision (spec section 3). Score coverage never implies video rights:
// a source is offered only after permission, territory, window, platform and
// entitlement all pass, and the same check repeats when playback starts.

import type { EventStatus } from "@/lib/sports/types"

export type VideoType = "live" | "highlight" | "replay"
export type ViewingAction = "watch_live" | "watch_highlights" | "watch_replay" | "official_broadcaster" | "follow_live"

export type BlockReason =
  | "no_licensed_source"
  | "not_permitted"
  | "territory_blocked"
  | "outside_window"
  | "platform_unsupported"
  | "entitlement_required"
  | "unavailable"

export interface VideoSource {
  id: string
  matchId: string
  provider: string
  type: VideoType
  /** ISO country codes. Empty means the source has no confirmed territory, so it is blocked. */
  territories: string[]
  /** A public embed: the provider applies the uploader's territory rules inside its own player. */
  providerEnforcesTerritory?: boolean
  validFromUTC: string
  validToUTC: string
  permitted: boolean
  available: boolean
  platforms: string[]
  requiresEntitlement: boolean
  officialUrl: string | null
}

export interface ViewingContext {
  /** Derived from the network. A profile country preference must never be passed here. */
  country: string | null
  platform: string
  entitled: boolean
  now: Date
  /** The event's state, when known. Follow Live is only offered while it can still happen. */
  status?: EventStatus
}

export interface ViewingOption {
  action: ViewingAction
  sourceId: string | null
  url: string | null
}

export interface ViewingResult {
  options: ViewingOption[]
  reasons: BlockReason[]
}

const ACTION: Record<VideoType, ViewingAction> = {
  live: "watch_live",
  highlight: "watch_highlights",
  replay: "watch_replay",
}

const FOLLOWABLE = new Set<EventStatus | undefined>([undefined, "scheduled", "live", "interrupted"])

function blockReason(source: VideoSource, context: ViewingContext): BlockReason | null {
  if (!source.permitted) return "not_permitted"
  if (!source.available) return "unavailable"
  if (!source.providerEnforcesTerritory && (!context.country || !source.territories.includes(context.country))) return "territory_blocked"
  const now = context.now.getTime()
  if (now < Date.parse(source.validFromUTC) || now > Date.parse(source.validToUTC)) return "outside_window"
  if (!source.platforms.includes(context.platform)) return "platform_unsupported"
  if (source.requiresEntitlement && !context.entitled) return "entitlement_required"
  return null
}

export function evaluateViewing(sources: VideoSource[], context: ViewingContext): ViewingResult {
  const options: ViewingOption[] = []
  const reasons = new Set<BlockReason>()

  for (const source of sources) {
    const reason = blockReason(source, context)
    if (reason) reasons.add(reason)
    else options.push({ action: ACTION[source.type], sourceId: source.id, url: null })
  }

  if (!options.some((option) => option.action === "watch_live")) {
    const official = sources.find((source) => source.officialUrl?.startsWith("https://"))
    if (official) options.push({ action: "official_broadcaster", sourceId: null, url: official.officialUrl })
    if (FOLLOWABLE.has(context.status)) options.push({ action: "follow_live", sourceId: null, url: null })
  }
  if (sources.length === 0) reasons.add("no_licensed_source")

  return { options, reasons: [...reasons] }
}
