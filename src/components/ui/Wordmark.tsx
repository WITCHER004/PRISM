import Link from "next/link"
import { cn } from "@/lib/utils"

interface WordmarkProps {
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizeMap = {
  sm: { text: "text-lg", glyph: "w-[18px] h-[18px]" },
  md: { text: "text-xl", glyph: "w-5 h-5" },
  lg: { text: "text-5xl", glyph: "w-12 h-12" },
}

// An architectural prism: two facets in ink. The refracting facet catches the spectrum on hover
// (the parent link carries `group`).
export function PrismGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <defs>
        <linearGradient id="prism-refract" x1="0.2" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="oklch(0.72 0.16 60)" />
          <stop offset="0.5" stopColor="oklch(0.66 0.15 200)" />
          <stop offset="1" stopColor="oklch(0.55 0.2 290)" />
        </linearGradient>
      </defs>
      {/* Lit facet */}
      <path d="M16 3.5 L3.5 27.5 H19.5 Z" fill="currentColor" />
      {/* Refracting facet: ink at rest, spectrum on hover */}
      <path d="M16 3.5 L28.5 27.5 H19.5 Z" fill="currentColor" fillOpacity="0.38" />
      <path
        d="M16 3.5 L28.5 27.5 H19.5 Z"
        fill="url(#prism-refract)"
        className="opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100 motion-reduce:transition-none"
      />
    </svg>
  )
}

export function Wordmark({ size = "md", className }: WordmarkProps) {
  const s = sizeMap[size]
  return (
    <Link
      href="/"
      aria-label="Prism home"
      className={cn("group inline-flex items-center gap-2 shrink-0 text-[var(--fg)]", className)}
    >
      <PrismGlyph className={s.glyph} />
      <span className={cn("font-display font-semibold tracking-[-0.035em] leading-none", s.text)}>prism</span>
    </Link>
  )
}
