import { notFound } from "next/navigation"
import { AppPage } from "@/components/site/states"
import { PlayerProfileView } from "@/components/sports/player-profile"
import { titled } from "@/lib/page-context"
import { isPlayerId } from "@/lib/sports/player"

export const generateMetadata = titled((t) => t.discover.players, { robots: { index: false } })

/** Loaded in the browser, because player data goes only to members with a plan. */
export default async function PlayerPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = await params
  if (!isPlayerId(id)) notFound()
  return (
    <AppPage width="md">
      <PlayerProfileView id={id} />
    </AppPage>
  )
}
