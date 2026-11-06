import { MEMBER_COOKIE } from "@/lib/member-cookie"

/** The backend refused this render: no token, an expired one, or no plan. */
export class MemberAccessRequired extends Error {
  constructor() {
    super("Member access required")
  }
}

async function memberToken(): Promise<string | null> {
  try {
    // Dynamic so ECS routes, jobs and tests never load the request store.
    const { cookies } = await import("next/headers")
    const token = (await cookies()).get(MEMBER_COOKIE)?.value
    return token && /^[\w-]+\.[\w-]+\.[\w-]+$/.test(token) ? token : null
  } catch {
    return null
  }
}

/**
 * Server render to backend, as the member viewing the page. Never in the shared data
 * cache, which would hand one member's reply to a request with no plan. The backend
 * caches built feeds itself.
 */
export async function memberFetch(url: string, init: Pick<RequestInit, "signal"> = {}): Promise<Response> {
  const token = await memberToken()
  const response = await fetch(url, { ...init, cache: "no-store", ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}) })
  if (response.status === 401 || response.status === 402) throw new MemberAccessRequired()
  return response
}
