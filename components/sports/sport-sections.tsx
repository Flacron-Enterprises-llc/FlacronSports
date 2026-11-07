import { Check, Flag, Info, ListChecks, Medal, Users } from "lucide-react"
import { FactGrid, Panel, type FactItem } from "@/components/site/states"
import type { Dictionary } from "@/lib/i18n"
import { boutRounds, resultFacts, setScore, sportFacts, sportSteps, weightClassText, type Fact } from "@/lib/sports/sport-terms"
import { inningsText } from "@/lib/sports/presentation"
import type { ClassificationEntry, ClassifiedOut, CombatBout, CombatDetails, Innings, SportEvent, StandingEntry, TennisDetails } from "@/lib/sports/types"
import { cn } from "@/lib/utils"
import { FavoriteStar } from "./parts"

function FactList({ facts }: { facts: Fact[] }) {
  return <FactGrid facts={facts} className="sm:grid-cols-2" />
}

/** Overview: what this event is, in the sport's own terms, after any facts common to every sport. States no result. */
export function SportFacts({ event, t, lead = [] }: { event: SportEvent; t: Dictionary; lead?: FactItem[] }) {
  const facts = [...lead, ...sportFacts(event, t)]
  if (facts.length === 0) return null
  return <Panel title={t.sportTerms.facts} icon={<Info aria-hidden />}><FactGrid facts={facts} className="grid-cols-2 sm:grid-cols-3 xl:grid-cols-1" /></Panel>
}

function inningsNote(innings: Innings, t: Dictionary): string {
  return [innings.declared ? t.sportTerms.declared : null, innings.followOn ? t.sportTerms.followOn : null].filter(Boolean).join(", ")
}

function CricketScorecard({ event, t }: { event: SportEvent; t: Dictionary }) {
  const { score, participants } = event
  if (score.kind !== "innings") return null
  const sides = [
    { name: participants[0]?.name, list: score.homeInnings, total: score.home },
    { name: participants[1]?.name, list: score.awayInnings, total: score.away },
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {sides.map(({ name, list, total }) => (list || total) && (
        <section key={name} className="min-w-0 overflow-hidden rounded-lg border border-line">
          <h3 className="fs-foot truncate border-b border-line px-3 py-2 text-sm font-semibold text-ink">{name}</h3>
          <dl className="divide-y divide-line px-3 text-sm">
            {(list ?? [total as Innings]).map((innings, index) => (
              <div key={index} className="flex items-baseline justify-between gap-3 py-2">
                <dt className="text-ink-2">{list ? t.sportTerms.innings.replace("{n}", String(index + 1)) : score.totalsOnly ? t.sportTerms.matchTotal : t.event.innings}</dt>
                <dd className="tabular text-right text-ink">
                  <span className="font-semibold">{inningsText(innings)}</span>
                  {innings.overs && <span className="ml-2 text-ink-2">{t.event.overs.replace("{overs}", innings.overs)}</span>}
                  {inningsNote(innings, t) && <span className="ml-2 text-xs text-ink-2">{inningsNote(innings, t)}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}

function TennisRubbers({ details, t }: { details: TennisDetails; t: Dictionary }) {
  return (
    <ul className="divide-y divide-line text-sm">
      {details.rubbers.map((rubber) => (
        <li key={`${rubber.winner}-${rubber.loser}`} className="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5">
          <span className="min-w-0 text-ink"><span className="font-semibold">{rubber.winner}</span> {t.sportTerms.beat} {rubber.loser}</span>
          <span className="tabular shrink-0 text-ink-2">{rubber.games.map((games, index) => setScore(games, rubber.tiebreaks[index])).join(" ")}</span>
        </li>
      ))}
    </ul>
  )
}

function RaceTable({ entries, t }: { entries: ClassificationEntry[]; t: Dictionary }) {
  const copy = t.sportTerms
  const has = (key: keyof ClassificationEntry) => entries.some((entry) => entry[key] !== undefined && entry[key] !== null)
  const grid = has("grid") || has("pitLane")
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-sm [&_td]:py-2 [&_th[scope=row]]:py-2">
        <caption className="sr-only">{t.event.classification}</caption>
        <thead>
          <tr className="bg-surface-muted text-left text-xs text-ink-2">
            <th scope="col" className="px-3 py-2 font-medium">{copy.position}</th>
            {has("number") && <th scope="col" className="px-2 py-2 font-medium">{copy.number}</th>}
            <th scope="col" className="px-2 py-2 font-medium">{t.event.name}</th>
            {has("team") && <th scope="col" className="px-2 py-2 font-medium">{copy.team}</th>}
            {has("laps") && <th scope="col" className="px-2 py-2 text-right font-medium">{copy.laps}</th>}
            {has("time") && <th scope="col" className="px-2 py-2 text-right font-medium">{copy.gap}</th>}
            {grid && <th scope="col" className="px-2 py-2 text-right font-medium">{copy.grid}</th>}
            {has("points") && <th scope="col" className="px-2 py-2 text-right font-medium">{copy.points}</th>}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.position} className="fs-row border-t border-line">
              <td className="tabular px-3 py-1.5 font-bold text-ink">{entry.position}</td>
              {has("number") && <td className="tabular px-2 py-1.5 text-ink-2">{entry.number ?? ""}</td>}
              <th scope="row" className="min-w-32 px-2 py-1.5 text-left font-medium text-ink">{entry.name}</th>
              {has("team") && <td className="min-w-32 px-2 py-1.5 text-ink-2">{entry.team}</td>}
              {has("laps") && <td className="tabular px-2 py-1.5 text-right text-ink-2">{entry.laps ?? ""}</td>}
              {has("time") && <td className="tabular whitespace-nowrap px-2 py-1.5 text-right text-ink">{entry.time ?? ""}</td>}
              {grid && <td className="tabular px-2 py-1.5 text-right text-ink-2">{entry.pitLane ? copy.pitLane : entry.grid ?? ""}</td>}
              {has("points") && <td className="tabular px-2 py-1.5 text-right text-ink-2">{entry.points ?? ""}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function OutList({ out, t }: { out: ClassifiedOut[]; t: Dictionary }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-ink">{t.sportTerms.notClassified}</h3>
      <ul className="mt-1 divide-y divide-line text-sm">
        {out.map((item) => (
          <li key={item.name} className="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5">
            <span className="min-w-0 font-medium text-ink">{item.name}{item.team && <span className="ml-2 font-normal text-ink-2">{item.team}</span>}</span>
            <span className="text-ink-2">{[item.status, item.note].filter(Boolean).join(" · ")}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ChampionshipTable({ rows, t }: { rows: StandingEntry[]; t: Dictionary }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-ink">{t.sportTerms.championship}</h3>
      <ol className="mt-1 divide-y divide-line text-sm">
        {rows.map((row) => (
          <li key={row.position} className="flex items-baseline gap-2 py-1.5">
            <span className="tabular w-6 shrink-0 font-semibold text-ink-2">{row.position}</span>
            <span className="min-w-0 flex-1 truncate font-medium text-ink">{row.name}</span>
            {row.team && <span className="hidden min-w-0 truncate text-ink-2 sm:block">{row.team}</span>}
            <span className="tabular shrink-0 text-ink">{row.points}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function BoutTable({ details, t }: { details: CombatDetails; t: Dictionary }) {
  return (
    <ol className="divide-y divide-line text-sm">
      {details.bouts.map((bout, index) => <BoutRow key={index} bout={bout} t={t} />)}
    </ol>
  )
}

function BoutRow({ bout, t }: { bout: CombatBout; t: Dictionary }) {
  const how = [bout.method && t.event.methods[bout.method], bout.round ? t.event.round.replace("{round}", String(bout.round)) : null, bout.time].filter(Boolean).join(" · ")
  const about = [bout.section && t.sportTerms.cardSections[bout.section], bout.weightClass && weightClassText(bout.weightClass, t), boutRounds(bout, t)].filter(Boolean).join(" · ")
  return (
    <li className="py-2.5 first:pt-0 last:pb-0">
      {about && <p className="text-xs text-ink-2">{about}</p>}
      <ul className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-0.5">
        {bout.names.map((name) => (
          <li key={name} className={cn("inline-flex min-w-0 items-center gap-1", name === bout.winner ? "font-semibold text-ink" : "text-ink-2")}>
            {name === bout.winner && <Check aria-hidden className="size-3.5 shrink-0 text-good" />}
            <span className="min-w-0 break-words">{name}</span>
          </li>
        ))}
      </ul>
      {bout.winner && <p className="mt-0.5 text-xs text-ink-2">{[t.event.won.replace("{name}", bout.winner), how, bout.scorecards].filter(Boolean).join(" · ")}</p>}
    </li>
  )
}

export function hasSportStatistics(event: SportEvent): boolean {
  const { score, details } = event
  if (score.kind === "innings" || score.kind === "classification") return true
  return (details?.kind === "tennis" && details.rubbers.length > 0) || (details?.kind === "combat" && details.bouts.some((bout) => bout.winner))
}

/** Statistics: the full result as the source gives it. Everything here reveals the outcome. */
export function SportStatistics({ event, t }: { event: SportEvent; t: Dictionary }) {
  if (!hasSportStatistics(event)) return null
  const { score, details } = event
  const facts = resultFacts(event, t)
  return (
    <Panel title={t.sportTerms.result} icon={<Medal aria-hidden />}>
      <div className="space-y-4">
        {score.kind === "innings" && <CricketScorecard event={event} t={t} />}
        {score.kind === "classification" && <RaceTable entries={score.entries} t={t} />}
        {score.kind === "classification" && score.classes?.map((group) => (
          <section key={group.name}><h3 className="mb-1 text-sm font-semibold text-ink">{group.name}</h3><RaceTable entries={group.entries} t={t} /></section>
        ))}
        {details?.kind === "tennis" && details.rubbers.length > 0 && <TennisRubbers details={details} t={t} />}
        {details?.kind === "combat" && <BoutTable details={details} t={t} />}
        {facts.length > 0 && <FactList facts={facts} />}
        {score.kind === "classification" && score.out && <OutList out={score.out} t={t} />}
        {score.kind === "classification" && score.standings && <ChampionshipTable rows={score.standings} t={t} />}
      </div>
    </Panel>
  )
}

/** Live Updates: the feed has no running commentary for these sports, so this is what is confirmed, in order. */
export function SportUpdates({ event, t }: { event: SportEvent; t: Dictionary }) {
  const steps = sportSteps(event, t)
  if (steps.length === 0) return null
  return (
    <Panel title={t.match.liveUpdates} icon={<ListChecks aria-hidden />}>
      <ol className="relative space-y-3 text-sm before:absolute before:bottom-1.5 before:left-[5px] before:top-1.5 before:w-px before:bg-line">
        {steps.map((step) => (
          <li key={step} className="relative flex items-start gap-3 text-ink">
            <span aria-hidden className="relative mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-surface bg-brand" />
            <span className="min-w-0">{step}</span>
          </li>
        ))}
      </ol>
    </Panel>
  )
}

/** Participants for a fight card: every bout, which names people and states no result. */
export function CardParticipants({ details, t }: { details: CombatDetails; t: Dictionary }) {
  return (
    <Panel title={t.match.participants} icon={<Users aria-hidden />}>
      <ol className="grid gap-2.5 text-sm sm:grid-cols-2">
        {details.bouts.map((bout, index) => (
          <li key={index} className="min-w-0 rounded-lg border border-line px-3 py-2">
            {(bout.weightClass || bout.scheduledRounds) && <p className="text-xs text-ink-2">{[bout.weightClass && weightClassText(bout.weightClass, t), boutRounds(bout, t)].filter(Boolean).join(" · ")}</p>}
            <p className="flex flex-wrap items-center gap-x-3 font-medium text-ink">
              {bout.names.map((name) => <span key={name} className="inline-flex min-w-0 items-center gap-1">{name}<FavoriteStar team={name} /></span>)}
            </p>
          </li>
        ))}
      </ol>
    </Panel>
  )
}

/** Tennis lists each player's world ranking at the draw. */
export function RankedPlayers({ event, t }: { event: SportEvent; t: Dictionary }) {
  const ranks = event.details?.kind === "tennis" ? event.details.ranks : []
  if (ranks.every((rank) => rank === null)) return null
  return (
    <Panel title={t.match.participants} icon={<Users aria-hidden />}>
      <ul className="divide-y divide-line text-sm">
        {event.participants.map((participant, index) => (
          <li key={participant.name} className="flex min-h-11 items-center gap-2 py-1">
            <span className="min-w-0 flex-1 truncate font-medium text-ink">{participant.name}</span>
            {ranks[index] !== null && ranks[index] !== undefined && <span className="tabular rounded-full bg-surface-muted px-2 py-0.5 text-xs font-semibold text-ink-2">{t.sportTerms.ranking.replace("{rank}", String(ranks[index]))}</span>}
            <FavoriteStar team={participant.name} />
          </li>
        ))}
      </ul>
    </Panel>
  )
}

/** The rest of the weekend, so a session is never a dead end. */
export function WeekendSessions({ sessions, currentId, t, href }: { sessions: { id: string; name: string | null; status: SportEvent["status"] }[]; currentId: string; t: Dictionary; href(path: string): string }) {
  const others = sessions.filter((session) => session.id !== currentId)
  if (others.length === 0) return null
  return (
    <Panel title={t.sportTerms.weekendSessions} icon={<Flag aria-hidden />}>
      <ul className="-my-1 divide-y divide-line text-sm">
        {others.map((session) => (
          <li key={session.id} className="flex min-h-10 items-center justify-between gap-3 py-1">
            <a href={href(`/app/match/${session.id}`)} className="min-w-0 font-medium text-ink underline-offset-2 hover:underline">{session.name ?? t.sportTerms.sessions.race}</a>
            <span className="shrink-0 text-xs text-ink-2">{t.status[session.status]}</span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
