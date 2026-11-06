import { forwardRef } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-[background-color,color,transform] duration-150 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-40 disabled:pointer-events-none cursor-pointer",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--fg-secondary)]",
        secondary:
          "bg-[var(--panel)] text-[var(--fg)] border border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-secondary)]",
        ghost:
          "text-[var(--fg-muted)] hover:bg-[var(--surface)] hover:text-[var(--fg)]",
        accent:
          "bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)]",
        destructive:
          "bg-[var(--error)] text-white hover:opacity-85",
        outline:
          "border border-[var(--border-strong)] text-[var(--fg)] hover:border-[var(--fg)]",
      },
      size: {
        xs: "h-7 px-2.5 text-xs",
        sm: "h-8 px-3.5 text-sm",
        md: "h-9 px-4.5 text-sm",
        lg: "h-11 px-6 text-base",
        xl: "h-13 px-8 text-lg",
        icon: "h-9 w-9 p-0",
        "icon-sm": "h-7 w-7 p-0",
        "icon-lg": "h-11 w-11 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {children}
    </button>
  )
)
Button.displayName = "Button"

export { buttonVariants }
