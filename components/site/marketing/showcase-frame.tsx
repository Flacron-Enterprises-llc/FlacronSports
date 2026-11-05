"use client"

import { useEffect, useRef } from "react"

/** Reveals a scene when it scrolls into view, adds a pointer tilt and runs the simulated cursor. CSS-driven and off under reduced motion. */
export function ShowcaseFrame({
  children,
  label,
  sample,
  caption,
  cursor,
  tilt = true,
  onBand = false,
  forceDark = false,
}: {
  children: React.ReactNode
  /** Visible "Illustrative preview" label. */
  label: string
  sample: string
  /** Describes the UI, which is hidden from assistive tech. */
  caption: string
  cursor?: [number, number][]
  tilt?: boolean
  onBand?: boolean
  /** Dark tokens regardless of the site theme, for frames on the navy band. */
  forceDark?: boolean
}) {
  const ref = useRef<HTMLElement>(null)
  const inner = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (typeof IntersectionObserver === "undefined") {
      element.classList.add("is-in")
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          element.classList.add("is-in")
          io.disconnect()
        }
      },
      { threshold: 0.18 },
    )
    io.observe(element)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const element = ref.current
    const target = inner.current
    if (!tilt || !element || !target) return
    if (typeof window.matchMedia !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !window.matchMedia("(pointer: fine)").matches) return
    let raf = 0
    const onMove = (event: PointerEvent) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const rect = element.getBoundingClientRect()
        const x = (event.clientX - rect.left) / rect.width - 0.5
        const y = (event.clientY - rect.top) / rect.height - 0.5
        target.style.setProperty("--ry", `${(x * 5).toFixed(2)}deg`)
        target.style.setProperty("--rx", `${(-y * 4).toFixed(2)}deg`)
      })
    }
    const onLeave = () => {
      target.style.setProperty("--ry", "0deg")
      target.style.setProperty("--rx", "0deg")
    }
    element.addEventListener("pointermove", onMove)
    element.addEventListener("pointerleave", onLeave)
    return () => {
      cancelAnimationFrame(raf)
      element.removeEventListener("pointermove", onMove)
      element.removeEventListener("pointerleave", onLeave)
    }
  }, [tilt])

  const [a, b, c] = cursor ?? []
  const cursorStyle = a && b && c ? ({ "--x1": `${a[0]}%`, "--y1": `${a[1]}%`, "--x2": `${b[0]}%`, "--y2": `${b[1]}%`, "--x3": `${c[0]}%`, "--y3": `${c[1]}%` } as React.CSSProperties) : undefined

  return (
    <figure ref={ref} className="fs-show relative min-w-0">
      <div ref={inner} className="fs-show-tilt">
        <div aria-hidden data-theme={forceDark ? "dark" : undefined} className="relative overflow-hidden rounded-2xl border border-[var(--show-frame-border)] bg-surface text-ink shadow-[var(--show-shadow)]">
          <div className="flex items-center gap-3 border-b border-[var(--show-chrome-border)] bg-[var(--show-chrome-bg)] px-3.5 py-2.5">
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-[var(--show-dot-1)]" />
              <span className="size-2.5 rounded-full bg-[var(--show-dot-2)]" />
              <span className="size-2.5 rounded-full bg-[var(--show-dot-3)]" />
            </div>
            <div className="mx-auto flex min-w-0 max-w-[60%] items-center gap-1.5 truncate rounded-md border border-[var(--show-chrome-border)] bg-[var(--show-url-bg)] px-3 py-1 text-[11px] text-[var(--show-url-text)]">
              <span className="truncate">flacronsport.com</span>
            </div>
            <span className="fs-tint-hot hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold text-hot-text sm:inline">{sample}</span>
          </div>
          <div className="relative">
            {children}
            {cursorStyle && (
              <span className="fs-cursor" style={cursorStyle}>
                <svg viewBox="0 0 24 24" className="size-[18px] drop-shadow-[0_2px_3px_var(--show-cursor-shadow)]">
                  <path d="M4 2.5 19.5 11 12 12.6 9.3 20 4 2.5Z" fill="var(--show-cursor-fill)" stroke="var(--show-cursor-stroke)" strokeWidth="1.4" strokeLinejoin="round" />
                </svg>
              </span>
            )}
          </div>
        </div>
      </div>
      <figcaption className={`mt-3 text-center text-xs leading-5 ${onBand ? "text-white/70" : "text-ink-3"}`}>
        <span className="font-semibold">{label}</span> {caption}
      </figcaption>
    </figure>
  )
}
