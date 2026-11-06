"use client"

import { useEffect, useState } from "react"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"

export interface TocItem {
  id: string
  text: string
}

// Sticky contents list; highlights the section currently being read
export function TableOfContents({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState(items[0]?.id)

  useEffect(() => {
    const headings = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => !!el)
    if (!headings.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length) setActive(visible[0].target.id)
      },
      { rootMargin: "-15% 0px -70% 0px" }
    )
    headings.forEach((h) => observer.observe(h))
    return () => observer.disconnect()
  }, [items])

  if (!items.length) return null

  return (
    <nav aria-label="Contents">
      <p className="meta mb-3">Contents</p>
      <ul className="relative space-y-0.5 border-l border-[var(--border)]">
        {items.map((item) => {
          const isActive = item.id === active
          return (
            <li key={item.id} className="relative">
              {isActive && (
                <motion.span
                  layoutId="toc-marker"
                  className="absolute -left-px top-0 bottom-0 w-[2px] hue-dot rounded-full"
                  transition={{ type: "spring", stiffness: 400, damping: 34 }}
                />
              )}
              <a
                href={`#${item.id}`}
                aria-current={isActive ? "location" : undefined}
                className={cn(
                  "block pl-4 py-1.5 text-[0.8125rem] leading-snug transition-colors",
                  isActive ? "text-[var(--fg)] font-medium" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
                )}
              >
                {item.text}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
