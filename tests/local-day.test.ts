import { describe, expect, it } from "vitest"
import { localDate, onLocalDay, utcDatesFor, validZone } from "@/lib/local-day"

describe("a member's own day", () => {
  it("reads Karachi's evening before as part of the day", () => expect(utcDatesFor("2026-11-09", "Asia/Karachi")).toEqual(["2026-11-08", "2026-11-09"]))
  it("reads New York's next UTC day as part of the day", () => expect(utcDatesFor("2026-11-09", "America/New_York")).toEqual(["2026-11-09", "2026-11-10"]))
  it("needs one date in UTC", () => expect(utcDatesFor("2026-11-09", "UTC")).toEqual(["2026-11-09"]))

  it("files Sunday Night Football on Sunday in New York", () => {
    const game = { scheduledStartUTC: "2026-11-09T01:20:00.000Z", dateOnly: false }
    expect(onLocalDay(game, "2026-11-08", "America/New_York", "2026-11-09")).toBe(true)
    expect(onLocalDay(game, "2026-11-09", "America/New_York", "2026-11-09")).toBe(false)
  })

  it("files a late UTC kickoff on the next day in Karachi", () => {
    const game = { scheduledStartUTC: "2026-11-08T20:00:00.000Z", dateOnly: false }
    expect(onLocalDay(game, "2026-11-09", "Asia/Karachi", "2026-11-08")).toBe(true)
  })

  it("keeps a date-only game on its own date", () => {
    const game = { scheduledStartUTC: "2026-11-05T00:00:00.000Z", dateOnly: true }
    expect(onLocalDay(game, "2026-11-05", "America/New_York", "2026-11-05")).toBe(true)
    expect(onLocalDay(game, "2026-11-04", "America/New_York", "2026-11-05")).toBe(false)
  })

  it("falls back to UTC for a zone it cannot read", () => expect(validZone("Mars/Base")).toBe("UTC"))
  it("gives the local date", () => expect(localDate(new Date("2026-11-07T22:00:00Z"), "Asia/Karachi")).toBe("2026-11-08"))
})
