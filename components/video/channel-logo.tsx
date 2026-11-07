"use client"

import { useState } from "react"
import { Tv } from "lucide-react"
import { cn } from "@/lib/utils"

/** A logo that fails to load falls back to the same mark as a channel with no logo. */
export function ChannelLogo({ url, className }: { url: string | null; className?: string }) {
  const [broken, setBroken] = useState(false)
  return (
    <span className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded bg-white", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && !broken ? <img src={url} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} className="size-full object-contain p-0.5" /> : <Tv aria-hidden className="size-3 text-[#5c6b82]" />}
    </span>
  )
}
