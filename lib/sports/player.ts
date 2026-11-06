import type { SportId } from "./types"

/** Sports where a player belongs to a team. Athletes elsewhere are followed by name. */
export const TEAM_SPORTS: readonly SportId[] = ["football", "basketball", "american-football", "baseball", "ice-hockey", "cricket", "rugby", "volleyball"]

export const isPlayerId = (id: string): boolean => /^\d{1,10}$/.test(id)
export const playerPath = (id: string): string => `/app/player/${id}`

/** Every field is null when the source does not state it. */
export interface PlayerProfile {
  id: string
  name: string
  sportId: SportId
  team: string | null
  position: string | null
  nationality: string | null
  born: string | null
  number: string | null
  height: string | null
  weight: string | null
}

export interface RawPlayer {
  idPlayer?: string | null
  strPlayer?: string | null
  strTeam?: string | null
  strSport?: string | null
  strPosition?: string | null
  strNationality?: string | null
  dateBorn?: string | null
  strNumber?: string | null
  strHeight?: string | null
  strWeight?: string | null
}

const text = (value: string | null | undefined): string | null => value?.trim() || null

/** The source files free agents and retired players under placeholder teams that start with "_". */
function realTeam(value: string | null | undefined): string | null {
  const team = text(value)
  return team && !team.startsWith("_") ? team : null
}

/** Null for a record in a sport this site does not cover. */
export function normalizePlayer(raw: RawPlayer, sportOf: (providerKey: string | null | undefined) => SportId | undefined): PlayerProfile | null {
  const sportId = sportOf(raw.strSport)
  const name = text(raw.strPlayer)
  if (!sportId || !name || !raw.idPlayer) return null
  const born = text(raw.dateBorn)
  return {
    id: raw.idPlayer,
    name,
    sportId,
    team: realTeam(raw.strTeam),
    position: text(raw.strPosition),
    nationality: text(raw.strNationality),
    born: born && /^\d{4}-\d{2}-\d{2}$/.test(born) && !born.startsWith("0000") ? born : null,
    number: text(raw.strNumber),
    height: text(raw.strHeight),
    weight: text(raw.strWeight),
  }
}
