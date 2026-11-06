// Guards the promises the marketing site makes in copy and source.
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { getDictionary } from "@/lib/i18n"
import { FEATURES, getMarketing } from "@/lib/marketing"
import { SOCIAL_LINKS } from "@/lib/site"

const leaves = (value: unknown, prefix = ""): string[] =>
  typeof value === "object" && value !== null
    ? Object.entries(value).flatMap(([key, item]) => leaves(item, `${prefix}${key}.`))
    : [prefix]

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : [path]
  })

const source = [...files("app/[locale]/(site)"), ...files("components/site")].filter((path) => /\.tsx?$/.test(path))
const copy = JSON.stringify([getMarketing("en"), getMarketing("fr"), FEATURES])

describe("marketing site", () => {
  it("gives French the same copy keys as English", () => {
    expect(leaves(getMarketing("fr")).sort()).toEqual(leaves(getMarketing("en")).sort())
    for (const feature of FEATURES) expect(leaves(feature.fr).sort()).toEqual(leaves(feature.en).sort())
  })
  it("marks no feature as coming soon, and says nothing of the kind about community", () => {
    expect(FEATURES.filter((feature) => feature.comingSoon)).toEqual([])
    const community = JSON.stringify([FEATURES.find((feature) => feature.slug === "community"), getMarketing("en").captions.community, getMarketing("fr").captions.community])
    expect(community).not.toMatch(/coming soon|bientôt|not available yet|pas encore/i)
  })
  it("keeps the broadcast sentence next to watch content", () => {
    expect(FEATURES.find((feature) => feature.slug === "watch-options")?.broadcastNote).toBe(true)
    expect(getDictionary("en").watch.disclaimer).toContain("do not guarantee universal broadcast access")
  })
  it("shows no AI wording, vendors or stack details", () => {
    expect(copy).not.toMatch(/\bAI\b|\bIA\b/)
    expect(copy).not.toMatch(/TheSportsDB|Stripe|Firebase|AWS|Amazon|\bSES\b|\bUTC\b|sandbox|\bAPI\b/)
  })
  it("never fetches sports data from a marketing page", () => {
    // A share card is one game a member chose to share, not a browsable sports page.
    for (const path of source.filter((item) => !item.replace(/\\/g, "/").includes("/share/"))) expect(readFileSync(path, "utf8"), path).not.toMatch(/lib\/sports\/service|components\/sports\//)
  })
  it("links into the product only through the signed-in dashboard link", () => {
    const linked = source.filter((path) => /["'`]\/app[/"'`]/.test(readFileSync(path, "utf8")))
    expect(linked.map((path) => path.replace(/\\/g, "/"))).toEqual(["components/site/header.tsx"])
    expect(readFileSync("components/site/header.tsx", "utf8").match(/["'`]\/app[^"'`]*["'`]/g)?.every((match) => match.slice(1, -1) === "/app")).toBe(true)
  })
  it("uses no digits in illustrative scenes", () => {
    for (const locale of ["en", "fr"] as const) expect(Object.values(getMarketing(locale).scene).flat().join(" ")).not.toMatch(/\d/)
  })
  it("lists the seven official social profiles in order", () => {
    expect(SOCIAL_LINKS.map((link) => link.id)).toEqual(["facebook", "instagram", "linkedin", "pinterest", "tiktok", "youtube", "x"])
  })
})
