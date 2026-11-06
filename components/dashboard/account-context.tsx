"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { User } from "firebase/auth"
import { authFetch } from "@/lib/auth-fetch"
import type { AccessAddon } from "@/lib/billing/addons"
import type { AllowanceBalance } from "@/lib/billing/allowance"
import type { EffectiveAccess } from "@/lib/billing/entitlements"
import type { PlanId } from "@/lib/billing/plans"

interface AccountValue {
  user: User | null
  plan: PlanId
  access: EffectiveAccess | null
  balance: AllowanceBalance | null
  dayPassEnd: string | null
  /** Live purchases that keep their own screens open without a plan. */
  addons: AccessAddon[]
  role: string | null
  community: boolean
  /** False until both reads have settled, whether or not they succeeded. */
  loaded: boolean
  reload(): Promise<void>
  setBalance(balance: AllowanceBalance): void
}

const AccountContext = createContext<AccountValue>({ user: null, plan: "none", access: null, balance: null, dayPassEnd: null, addons: [], role: null, community: false, loaded: false, reload: async () => undefined, setBalance: () => undefined })

export function AccountProvider({ user, community, children }: { user: User; community: boolean; children: React.ReactNode }) {
  const [access, setAccess] = useState<(EffectiveAccess & { effectivePlan?: PlanId }) | null>(null)
  const [balance, setBalance] = useState<AllowanceBalance | null>(null)
  const [dayPassEnd, setDayPassEnd] = useState<string | null>(null)
  const [addons, setAddons] = useState<AccessAddon[]>([])
  const [role, setRole] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(async () => {
    const read = (path: string) => authFetch(path).then((response) => (response.ok ? response.json() : null)).catch(() => null)
    const [status, assistant] = await Promise.all([read("/api/billing/status"), read("/api/assistant")])
    if (status?.plan) {
      setAccess(status)
      setAddons(status.addons ?? [])
    }
    if (assistant?.balance) {
      setBalance(assistant.balance)
      setDayPassEnd(assistant.dayPassExpiresAtUTC ?? null)
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    void reload()
    user.getIdTokenResult().then((result) => setRole(typeof result.claims.role === "string" ? result.claims.role : null)).catch(() => undefined)
  }, [user, reload])

  const value = useMemo(
    () => ({ user, plan: access?.effectivePlan ?? access?.plan ?? ("none" as PlanId), access, balance, dayPassEnd, addons, role, community, loaded, reload, setBalance }),
    [user, access, balance, dayPassEnd, addons, role, community, loaded, reload],
  )
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

export function useAccount(): AccountValue {
  return useContext(AccountContext)
}
