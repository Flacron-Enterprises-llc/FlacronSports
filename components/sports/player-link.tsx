"use client"

import Link from "next/link"
import { isPlayerId, playerPath } from "@/lib/sports/player"
import { useLocale } from "@/lib/use-locale"

/** A name that opens the athlete's profile. Plain text when the source gives no player id. */
export function PlayerLink({ id, name, className }: { id: string | null | undefined; name: string; className?: string }) {
  const { href } = useLocale()
  if (!id || !isPlayerId(id)) return <span className={className}>{name}</span>
  return <Link href={href(playerPath(id))} className={`underline-offset-2 hover:underline ${className ?? ""}`}>{name}</Link>
}
