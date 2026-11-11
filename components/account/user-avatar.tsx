"use client"

import { useSyncExternalStore } from "react"
import type { User } from "firebase/auth"
import { cn } from "@/lib/utils"

// Firebase updates the User object in place after reload(), which React cannot see.
// Profile edits bump this version so every avatar and name re-renders.
let version = 0
const listeners = new Set<() => void>()

export function publishProfileChange(): void {
  version += 1
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The user's current name and photo, re-read after a profile change. */
export function useProfile(user: User | null | undefined): { name: string | null; email: string | null; photoURL: string | null } {
  useSyncExternalStore(subscribe, () => version, () => 0)
  return { name: user?.displayName ?? null, email: user?.email ?? null, photoURL: user?.photoURL ?? null }
}

export function initials(name: string | null | undefined, email: string | null | undefined): string {
  const parts = (name || email || "?").trim().split(/[\s@._-]+/).filter(Boolean)
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?"
}

/** Profile photo, or initials on the brand gradient when there is none. */
export function UserAvatar({ user, className, ring }: { user: User | null | undefined; className?: string; ring?: boolean }) {
  const { name, email, photoURL } = useProfile(user)
  const base = cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full", ring && "ring-2 ring-surface", className ?? "size-9")
  if (photoURL) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoURL} alt="" aria-hidden referrerPolicy="no-referrer" className={cn(base, "object-cover")} />
  }
  return (
    <span aria-hidden className={cn(base, "bg-gradient-to-br from-[#002961] to-[#1e5bb8] font-display text-[13px] font-semibold text-white")}>
      {initials(name, email)}
    </span>
  )
}
