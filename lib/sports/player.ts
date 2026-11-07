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
  strSide?: string | null
  strBirthLocation?: string | null
  strWage?: string | null
  idTeam2?: string | null
  idTeamNational?: string | null
}

/** Comparison rows for Premium. Kept off PlayerProfile, which every plan receives. */
export interface PlayerAdvanced {
  side: string | null
  birthplace: string | null
  wage: string | null
}

export type MoveType = "permanent" | "loan" | "youth"

/** A year is all the source publishes for a move. A null departure was simply not stated. */
export interface PlayerMove {
  team: string
  type: MoveType
  joined: number
  left: number | null
}

export interface RawFormerTeam {
  idFormerTeam?: string | null
  strFormerTeam?: string | null
  strMoveType?: string | null
  strJoined?: string | null
  strDeparted?: string | null
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
    // For tennis this field holds a ranking the source no longer keeps current.
    number: sportId === "tennis" ? null : text(raw.strNumber),
    height: text(raw.strHeight),
    weight: text(raw.strWeight),
  }
}

export function advancedPlayer(raw: RawPlayer): PlayerAdvanced {
  return { side: text(raw.strSide), birthplace: text(raw.strBirthLocation), wage: text(raw.strWage) }
}

const MOVE_TYPES: Record<string, MoveType> = { Permanent: "permanent", Loan: "loan", Youth: "youth" }

const year = (value: string | null | undefined): number | null => (value && /^\d{4}$/.test(value.trim()) ? Number(value) : null)

/**
 * Newest first. Coaching and international spells are not moves, and the source files
 * some national teams as permanent, so those go by id. A row with no year cannot be dated.
 */
export function normalizeMoves(rows: RawFormerTeam[] | null | undefined, player: Pick<RawPlayer, "idTeam2" | "idTeamNational">): PlayerMove[] {
  const national = new Set([player.idTeam2, player.idTeamNational].filter(Boolean))
  return (rows ?? [])
    .flatMap((row) => {
      const team = text(row.strFormerTeam)
      const type = MOVE_TYPES[row.strMoveType ?? ""]
      const joined = year(row.strJoined)
      if (!team || !type || joined === null || national.has(row.idFormerTeam)) return []
      return [{ team, type, joined, left: year(row.strDeparted) }]
    })
    .sort((a, b) => b.joined - a.joined || (b.left ?? Infinity) - (a.left ?? Infinity))
}
