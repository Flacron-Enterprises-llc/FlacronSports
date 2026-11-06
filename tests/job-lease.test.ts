// The tick lease, skipped runs and the provider budget across tasks.
import { readFileSync } from "node:fs"
import { afterEach, describe, expect, it, vi } from "vitest"
import { fakeDb } from "./fake-db"

const { rows, store } = vi.hoisted(() => ({ rows: new Map<string, Record<string, unknown>>(), store: { current: null as unknown } }))

vi.mock("@/lib/firebase-admin", () => ({
  getAdminAuth: () => null,
  getAdminDb: () => ({ collection: (name: string) => ({ doc: (id: string) => ({ set: async (data: Record<string, unknown>) => void rows.set(`${name}/${id}`, data) }) }) }),
}))
vi.mock("@/lib/doc-db", async (original) => ({ ...(await original<typeof import("@/lib/doc-db")>()), firestoreDocDb: () => store.current }))

import { POST } from "@/app/api/jobs/tick/route"
import { releaseTickLease, takeTickLease, TICK_LEASE_MS } from "@/lib/jobs/lease"
import { runTick } from "@/lib/jobs/tick"
import { runId } from "@/lib/ops/runs"

const NOW = new Date("2026-11-05T18:00:00Z")

afterEach(() => {
  rows.clear()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("tick lease", () => {
  it("lets one task hold it until it is released", async () => {
    const { db } = fakeDb()
    const owner = await takeTickLease(db, NOW)
    expect(owner).toEqual(expect.any(String))
    expect(await takeTickLease(db, NOW)).toBeNull()
    await releaseTickLease(db, owner as string)
    expect(await takeTickLease(db, NOW)).toEqual(expect.any(String))
  })
  it("expires by itself, so a crash cannot stop the jobs", async () => {
    const { db } = fakeDb()
    await takeTickLease(db, NOW)
    expect(await takeTickLease(db, new Date(NOW.getTime() + TICK_LEASE_MS - 1))).toBeNull()
    expect(await takeTickLease(db, new Date(NOW.getTime() + TICK_LEASE_MS))).toEqual(expect.any(String))
  })
  it("cannot be released by a run that outlasted it", async () => {
    const { db } = fakeDb()
    const late = await takeTickLease(db, NOW)
    await takeTickLease(db, new Date(NOW.getTime() + TICK_LEASE_MS))
    await releaseTickLease(db, late as string)
    expect(await takeTickLease(db, new Date(NOW.getTime() + TICK_LEASE_MS))).toBeNull()
  })
})

describe("a skipped tick", () => {
  it("writes a run row of its own and does no work", async () => {
    const { db } = fakeDb()
    store.current = db
    await takeTickLease(db, NOW)
    expect(await runTick(NOW)).toEqual({ skipped: "lease_held" })
    const row = rows.get(`job_runs/${runId("schedule", NOW)}-skipped`)
    expect(row).toMatchObject({ trigger: "schedule", job: "tick", skipped: "lease_held", failed: [], aborted: false })
    expect(rows.size).toBe(1)
  })
  it("logs nothing the heartbeat filter counts", async () => {
    const { db } = fakeDb()
    store.current = db
    await takeTickLease(db, new Date())
    vi.stubEnv("CRON_SECRET", "test-secret")
    vi.stubEnv("JOBS_ENABLED", "true")
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined)
    const response = await POST(new Request("http://x/api/jobs/tick", { method: "POST", headers: { authorization: "Bearer test-secret", "x-cron-secret": "test-secret" } }))
    expect(response.status).toBe(202)
    await vi.waitFor(() => expect(log).toHaveBeenCalled())
    const filter = /JobsHeartbeatFilter:[\s\S]*?FilterPattern: '"(.+?)"'/.exec(readFileSync("infrastructure/aws/flacron-sport.yml", "utf8"))?.[1]
    expect(filter).toBe("Jobs tick")
    expect(log.mock.calls[0][0]).toBe("Tick skipped")
    expect(JSON.stringify(log.mock.calls)).not.toContain(filter)
  })
})

describe("provider budget", () => {
  it("stays under 100 calls a minute with every task at full speed", () => {
    const tasks = Number(/MaxCapacity: (\d+)/.exec(readFileSync("infrastructure/aws/flacron-sport.yml", "utf8"))?.[1])
    const gap = Number(/PAID_PROVIDER_GAP_MS = (\d+)/.exec(readFileSync("lib/sports/service.ts", "utf8"))?.[1])
    expect(tasks).toBe(3)
    expect(gap).toBe(2000)
    expect((tasks * 60_000) / gap).toBeLessThan(100)
  })
})
