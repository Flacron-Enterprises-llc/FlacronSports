// Browser-safe: badges.ts reaches the document store's types only, but keeping the
// list here lets client components import it without touching server modules.
export const BADGES = ["supporter", "club_member", "predictor", "veteran", "sharp"] as const
