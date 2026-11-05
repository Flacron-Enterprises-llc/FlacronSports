import type { Locale } from "@/lib/i18n"
import type { MarketingCopy, SceneKind } from "@/lib/marketing"
import { AssistantScene, CommunityScene, DashboardScene, MatchScene, ReportsScene, ScoresScene, TeamsScene, WatchScene, type SceneProps } from "./scenes"
import { ShowcaseFrame } from "./showcase-frame"

const SCENES: Record<SceneKind, { scene: (props: SceneProps) => React.ReactElement; cursor: [number, number][] }> = {
  scores: { scene: ScoresScene, cursor: [[45, 18], [60, 50], [70, 70]] },
  match: { scene: MatchScene, cursor: [[30, 30], [50, 40], [70, 80]] },
  watch: { scene: WatchScene, cursor: [[30, 30], [60, 55], [75, 78]] },
  teams: { scene: TeamsScene, cursor: [[20, 25], [80, 35], [50, 85]] },
  reports: { scene: ReportsScene, cursor: [[45, 12], [55, 45], [70, 85]] },
  assistant: { scene: AssistantScene, cursor: [[70, 12], [40, 40], [50, 90]] },
  community: { scene: CommunityScene, cursor: [[30, 30], [75, 30], [75, 70]] },
}

const label = (m: MarketingCopy, locale: Locale) => `${m.show.label}${locale === "fr" ? " :" : ":"}`

/** Hero: the whole dashboard, always dark on the navy band. */
export function HeroMock({ m, locale, caption }: { m: MarketingCopy; locale: Locale; caption?: string }) {
  return (
    <div className="fs-float">
      <ShowcaseFrame label={label(m, locale)} sample={m.show.sample} caption={caption ?? m.captions.hero} onBand={!caption} forceDark={!caption} cursor={[[70, 30], [62, 72], [30, 52]]}>
        <DashboardScene s={m.scene} locale={locale} />
      </ShowcaseFrame>
    </div>
  )
}

export function FeatureMock({ kind, m, locale }: { kind: SceneKind; m: MarketingCopy; locale: Locale }) {
  const { scene: Scene, cursor } = SCENES[kind]
  return (
    <ShowcaseFrame label={label(m, locale)} sample={m.show.sample} caption={m.captions[kind]} cursor={cursor}>
      <Scene s={m.scene} locale={locale} />
    </ShowcaseFrame>
  )
}
