// Goal labels are the feed's real wording, which states the score.
import React, { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const prefs = vi.hoisted(() => ({ spoilerMode: false }))
// The test transform compiles JSX to React.createElement rather than the automatic runtime.
Object.assign(globalThis, { React })

vi.mock("@/lib/firebase-admin", () => ({ getAdminAuth: () => null, getAdminDb: () => null }))
vi.mock("@/components/account/prefs-provider", async () => {
  const { DEFAULT_PREFERENCES } = await import("@/lib/me/preferences-defaults")
  return { usePreferences: () => ({ prefs: { ...DEFAULT_PREFERENCES, spoilerMode: prefs.spoilerMode, favorites: [], timeZone: "UTC" }, signedIn: false, update: async () => true }) }
})
vi.mock("@/lib/use-locale", async () => {
  const { getDictionary } = await import("@/lib/i18n")
  return { useLocale: () => ({ locale: "en", t: getDictionary("en"), href: (path: string) => path }) }
})

import { ClipPlayer, ShowMore } from "@/components/video/clip-player"
import type { ClipVideo } from "@/lib/video/scorebat"

const videos: ClipVideo[] = [
  { id: "a", kind: "goal", label: "1-0 Paulo Moreira" },
  { id: "b", kind: "highlight", label: "Highlights" },
  { id: "c", kind: "match", label: "" },
]
const render = (list: ClipVideo[], lead = "b") => renderToStaticMarkup(createElement(ClipPlayer, { leadId: lead, videos: list, title: "Famalicao - Arouca", thumbnailUrl: "https://www.scorebat.com/og/m/og1.jpeg" }))

beforeEach(() => {
  prefs.spoilerMode = false
})

describe("a game's player", () => {
  it("groups the goals under the game", () => {
    const html = render(videos)
    expect(html).toContain("Goals")
    expect(html).toContain("1-0 Paulo Moreira")
    expect(html).toContain("Full match view")
  })

  it("hides goal titles, the match view and the frame in spoiler mode", () => {
    prefs.spoilerMode = true
    const html = render(videos)
    expect(html).not.toContain("Paulo Moreira")
    expect(html).not.toContain("og1.jpeg")
    expect(html).toContain("Show goals")
    expect(html).toContain("Show full match view")
  })

  it("numbers a second highlight and names a stream as a stream", () => {
    const html = render([{ id: "s", kind: "live", label: "Live Stream" }, { id: "b", kind: "highlight", label: "Highlights" }, { id: "d", kind: "highlight", label: "Highlights" }], "s")
    expect(html).toContain("Live stream")
    expect(html).toContain("Play live stream")
    expect(html).toContain("Highlights 2")
  })

  it("adds no choices for one lone highlight", () => {
    expect(render([videos[1]])).not.toContain("aria-pressed")
  })
})

describe("a long list", () => {
  const items = Array.from({ length: 14 }, (_, index) => createElement("li", { key: index }, `Game ${index}`))
  it("starts with the first games and offers the rest", () => {
    const html = renderToStaticMarkup(createElement(ShowMore, { first: 12, label: "Show all {count} games", children: items }))
    expect(html).toContain("Game 11")
    expect(html).not.toContain("Game 12")
    expect(html).toContain("Show all 14 games")
  })
})
