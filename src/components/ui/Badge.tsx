import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full font-medium px-2.5 py-0.5 text-xs transition-colors",
  {
    variants: {
      variant: {
        default: "bg-[var(--panel)] text-[var(--fg-secondary)] border border-[var(--border)]",
        accent:  "bg-[var(--accent-subtle)] text-[var(--accent)]",
        verified:"bg-[var(--accent-subtle)] text-[var(--accent)]",
        warning: "bg-[var(--warning-subtle)] text-[var(--warning)]",
        metered: "bg-[var(--warning-subtle)] text-[var(--warning)]",
        paid:    "bg-[var(--fg)] text-[var(--bg)]",
        free:    "bg-[var(--accent-subtle)] text-[var(--accent)]",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {children}
    </span>
  )
}
