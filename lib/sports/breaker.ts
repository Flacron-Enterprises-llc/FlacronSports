// A provider that keeps failing is left alone for a while, so visitors get the stored
// answer at once instead of waiting on a timeout. State is per task, which is enough:
// each task only needs to protect its own requests.

export type BreakerState = "closed" | "open" | "half-open"

export interface BreakerStatus {
  provider: string
  state: BreakerState
  failures: number
  /** How many times in a row the circuit has opened. A clean call resets it. */
  trips: number
  openedAt: string | null
  retryAt: string | null
  lastError: string | null
}

const FAILURE_LIMIT = 5
const BASE_OPEN_MS = 60_000
const MAX_OPEN_MS = 10 * 60_000

export class CircuitOpenError extends Error {
  constructor(provider: string) {
    super(`${provider} circuit is open`)
  }
}

export class Breaker {
  private failures = 0
  private trips = 0
  private openedAt: number | null = null
  private retryAt: number | null = null
  private lastError: string | null = null
  private probing = false

  constructor(readonly provider: string) {}

  /** Throws while open. After the wait, exactly one call goes through as a trial. */
  assertReady(now = Date.now()): void {
    if (this.retryAt === null) return
    if (now < this.retryAt || this.probing) throw new CircuitOpenError(this.provider)
    this.probing = true
  }

  succeed(): void {
    this.failures = 0
    this.trips = 0
    this.openedAt = null
    this.retryAt = null
    this.lastError = null
    this.probing = false
  }

  fail(reason: string, now = Date.now()): void {
    this.failures += 1
    this.lastError = reason
    const failedTrial = this.probing
    this.probing = false
    if (!failedTrial && this.failures < FAILURE_LIMIT) return
    const wait = Math.min(BASE_OPEN_MS * 2 ** this.trips, MAX_OPEN_MS)
    this.trips += 1
    this.openedAt = now
    this.retryAt = now + wait
  }

  status(now = Date.now()): BreakerStatus {
    const state = this.retryAt === null ? "closed" : now < this.retryAt ? "open" : "half-open"
    return {
      provider: this.provider,
      state,
      failures: this.failures,
      trips: this.trips,
      openedAt: this.openedAt === null ? null : new Date(this.openedAt).toISOString(),
      retryAt: this.retryAt === null ? null : new Date(this.retryAt).toISOString(),
      lastError: this.lastError,
    }
  }
}
