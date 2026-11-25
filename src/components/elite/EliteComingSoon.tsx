import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Shown wherever someone could upgrade while Elite is closed (ELITE_OPEN is false): Elite is built,
 * but everyone is on the free plan until it opens.
 */
export function EliteComingSoon({ className, label = "Elite · Coming soon" }: { className?: string; label?: string }) {
  return (
    <button
      type="button"
      disabled
      aria-disabled
      title="Prism Elite isn't open yet. Everyone is on the free plan for now."
      className={cn(
        "inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full text-sm font-medium border border-dashed border-[var(--border-strong)] text-[var(--fg-muted)] bg-[var(--panel)] cursor-not-allowed",
        className
      )}
    >
      <Clock className="w-4 h-4" /> {label}
    </button>
  )
}

/** One line of context to pair with the button */
export const ELITE_COMING_SOON_NOTE = "Prism Elite opens soon. Until then everyone uses Prism free, with every free feature included."
