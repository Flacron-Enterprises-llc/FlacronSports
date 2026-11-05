import {
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  Home,
  Lock,
  MessageCircleQuestion,
  MonitorPlay,
  Newspaper,
  Search,
  Send,
  Shield,
  ShieldCheck,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react"
import type { Locale } from "@/lib/i18n"
import type { MarketingCopy } from "@/lib/marketing"
import { SPORTS } from "@/lib/sports/types"

// Original illustrative UI built from divs. Generic team names and masked values only:
// no real clubs, no scores, no times and no counts. Every scene sits in a ShowcaseFrame.

type Strings = MarketingCopy["scene"]
export type SceneProps = { s: Strings; locale: Locale }

const st = (index: number) => ({ ["--i" as string]: index }) as React.CSSProperties

type Tone = "good" | "warn" | "live" | "hot" | "neutral"

function Chip({ children, tone = "neutral", dot }: { children: React.ReactNode; tone?: Tone; dot?: boolean }) {
  const style = tone === "neutral" ? "border-line bg-surface-muted text-ink-3" : `fs-chip-${tone}`
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-1.5 py-px text-[10px] font-semibold leading-4 ${style}`}>
      {dot && <span className="size-1 rounded-full bg-current" />}
      {children}
    </span>
  )
}

function Panel({ title, icon: Icon, children, className = "", right }: { title: string; icon?: LucideIcon; children: React.ReactNode; className?: string; right?: React.ReactNode }) {
  return (
    <div className={`rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow-sm)] ${className}`}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <p className="inline-flex min-w-0 items-center gap-1.5 text-[11.5px] font-semibold text-ink">
          {Icon && <Icon className="size-3.5 shrink-0 text-brand" />} <span className="truncate">{title}</span>
        </p>
        {right}
      </div>
      {children}
    </div>
  )
}

const Bar = ({ className = "" }: { className?: string }) => <span className={`block h-1.5 rounded-full bg-surface-muted ${className}`} />

function Crest({ className = "size-5" }: { className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full border border-line bg-surface-muted text-ink-3 ${className}`}>
      <Shield className="size-1/2" />
    </span>
  )
}

function MaskedScore({ s }: { s: Strings }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-surface-muted px-1.5 py-1 text-[9.5px] font-semibold text-ink-3">
      <EyeOff className="size-3" /> {s.hidden}
    </span>
  )
}

function MatchRow({ s, status, index, highlight, home = s.home, away = s.away }: { s: Strings; status: "live" | "upcoming" | "finished"; index: number; highlight?: boolean; home?: string; away?: string }) {
  return (
    <li className={`fs-st rounded-lg border border-line bg-surface p-2.5 ${highlight ? "fs-hl" : ""}`} style={st(index)}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-ink"><Crest /> <span className="truncate">{home}</span></p>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-ink"><Crest /> <span className="truncate">{away}</span></p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {status === "live" && <Chip tone="live" dot>{s.live}</Chip>}
          {status === "upcoming" && <Chip tone="hot">{s.upcoming}</Chip>}
          {status === "finished" && <Chip>{s.finished}</Chip>}
          {status === "upcoming" ? <span className="text-[9.5px] text-ink-3">{s.localTime}</span> : <MaskedScore s={s} />}
        </div>
      </div>
    </li>
  )
}

const NAV_ICONS: LucideIcon[] = [Home, CalendarDays, MonitorPlay, Newspaper, Star, MessageCircleQuestion]

function MiniSidebar({ s, active = 0 }: { s: Strings; active?: number }) {
  return (
    <div className="hidden w-[150px] shrink-0 flex-col bg-navy-deep px-2 py-3 text-white sm:flex">
      <p data-logotype className="px-2 pb-3 font-display text-[11px] font-semibold tracking-[0.08em]">FLACRON<span className="text-orange">SPORT</span></p>
      <ul className="space-y-0.5">
        {s.nav.map((label, index) => {
          const Icon = NAV_ICONS[index]
          const on = index === active
          return (
            <li key={label} className={`relative flex items-center gap-2 rounded-md px-2 py-1.5 text-[10.5px] ${on ? "bg-white/[0.09] text-white" : "text-white/60"}`}>
              {on && <span className="absolute left-0 top-1/2 h-3.5 w-[2px] -translate-y-1/2 rounded-r bg-orange" />}
              <Icon className={`size-3 ${on ? "text-orange" : "text-white/45"}`} /> <span className="truncate">{label}</span>
            </li>
          )
        })}
      </ul>
      <div className="mt-auto rounded-lg border border-white/10 bg-white/[0.04] p-2">
        <p className="font-display text-[11px] font-semibold">{s.plan}</p>
        <p className="mt-1 text-[8.5px] text-white/60">{s.requests}</p>
        <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/10">
          <span className="fs-grow-x block h-full w-2/3 rounded-full bg-[var(--fs-blue)]" />
        </span>
      </div>
    </div>
  )
}

function TopBar({ s }: { s: Strings }) {
  return (
    <div className="flex items-center gap-3 border-b border-line bg-surface px-3.5 py-2">
      <div className="mx-auto flex h-7 w-full min-w-0 max-w-[260px] items-center gap-1.5 rounded-md border border-line bg-surface-muted px-2 text-[10px] text-ink-3">
        <Search className="size-3 shrink-0" /> <span className="truncate">{s.search}</span>
      </div>
      <Bell className="size-3.5 shrink-0 text-ink-3" />
      <span className="inline-flex size-6 shrink-0 rounded-full bg-gradient-to-br from-navy to-[var(--fs-blue)]" />
    </div>
  )
}

/** Hero: the signed-in dashboard, with your teams first and scores hidden. */
export function DashboardScene({ s, locale }: SceneProps) {
  const sports = SPORTS.filter((sport) => sport.enabled).slice(0, 4)
  return (
    <div className="flex min-h-[420px] bg-bg">
      <MiniSidebar s={s} />
      <div className="min-w-0 flex-1">
        <TopBar s={s} />
        <div className="space-y-3 p-3.5">
          <div className="fs-st fs-band relative overflow-hidden rounded-xl px-4 py-3.5" style={st(0)}>
            <div className="fs-grid absolute inset-0 opacity-70" />
            <div className="relative">
              <p className="font-display text-[15px] font-semibold text-white">{s.welcome}</p>
              <p className="mt-0.5 text-[10.5px] text-white/70">{s.welcomeLead}</p>
            </div>
          </div>
          <div className="fs-st flex flex-wrap gap-1.5" style={st(1)}>
            {sports.map((sport, index) => (
              <span key={sport.id} className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${index === 0 ? "fs-chip-hot" : "border-line bg-surface text-ink-2"}`}>{sport.name[locale]}</span>
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title={s.yourTeams} icon={Star}>
              <ul className="space-y-2">
                <MatchRow s={s} status="live" index={2} highlight />
                <MatchRow s={s} status="finished" index={3} home={s.otherHome} away={s.otherAway} />
              </ul>
            </Panel>
            <Panel title={s.comingUp} icon={CalendarDays}>
              <ul className="space-y-2">
                <MatchRow s={s} status="upcoming" index={4} />
                <MatchRow s={s} status="upcoming" index={5} home={s.otherHome} away={s.otherAway} />
              </ul>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ScoresScene({ s }: SceneProps) {
  return (
    <div className="flex min-h-[400px] bg-bg">
      <MiniSidebar s={s} active={1} />
      <div className="min-w-0 flex-1 space-y-2.5 p-3.5">
        <div className="fs-st flex items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[11px] shadow-[var(--shadow-sm)]" style={st(0)}>
          <ChevronLeft className="size-3.5 shrink-0 text-ink-3" />
          <span className="truncate text-ink-3">{s.yesterday}</span>
          <span className="rounded-md bg-hot px-2 py-0.5 text-[10px] font-semibold text-hot-on">{s.today}</span>
          <span className="truncate text-ink-3">{s.tomorrow}</span>
          <ChevronRight className="size-3.5 shrink-0 text-ink-3" />
        </div>
        <div className="fs-st flex flex-wrap gap-1.5" style={st(1)}>
          {[s.all, s.live, s.upcoming, s.finished].map((label, index) => (
            <span key={label} className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${index === 0 ? "fs-chip-hot" : "border-line bg-surface text-ink-2"}`}>{label}</span>
          ))}
        </div>
        <ul className="space-y-2">
          <MatchRow s={s} status="live" index={2} />
          <MatchRow s={s} status="upcoming" index={3} highlight home={s.otherHome} away={s.otherAway} />
          <MatchRow s={s} status="finished" index={4} />
        </ul>
        <p className="fs-st flex items-center gap-1.5 border-t border-line pt-2 text-[9.5px] text-ink-3" style={st(5)}>
          <ShieldCheck className="size-3 shrink-0 text-good" /> {s.sourceLine}
        </p>
      </div>
    </div>
  )
}

export function MatchScene({ s }: SceneProps) {
  return (
    <div className="space-y-3 bg-bg p-4">
      <div className="fs-st rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-sm)]" style={st(0)}>
        <div className="flex items-center justify-between gap-2">
          <Chip tone="live" dot>{s.live}</Chip>
          <Chip tone="good"><EyeOff className="size-2.5" /> {s.spoilerOn}</Chip>
        </div>
        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
          <div className="min-w-0"><Crest className="mx-auto size-9" /><p className="mt-1.5 truncate text-[11px] font-semibold text-ink">{s.home}</p></div>
          <MaskedScore s={s} />
          <div className="min-w-0"><Crest className="mx-auto size-9" /><p className="mt-1.5 truncate text-[11px] font-semibold text-ink">{s.away}</p></div>
        </div>
        <p className="mt-3 text-center">
          <span className="fs-hl inline-flex items-center gap-1 rounded-md bg-hot px-2.5 py-1 text-[10px] font-semibold text-hot-on"><Eye className="size-3" /> {s.reveal}</span>
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Panel title={s.competition} icon={CalendarDays} className="fs-st">
          <dl className="space-y-2 text-[10.5px]">
            <div className="flex items-center justify-between gap-2"><dt className="text-ink-3">{s.kickoff}</dt><dd className="truncate font-semibold text-ink">{s.localTime}</dd></div>
            <div className="flex items-center justify-between gap-3"><dt className="text-ink-3">{s.venue}</dt><dd className="w-1/2"><Bar /></dd></div>
            <div className="flex items-center justify-between gap-3"><dt className="text-ink-3">{s.competition}</dt><dd className="w-1/2"><Bar /></dd></div>
          </dl>
        </Panel>
        <Panel title={s.viewing} icon={MonitorPlay} className="fs-st">
          <p className="text-[10.5px] leading-4 text-ink-2">{s.checkedCountry}</p>
          <span className="mt-2 inline-flex rounded-md bg-navy px-2.5 py-1 text-[10px] font-semibold text-white">{s.followLive}</span>
        </Panel>
      </div>
    </div>
  )
}

export function WatchScene({ s }: SceneProps) {
  const rows: [string, string, string, Tone][] = [
    [s.watchLive, s.watchLiveState, s.notHere, "neutral"],
    [s.broadcaster, s.broadcasterState, s.where, "warn"],
    [s.followLive, s.followState, s.always, "good"],
  ]
  return (
    <div className="min-h-[340px] space-y-3 bg-bg p-4">
      <div className="fs-st flex items-center justify-between gap-2" style={st(0)}>
        <p className="min-w-0 truncate font-display text-[13px] font-semibold text-ink">{s.viewing}</p>
        <Chip tone="good"><ShieldCheck className="size-2.5" /> {s.checkedCountry}</Chip>
      </div>
      <ul className="space-y-2">
        {rows.map(([title, body, state, tone], index) => (
          <li key={title} className={`fs-st flex items-center justify-between gap-3 rounded-lg border border-line bg-surface p-3 ${index === 2 ? "fs-hl" : ""}`} style={st(index + 1)}>
            <div className="min-w-0">
              <p className="text-[11.5px] font-semibold text-ink">{title}</p>
              <p className="text-[10px] leading-4 text-ink-3">{body}</p>
            </div>
            <Chip tone={tone}>{state}</Chip>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function TeamsScene({ s }: SceneProps) {
  const alerts: [string, boolean][] = [[s.alertStart, true], [s.alertFinal, true], [s.quiet, true], [s.email, false]]
  return (
    <div className="grid min-h-[340px] gap-3 bg-bg p-4 sm:grid-cols-2">
      <Panel title={s.yourTeams} icon={Star}>
        <ul className="space-y-1.5">
          {[s.otherHome, s.home, s.away].map((team, index) => (
            <li key={team} className="fs-st flex items-center gap-2 rounded-md border border-line p-2 text-[11px] font-semibold text-ink" style={st(index)}>
              <Crest /> <span className="min-w-0 flex-1 truncate">{team}</span> <Star className="size-3 shrink-0 fill-current text-orange" />
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title={s.alerts} icon={Bell}>
        <ul className="space-y-2">
          {alerts.map(([label, on], index) => (
            <li key={label} className="fs-st flex items-center justify-between gap-2 text-[10.5px] text-ink-2" style={st(index + 1)}>
              <span className="min-w-0 truncate">{label}</span>
              <span className={`flex h-3.5 w-6 shrink-0 items-center rounded-full p-0.5 ${on ? "justify-end bg-good" : "bg-line-strong"}`}>
                <span className="size-2.5 rounded-full bg-white" />
              </span>
            </li>
          ))}
        </ul>
      </Panel>
      <div className="fs-pop-in flex items-center gap-2.5 rounded-xl border border-line bg-surface-raised p-3 shadow-[var(--shadow-md)] sm:col-span-2">
        <span className="fs-tint-hot inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-hot-text"><Bell className="size-4" /></span>
        <span className="min-w-0">
          <span className="block truncate text-[11px] font-semibold text-ink">{s.notifTitle}</span>
          <span className="block truncate text-[10px] text-ink-3">{s.notifBody}</span>
        </span>
      </div>
    </div>
  )
}

export function ReportsScene({ s }: SceneProps) {
  return (
    <div className="flex min-h-[340px] bg-bg">
      <MiniSidebar s={s} active={3} />
      <div className="min-w-0 flex-1 space-y-2.5 p-3.5">
        <div className="fs-st flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-[10.5px] text-ink-3" style={st(0)}>
          <Search className="size-3 shrink-0" /> <span className="truncate">{s.searchReports}</span>
        </div>
        <article className="fs-st rounded-xl border border-line bg-surface p-3.5 shadow-[var(--shadow-sm)]" style={st(1)}>
          <Chip tone="hot"><FileText className="size-2.5" /> {s.automated}</Chip>
          <p className="mt-2 font-display text-[13px] font-semibold text-ink">{s.reportTitle}</p>
          <div className="mt-3 space-y-1.5">
            <Bar /><Bar className="w-11/12" /><Bar className="w-3/4" />
          </div>
          <p className="mt-3 flex items-center gap-1.5 border-t border-line pt-2 text-[9.5px] text-ink-3">
            <ShieldCheck className="size-3 shrink-0 text-good" /> {s.source}: {s.verified}
          </p>
        </article>
        <div className="fs-st fs-hl flex items-center justify-between gap-2 rounded-lg border border-line bg-surface p-2.5" style={st(2)}>
          <span className="min-w-0 truncate text-[11px] font-semibold text-ink">{s.reportTitle}</span>
          <span className="shrink-0 text-[10px] font-semibold text-hot-text">{s.read}</span>
        </div>
      </div>
    </div>
  )
}

function Bubble({ children, mine, index }: { children: React.ReactNode; mine?: boolean; index: number }) {
  return (
    <div className={`fs-st max-w-[88%] rounded-xl px-3 py-2 text-[11px] leading-[1.45] ${mine ? "ml-auto bg-navy text-white" : "border border-line bg-surface text-ink-2"}`} style={st(index)}>
      {children}
    </div>
  )
}

export function AssistantScene({ s }: SceneProps) {
  return (
    <div className="min-h-[360px] space-y-2.5 bg-bg p-4">
      <Bubble mine index={0}>{s.question}</Bubble>
      <Bubble index={1}>
        {s.answer}
        <span className="mt-1.5 block text-[9.5px] text-ink-3">{s.ruleNote}</span>
        <span className="mt-1.5 block"><Chip tone="good"><ShieldCheck className="size-2.5" /> {s.ruleSource}</Chip></span>
      </Bubble>
      <Bubble mine index={2}>{s.question2}</Bubble>
      <Bubble index={3}>{s.answer2}</Bubble>
      <div className="fs-st flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[10.5px] text-ink-3" style={st(4)}>
        <span className="min-w-0 flex-1 truncate">{s.ask}</span> <Send className="size-3.5 shrink-0 text-hot-text" />
      </div>
    </div>
  )
}

export function CommunityScene({ s }: SceneProps) {
  return (
    <div className="grid min-h-[340px] gap-3 bg-bg p-4 sm:grid-cols-[1.3fr_1fr]">
      <Panel title={s.chat} icon={Users} right={<Chip>{s.moderated}</Chip>}>
        <ul className="space-y-2">
          {["w-11/12", "w-2/3", "w-4/5"].map((width, index) => (
            <li key={width} className="fs-st flex items-center gap-2" style={st(index)}>
              <Crest />
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-semibold text-ink">{s.fan}</span>
                <Bar className={`mt-1 ${width}`} />
              </span>
            </li>
          ))}
        </ul>
      </Panel>
      <div className="space-y-3">
        <Panel title={s.rooms} icon={Lock} className="fs-st">
          <p className="text-[10px] leading-4 text-ink-3">{s.roomNote}</p>
        </Panel>
        <Panel title={s.prediction} icon={Check} className="fs-st">
          <p className="text-[10px] leading-4 text-ink-3">{s.predictionNote}</p>
        </Panel>
      </div>
    </div>
  )
}
