import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  body: string
  cta?: { label: string; href: string }
  secondary?: { label: string; href: string }
  className?: string
  children?: React.ReactNode
}

// Designed empty state: spectrum-ringed icon, short copy, a clear next step
export function EmptyState({ icon: Icon, title, body, cta, secondary, className, children }: EmptyStateProps) {
  return (
    <div className={cn("panel relative overflow-hidden px-6 py-14 sm:py-16 text-center shadow-[var(--shadow)]", className)}>
      <div aria-hidden className="absolute inset-x-0 top-0 h-1 spectrum-bg opacity-80" />
      <div className="mx-auto grid place-items-center w-14 h-14 rounded-full bg-[var(--surface)] text-[var(--fg-secondary)]">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="display mt-5 text-[1.5rem] sm:text-[1.75rem]">{title}</h3>
      <p className="mt-2 mx-auto max-w-sm text-sm leading-relaxed text-[var(--fg-muted)]">{body}</p>
      {children}
      {(cta || secondary) && (
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {cta && (
            <Link
              href={cta.href}
              className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-[var(--fg)] text-[var(--bg)] text-sm font-medium hover:bg-[var(--fg-secondary)] transition-colors"
            >
              {cta.label} <ArrowRight className="w-4 h-4" />
            </Link>
          )}
          {secondary && (
            <Link
              href={secondary.href}
              className="inline-flex items-center h-11 px-5 rounded-full border border-[var(--border-strong)] bg-[var(--panel)] text-sm font-medium hover:border-[var(--fg)] transition-colors"
            >
              {secondary.label}
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
