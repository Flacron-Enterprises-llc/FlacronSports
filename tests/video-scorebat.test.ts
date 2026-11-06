// Synthetic provider responses and an in-memory store for isolated tests only.
import { beforeEach, describe, expect, it, vi } from "vitest"

const docs = new Map<string, Record<string, unknown>>()

vi.mock("@/lib/firebase-admin", () => ({
  getAdminAuth: () => null,
  getAdminDb: () => ({
    collection: () => ({
      doc: (id: string) => ({
        get: async () => ({ exists: docs.has(id), data: () => docs.get(id) }),
        set: async (value: Record<string, unknown>) => void docs.set(id, value),
      }),
    }),
  }),
}))

import { clearClipCache, normalizeClips, refreshClips, storedClips } from "@/lib/video/scorebat"

const embed = (src: string) => `<div><iframe src='${src}' allowfullscreen></iframe></div>`
const row = (src = "https://www.scorebat.com/embed/v/abc123==/?utm_source=api") => ({
  title: "A - B", competition: "ENGLAND: Premier League", thumbnail: "https://www.scorebat.com/thumb.jpg", date: "2026-10-29T19:00:00+00:00",
  videos: [{ id: "video-1", title: "Highlights", embed: embed(src) }],
})
const feed = (rows: unknown[]) => new Response(JSON.stringify({ response: rows }), { status: 200 })

beforeEach(() => {
  docs.clear()
  clearClipCache()
  vi.stubEnv("SCOREBAT_TOKEN", "secret-token")
})

describe("normalizeClips", () => {
  it("keeps the player address and drops the raw embed html", () => {
    const [clip] = normalizeClips([row()])
    expect(clip.embedUrl).toBe("https://www.scorebat.com/embed/v/abc123==/?utm_source=api")
    expect(JSON.stringify(clip)).not.toContain("<iframe")
  })

  it.each([
    "https://evil.example/embed/v/abc/",
    "https://www.scorebat.com.evil.example/embed/v/abc/",
    "javascript:alert(1)",
    "https://www.scorebat.com/embed/v/abc/?x=<script>",
  ])("refuses %s", (src) => expect(normalizeClips([row(src)])).toEqual([]))

  it("skips rows without a playable video", () => {
    expect(normalizeClips([{ title: "A - B", videos: [] }])).toEqual([])
    expect(normalizeClips(null)).toEqual([])
  })
})

describe("refreshClips", () => {
  it("does nothing without a token", async () => {
    vi.stubEnv("SCOREBAT_TOKEN", "")
    const fetcher = vi.fn(async () => feed([row()]))
    vi.stubGlobal("fetch", fetcher)
    expect(await refreshClips()).toBe("disabled")
    expect(fetcher).not.toHaveBeenCalled()
  })

  it("stores the feed and spends no second call while it is fresh", async () => {
    const fetcher = vi.fn(async () => feed([row()]))
    vi.stubGlobal("fetch", fetcher)
    expect(await refreshClips()).toBe("stored_1")
    expect(await refreshClips()).toBe("fresh")
    expect(fetcher).toHaveBeenCalledTimes(1)
    clearClipCache()
    expect(await storedClips()).toHaveLength(1)
  })

  it("keeps the last good copy when the provider fails, and never stores the token", async () => {
    vi.stubGlobal("fetch", async () => feed([row()]))
    const start = Date.now()
    await refreshClips(start)
    vi.stubGlobal("fetch", async () => new Response("", { status: 500 }))
    expect(await refreshClips(start + 7 * 3_600_000)).toBe("failed_500")
    expect(await storedClips()).toHaveLength(1)
    expect(JSON.stringify([...docs.values()])).not.toContain("secret-token")
  })

  it("stops showing a copy older than a week", async () => {
    vi.stubGlobal("fetch", async () => feed([row()]))
    const start = Date.now()
    await refreshClips(start)
    clearClipCache()
    expect(await storedClips(start + 8 * 86_400_000)).toEqual([])
  })
})
