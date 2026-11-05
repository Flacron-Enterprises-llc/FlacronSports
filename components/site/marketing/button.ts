export type ButtonVariant = "primary" | "navy" | "outline" | "inverse-outline"
export type ButtonSize = "md" | "lg"

const base =
  "relative inline-flex max-w-full select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-[var(--ease)] active:translate-y-px"

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-hot text-hot-on shadow-[0_1px_0_rgb(255_255_255/0.25)_inset,0_1px_2px_rgb(10_26_51/0.18),0_6px_16px_-6px_rgb(254_75_1/0.55)] hover:bg-[#ff5c1a] dark:hover:bg-[#ff7a40]",
  navy: "bg-navy text-white shadow-[var(--shadow-sm)] hover:bg-[#003a85] dark:bg-brand dark:text-brand-on dark:hover:bg-[#a6c3f1]",
  outline: "border border-line-strong bg-surface text-ink shadow-[var(--shadow-sm)] hover:border-ink-3 hover:bg-surface-muted",
  "inverse-outline": "border border-white/25 text-white hover:border-white/45 hover:bg-white/10",
}

const sizes: Record<ButtonSize, string> = {
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
}

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`.trim()
}
