import Link from "next/link"
import { cn } from "@/lib/utils"

interface WordmarkProps {
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizeMap = {
  sm: { text: "text-lg", glyph: "w-5 h-5" },
  md: { text: "text-[1.375rem]", glyph: "w-6 h-6" },
  lg: { text: "text-5xl", glyph: "w-12 h-12" },
}

// A prism: white light in, spectrum out
export function PrismGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <defs>
        <linearGradient id="prism-spectrum" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="oklch(0.68 0.19 25)" />
          <stop offset="0.35" stopColor="oklch(0.78 0.16 75)" />
          <stop offset="0.6" stopColor="oklch(0.72 0.15 190)" />
          <stop offset="1" stopColor="oklch(0.58 0.22 290)" />
        </linearGradient>
      </defs>
      <path d="M16 3 L29 27 H3 Z" fill="url(#prism-spectrum)" />
      <path d="M16 3 L29 27 H3 Z" fill="none" stroke="var(--fg)" strokeOpacity="0.12" strokeWidth="1" />
      <path d="M16 3 L12 27" stroke="white" strokeOpacity="0.45" strokeWidth="1.2" />
    </svg>
  )
}

export function Wordmark({ size = "md", className }: WordmarkProps) {
  const s = sizeMap[size]
  return (
    <Link
      href="/"
      aria-label="Prism home"
      className={cn("inline-flex items-center gap-2 shrink-0 text-[var(--fg)]", className)}
    >
      <PrismGlyph className={s.glyph} />
      <span className={cn("display tracking-[-0.045em] leading-none", s.text)}>prism</span>
    </Link>
  )
}
