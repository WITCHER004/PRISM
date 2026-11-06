import Link from "next/link"
import { cn } from "@/lib/utils"

interface WordmarkProps {
  size?: "sm" | "md" | "lg"
  className?: string
  showTagline?: boolean
}

const sizeMap = {
  sm: { text: "text-lg", mark: "w-4 h-4 text-[10px]" },
  md: { text: "text-xl sm:text-2xl", mark: "w-5 h-5 text-xs" },
  lg: { text: "text-4xl sm:text-5xl", mark: "w-8 h-8 text-base" },
}

export function Wordmark({ size = "md", className, showTagline = false }: WordmarkProps) {
  const s = sizeMap[size]
  return (
    <Link
      href="/"
      aria-label="The Prism home"
      className={cn("inline-flex flex-col items-start shrink-0 text-[var(--fg)] group", className)}
    >
      <div className="flex items-center gap-2">
        <span className="font-serif font-black uppercase tracking-tight leading-none group-hover:text-[var(--accent)] transition-colors">
          The Prism
        </span>
      </div>
      {showTagline && (
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--fg-muted)] mt-0.5">
          Editorial Journal
        </span>
      )}
    </Link>
  )
}
