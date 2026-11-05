import type { SportId } from "@/lib/sports/types"

const GLYPHS: Record<SportId, React.ReactNode> = {
  football: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m12 7.5 4.3 3.1-1.6 5H9.300l-1.600-5L12 7.500ZM12 3v4.500M3.600 9.300l4.100 1.300M20.400 9.300l-4.100 1.300M6.800 19.300l2.500-3.700M17.200 19.300l-2.500-3.700" />
    </>
  ),
  basketball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18M3 12h18M5.600 5.600c3.200 3.200 3.200 9.600 0 12.800M18.400 5.600c-3.200 3.200-3.200 9.600 0 12.800" />
    </>
  ),
  "american-football": (
    <>
      <ellipse cx="12" cy="12" rx="10.500" ry="6" transform="rotate(-45 12 12)" />
      <path d="m9 15 6-6M10.300 10.700l3 3M12.100 8.900l3 3M8.500 12.500l3 3" />
    </>
  ),
  baseball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M6.600 4.800c2.600 4.400 2.600 10 0 14.400M17.400 4.800c-2.600 4.400-2.600 10 0 14.400" />
    </>
  ),
  "ice-hockey": (
    <>
      <path d="M17 3 10.500 17.500A2.500 2.500 0 0 1 8.200 19H3" />
      <ellipse cx="17.500" cy="18.500" rx="3.500" ry="1.800" />
    </>
  ),
  tennis: (
    <>
      <ellipse cx="14.500" cy="9.500" rx="6" ry="6.800" transform="rotate(45 14.500 9.500)" />
      <path d="m9.800 14.200-6.300 6.300M11.200 5.500l7.300 7.300M15 4l5 5M9 9l6 6" />
    </>
  ),
  cricket: (
    <>
      <path d="m15.500 3.500 5 5-9.500 9.500-5-5 9.500-9.500ZM6 18l-2.500 2.500" />
      <circle cx="19" cy="19" r="2.200" />
    </>
  ),
  rugby: (
    <>
      <ellipse cx="12" cy="12" rx="10" ry="6.400" />
      <path d="M12 5.600c-3 3.600-3 9.200 0 12.800M12 5.600c3 3.600 3 9.200 0 12.800" />
    </>
  ),
  volleyball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 12c0-3.600 1.500-6.800 4.200-8.800M12 12c3.100 1.800 5.100 4.700 5.600 8M12 12c-3.100 1.800-6.600 2-9.600.7M12 12C8.900 10.200 7 7.200 6.600 4.800" />
    </>
  ),
  "combat-sports": <path d="M7 10V8a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v5a4 4 0 0 1-4 4H9.500A3.500 3.500 0 0 1 6 13.500V12a2 2 0 0 1 2-2h4a2 2 0 0 1 0 4H9.500M8 17v4h8.500v-4" />,
  motorsport: (
    <>
      <path d="M5 21V4h14v10H5" />
      <path d="M5 9h14M9.700 4v10M14.300 4v10" />
    </>
  ),
}

export function SportIcon({ id, className = "size-6" }: { id: SportId; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {GLYPHS[id]}
    </svg>
  )
}
