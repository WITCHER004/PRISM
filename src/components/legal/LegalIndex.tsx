"use client"

import { useEffect, useState } from "react"
import { motion } from "motion/react"
import { ChevronDown } from "lucide-react"
import { spring } from "@/lib/motion"
import { cn } from "@/lib/utils"

export interface LegalIndexItem {
  id: string
  title: string
}

function useActiveSection(items: LegalIndexItem[]) {
  const [active, setActive] = useState(items[0]?.id)
  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter((el): el is HTMLElement => !!el)
    if (!els.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length) setActive(visible[0].target.id)
      },
      { rootMargin: "-15% 0px -70% 0px" }
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [items])
  return active
}

/** Sticky "On this page" list (wide screens) that highlights the section being read */
export function LegalIndex({ items }: { items: LegalIndexItem[] }) {
  const active = useActiveSection(items)
  return (
    <nav aria-label="On this page">
      <p className="meta mb-3">On this page</p>
      <ol className="relative border-l border-[var(--border)] space-y-0.5">
        {items.map((item, i) => {
          const isActive = item.id === active
          return (
            <li key={item.id} className="relative">
              {isActive && (
                <motion.span
                  layoutId="legal-index-marker"
                  transition={spring.snappy}
                  className="absolute -left-px top-0 bottom-0 w-[2px] rounded-full bg-[var(--accent)]"
                />
              )}
              <a
                href={`#${item.id}`}
                aria-current={isActive ? "location" : undefined}
                className={cn(
                  "flex gap-2 pl-4 py-1.5 text-[0.8125rem] leading-snug transition-colors",
                  isActive ? "text-[var(--fg)] font-medium" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
                )}
              >
                <span className="font-mono text-[var(--fg-subtle)] tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                {item.title}
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/** Collapsible index for narrow screens */
export function LegalIndexMobile({ items }: { items: LegalIndexItem[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="panel">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="legal-index-mobile"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between h-12 px-5 text-sm font-medium rounded-[var(--radius-card)]"
      >
        On this page
        <ChevronDown className={cn("w-4 h-4 text-[var(--fg-muted)] transition-transform duration-300", open && "rotate-180")} />
      </button>
      <div
        id="legal-index-mobile"
        className={cn("grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.2,0.7,0.2,1)]", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
      >
        <div className="overflow-hidden" inert={!open}>
          <ol className="px-5 pb-4 space-y-1">
            {items.map((item, i) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={() => setOpen(false)}
                  className="flex gap-2 py-2 text-sm text-[var(--fg-secondary)] hover:text-[var(--fg)]"
                >
                  <span className="font-mono text-[var(--fg-subtle)] tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  {item.title}
                </a>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}
