"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/** One observer for the document: `data-reveal` elements fade in as they enter the viewport. */
export function RevealObserver() {
  const path = usePathname()
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible")
            io.unobserve(entry.target)
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    )
    const scan = () => document.querySelectorAll("[data-reveal]:not(.is-visible)").forEach((element) => io.observe(element))
    scan()
    const mutations = new MutationObserver(scan)
    mutations.observe(document.body, { childList: true, subtree: true })
    return () => {
      io.disconnect()
      mutations.disconnect()
    }
  }, [path])
  return null
}

/** Counts up once when visible. Renders the final value for SSR, no JS and reduced motion. */
export function CountUp({ value, duration = 900 }: { value: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(value)

  useEffect(() => {
    const element = ref.current
    if (!element || prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      setShown(value)
      return
    }
    let raf = 0
    const run = () => {
      const start = performance.now()
      const tick = (time: number) => {
        const progress = Math.min(1, (time - start) / duration)
        setShown(value * (1 - Math.pow(1 - progress, 3)))
        if (progress < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        io.disconnect()
        run()
      }
    })
    io.observe(element)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [value, duration])

  return <span ref={ref} className="tabular">{Math.round(shown)}</span>
}

/** 0..1 document scroll progress, throttled to animation frames. Stays 0 under reduced motion. */
export function useScrollProgress(): number {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    if (prefersReducedMotion()) return
    let raf = 0
    const update = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const root = document.documentElement
        const max = root.scrollHeight - root.clientHeight
        setProgress(max > 0 ? Math.min(1, Math.max(0, root.scrollTop / max)) : 0)
      })
    }
    update()
    window.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
    }
  }, [])
  return progress
}
