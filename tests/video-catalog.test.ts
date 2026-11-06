// Synthetic oEmbed responses for isolated tests only.
import { beforeEach, describe, expect, it, vi } from "vitest"
import { isApprovedChannel, verifyVideo, youtubeId } from "@/lib/video/catalog"
import { evaluateViewing, type VideoSource } from "@/lib/video/viewing"

const oembed = (authorUrl: string, status = 200) =>
  new Response(status === 200 ? JSON.stringify({ author_name: "Channel", author_url: authorUrl }) : "", { status })

beforeEach(() => vi.restoreAllMocks())

describe("youtubeId", () => {
  it.each([
    ["https://www.youtube.com/watch?v=CxDC8uvP7ns", "CxDC8uvP7ns"],
    ["https://youtube.com/watch?v=4_ok_kFvb-Q&t=3", "4_ok_kFvb-Q"],
    ["https://youtu.be/CxDC8uvP7ns", "CxDC8uvP7ns"],
  ])("reads %s", (url, id) => expect(youtubeId(url)).toBe(id))

  it.each([null, "", "https://evil.example/watch?v=CxDC8uvP7ns", "https://youtube.com.evil.example/watch?v=CxDC8uvP7ns", "javascript:alert(1)"])("rejects %s", (url) => expect(youtubeId(url)).toBeNull())
})

describe("approved channels", () => {
  it("accepts an official channel in any letter case", () => expect(isApprovedChannel("https://www.youtube.com/@TNTSportsAR")).toBe(true))
  it("refuses lookalikes and missing handles", () => {
    expect(isApprovedChannel("https://www.youtube.com/@NHLfanclips")).toBe(false)
    expect(isApprovedChannel("https://www.youtube.com/channel/UC123")).toBe(false)
    expect(isApprovedChannel(undefined)).toBe(false)
  })
})

describe("verifyVideo", () => {
  it("offers a video from an approved channel", async () => {
    vi.stubGlobal("fetch", async () => oembed("https://www.youtube.com/@NHL"))
    expect(await verifyVideo("aaaaaaaaaaa")).toEqual({ youtubeId: "aaaaaaaaaaa", channel: "Channel" })
  })

  it("leaves out an unapproved channel", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined)
    vi.stubGlobal("fetch", async () => oembed("https://www.youtube.com/@someone"))
    expect(await verifyVideo("bbbbbbbbbbb")).toBeNull()
  })

  it("leaves out a video whose owner blocks embedding or removed it", async () => {
    vi.stubGlobal("fetch", async () => oembed("", 401))
    expect(await verifyVideo("ccccccccccc")).toBeNull()
  })

  it("does not trust the listing cache when playback starts", async () => {
    vi.stubGlobal("fetch", async () => oembed("https://www.youtube.com/@NHL"))
    expect(await verifyVideo("ddddddddddd")).not.toBeNull()
    vi.stubGlobal("fetch", async () => oembed("", 404))
    expect(await verifyVideo("ddddddddddd", true)).toBeNull()
  })

  it("refuses playback when the check itself cannot run", async () => {
    vi.stubGlobal("fetch", async () => oembed("https://www.youtube.com/@NHL"))
    await verifyVideo("eeeeeeeeeee")
    vi.stubGlobal("fetch", async () => { throw new Error("offline") })
    expect(await verifyVideo("eeeeeeeeeee", true)).toBeNull()
  })
})

describe("public embeds in the viewing decision", () => {
  const source: VideoSource = {
    id: "s", matchId: "m", provider: "YouTube", type: "highlight", territories: [], providerEnforcesTerritory: true,
    validFromUTC: "2026-01-01T00:00:00Z", validToUTC: "2027-01-01T00:00:00Z", permitted: true, available: true,
    platforms: ["web"], requiresEntitlement: false, officialUrl: null,
  }
  const context = { country: null, platform: "web", entitled: false, now: new Date("2026-06-01T00:00:00Z") }

  it("leaves territory to the provider's player and never offers Watch Live", () => {
    const actions = evaluateViewing([source], context).options.map((option) => option.action)
    expect(actions).toContain("watch_highlights")
    expect(actions).not.toContain("watch_live")
  })

  it("still blocks a source without a confirmed territory otherwise", () => {
    expect(evaluateViewing([{ ...source, providerEnforcesTerritory: false }], context).reasons).toContain("territory_blocked")
  })
})

describe("channels each sport's feed lists", () => {
  it.each([
    "EuroLeague", "bkteurocup", "NFL", "CFL", "MLB", "KBO1982", "NHL", "KHL", "TennisTV", "WTA", "RolandGarros", "ICC", "BigBash", "windiescricket",
    "prem-rugby", "SixNationsRugby", "UnitedRugbyChampionship", "CEVolleyball", "UFC", "TNTFightSports", "DAZNBoxing", "Formula1", "MotoGP", "TNTSports", "bundesliga-at", "l1max_",
  ])("approves @%s", (handle) => expect(isApprovedChannel(`https://www.youtube.com/@${handle}`)).toBe(true))

  it.each(["thegametimehighlights", "motionstation4342", "mmaweekly", "mmacrazy", "persianmmabrothers", "themmaconnect", "chelseafc", "dodgers", "wwe"])("leaves out @%s", (handle) => {
    expect(isApprovedChannel(`https://www.youtube.com/@${handle}`)).toBe(false)
  })
})
