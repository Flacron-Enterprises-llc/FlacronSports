const CONSENT_KEY = "fs-consent"

/**
 * Functional choices persist only with consent, as the Cookies Policy says.
 * Otherwise they last for this browser session, so the control still works.
 */
export function functionalStore(): Storage | null {
  try {
    const consent = JSON.parse(localStorage.getItem(CONSENT_KEY) ?? "null")
    return consent?.categories?.includes("functional") ? localStorage : sessionStorage
  } catch {
    return null
  }
}

export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key) ?? localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function writeStored(key: string, value: unknown): void {
  try {
    functionalStore()?.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable */
  }
}

export const SPOILER_DECIDED_KEY = "fs-spoiler-decided"
