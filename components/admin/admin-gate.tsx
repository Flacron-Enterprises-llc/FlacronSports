"use client"

import { useEffect, useState } from "react"
import { authFetch } from "@/lib/auth-fetch"
import { useAuthUser } from "@/lib/hooks/useAuthUser"

// Operations tools and business metrics arrive here once they have a real source.
export function AdminGate() {
  const user = useAuthUser()
  const [access, setAccess] = useState<"checking" | "allowed" | "denied">("checking")

  useEffect(() => {
    if (!user) return
    authFetch("/api/admin/status")
      .then((response) => setAccess(response.ok ? "allowed" : "denied"))
      .catch(() => setAccess("denied"))
  }, [user])

  const message = {
    checking: "Checking access...",
    denied: "Administrator access with multi-factor sign-in is required.",
    allowed: "No operations tools are connected yet.",
  }[access]

  return <p role="status" className="text-ink-2">{message}</p>
}
