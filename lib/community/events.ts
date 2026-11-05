import { ApiError } from "@/lib/api-auth"
import { getEvent } from "@/lib/sports/service"
import type { SportEvent } from "@/lib/sports/types"

/** Fails closed: a provider outage must not let a write skip its kickoff or match check. */
export async function requireEvent(id: string): Promise<SportEvent> {
  let event: SportEvent | null
  try {
    event = await getEvent(id)
  } catch {
    throw new ApiError(503, "feed_unavailable", "Match data is temporarily unavailable")
  }
  if (!event) throw new ApiError(404, "not_found", "Match not found")
  return event
}
