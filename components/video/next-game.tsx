import Link from "next/link"
import { LocalTime } from "@/components/sports/parts"
import type { Dictionary, Locale } from "@/lib/i18n"
import type { NextGame } from "@/lib/video/catalog"

/** A game with no start time is shown by its date alone, in the feed's own day. */
export function NextGameLine({ game, none, t, locale, href }: { game?: NextGame | null; none: string; t: Dictionary; locale: Locale; href: (path: string) => string }) {
  if (!game) return <p className="mt-2 text-sm text-ink-2">{none}</p>
  return (
    <p className="mt-2 text-sm text-ink-2">
      {t.watch.nextGame}: <Link href={href(`/app/match/${game.matchId}`)} className="font-semibold text-ink hover:underline">{game.title}</Link>
      {" · "}{game.competition}
      {game.startUTC && <> · {game.dateOnly ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(game.startUTC)) : <LocalTime iso={game.startUTC} mode="datetime" />}</>}
    </p>
  )
}
