import { describe, expect, it } from "vitest"
import { ADDONS } from "@/lib/billing/addons"
import { annualSavingPercent, EVERY_PLAN, PLAN_HIGHLIGHTS, PLAN_MATRIX } from "@/lib/billing/matrix"
import { PLANS } from "@/lib/billing/plans"

const cell = (id: string, plan: "basic" | "plus" | "premium") => PLAN_MATRIX.find((row) => row.id === id)?.cells[plan]

describe("the plan table matches the client's updated section 12", () => {
  it("has no free plan to buy", () => {
    expect(Object.keys(PLAN_HIGHLIGHTS)).toEqual(["basic", "plus", "premium"])
    expect(PLANS.none).toMatchObject({ favoritesLimit: 0, assistantRequestsPerMonth: 0, privateRooms: null, displayAds: false })
  })

  it("has the published prices", () => {
    expect([PLANS.basic.monthlyPriceUsd, PLANS.plus.monthlyPriceUsd, PLANS.premium.monthlyPriceUsd]).toEqual([19.99, 29.99, 49.99])
    expect([PLANS.basic.annualPriceUsd, PLANS.plus.annualPriceUsd, PLANS.premium.annualPriceUsd]).toEqual([199.99, 299.99, 499.99])
  })

  it("lists every benefit row, in order", () => {
    expect(PLAN_MATRIX.map((row) => row.label.en)).toEqual([
      "Scores and schedules", "Authorized public video", "Favorite teams or athletes", "Alerts", "FlacronSport display ads",
      "News and summaries", "Sports assistant per month", "Private room creation", "Room participant limit", "Advanced comparison tools",
    ])
  })

  it("states the limits the backend enforces", () => {
    expect(cell("favorites", "basic")?.text.en).toBe("5 total")
    expect(cell("assistant", "basic")?.text.en).toBe("5 requests")
    expect(cell("assistant", "plus")?.text.en).toBe("100 requests")
    expect(cell("assistant", "premium")?.text.en).toBe("300 requests")
    expect(cell("rooms", "plus")?.text.en).toBe("3 active rooms")
    expect(cell("rooms", "premium")?.text.en).toBe("10 active rooms")
    expect(cell("participants", "plus")?.text.en).toBe("20 per room")
    expect(cell("participants", "premium")?.text.en).toBe("50 per room")
  })

  it("has the published add-on prices", () => {
    expect(Object.values(ADDONS).map((addon) => addon.priceUsd)).toEqual([4.99, 1.99, 2.99, 2.99])
  })

  it("lists what every plan includes", () => {
    expect(EVERY_PLAN).toHaveLength(7)
  })
})

describe("every benefit in the spec is offered", () => {
  it("states the paid benefits exactly", () => {
    expect(cell("alerts", "premium")?.text.en).toBe("All supported alerts and advanced filters")
    expect(cell("news", "plus")?.text.en).toBe("Full personalized reports")
    expect(cell("news", "premium")?.text.en).toBe("Full reports and deeper analysis")
    expect(cell("comparison", "plus")?.text.en).toBe("Basic comparison")
    expect(cell("comparison", "premium")?.text.en).toBe("Advanced comparison and saved views")
  })

  it("has French for every cell, and nothing is marked as coming soon", () => {
    for (const row of PLAN_MATRIX) {
      expect(row.label.fr).toBeTruthy()
      for (const value of Object.values(row.cells)) {
        expect(value.text.en).toBeTruthy()
        expect(value.text.fr).toBeTruthy()
        expect(value.text.en).not.toMatch(/coming soon/i)
      }
    }
    expect(Object.values(PLAN_HIGHLIGHTS).flat().every((line) => line.en && line.fr)).toBe(true)
  })
})

describe("annual saving", () => {
  it("is worked out from the real prices", () => {
    expect(annualSavingPercent("basic")).toBe(17)
    expect(annualSavingPercent("plus")).toBe(17)
    expect(annualSavingPercent("premium")).toBe(17)
  })
})
