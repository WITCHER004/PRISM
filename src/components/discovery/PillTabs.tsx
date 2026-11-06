"use client"

import { useId } from "react"
import { LayoutGroup, motion } from "motion/react"
import { spring } from "@/lib/motion"
import { cn } from "@/lib/utils"

export interface PillTab<T extends string> {
  id: T
  label: string
  count?: number
  icon?: React.ComponentType<{ className?: string }>
}

interface PillTabsProps<T extends string> {
  tabs: PillTab<T>[]
  value: T
  onChange: (id: T) => void
  label: string
  className?: string
  /** id prefix for aria-controls → `${panelId}-${tab}` */
  panelId?: string
}

// Segmented pill tabs; the active pill slides between options (shared layoutId, scoped per instance)
export function PillTabs<T extends string>({ tabs, value, onChange, label, className, panelId }: PillTabsProps<T>) {
  const groupId = useId()

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return
    e.preventDefault()
    const i = tabs.findIndex((t) => t.id === value)
    const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length]
    onChange(next.id)
    const el = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(`[data-tab="${next.id}"]`)
    el?.focus()
  }

  return (
    <LayoutGroup id={groupId}>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className={cn(
          "inline-flex max-w-full items-center gap-1 p-1 rounded-full bg-[var(--panel)] border border-[var(--border)] overflow-x-auto scrollbar-none",
          className
        )}
      >
        {tabs.map((tab) => {
          const active = tab.id === value
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              data-tab={tab.id}
              aria-selected={active}
              aria-controls={panelId ? `${panelId}-${tab.id}` : undefined}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(tab.id)}
              className={cn(
                "relative shrink-0 inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-sm font-medium transition-colors",
                active ? "text-[var(--bg)]" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
              )}
            >
              {active && (
                <motion.span
                  layoutId="pill"
                  transition={spring.snappy}
                  className="absolute inset-0 rounded-full bg-[var(--fg)]"
                  aria-hidden
                />
              )}
              <span className="relative inline-flex items-center gap-1.5">
                {Icon && <Icon className="w-4 h-4" />}
                {tab.label}
                {tab.count !== undefined && (
                  <span
                    className={cn(
                      "font-mono text-[0.6875rem] tabular-nums transition-opacity",
                      active ? "opacity-70" : "text-[var(--fg-subtle)]"
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </LayoutGroup>
  )
}
