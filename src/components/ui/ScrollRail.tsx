"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * A horizontal row with a hidden scrollbar that a mouse can still scroll:
 * the vertical wheel scrolls it sideways (until an end, then the page scrolls on),
 * arrow buttons appear for fine pointers, and the edges fade where content continues.
 */
export function ScrollRail({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ start: false, end: false })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () =>
      setEdges({ start: el.scrollLeft > 1, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 })
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || e.shiftKey) return // trackpad sideways / shift-wheel: native
      const max = el.scrollWidth - el.clientWidth
      if ((e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft >= max - 1)) return // at an end: let the page scroll
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    update()
    el.addEventListener("scroll", update, { passive: true })
    el.addEventListener("wheel", onWheel, { passive: false })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener("scroll", update)
      el.removeEventListener("wheel", onWheel)
      ro.disconnect()
    }
  }, [])

  const page = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" })

  const fade = `linear-gradient(to right, ${edges.start ? "transparent, #000 48px" : "#000"}, ${edges.end ? "#000 calc(100% - 48px), transparent" : "#000"})`
  const arrow =
    "absolute top-1/2 -translate-y-1/2 z-10 hidden pointer-fine:flex items-center justify-center w-9 h-9 rounded-full bg-[var(--panel)] border border-[var(--border)] text-[var(--fg-secondary)] shadow-sm hover:text-[var(--fg)] transition-opacity"

  return (
    <div className="relative">
      <div ref={ref} className={cn("overflow-x-auto scrollbar-none", className)} style={{ maskImage: fade, WebkitMaskImage: fade }}>
        {children}
      </div>
      <button
        type="button"
        aria-label={`Scroll ${label ?? "row"} left`}
        onClick={() => page(-1)}
        className={cn(arrow, "left-0", !edges.start && "opacity-0 pointer-events-none")}
        tabIndex={edges.start ? 0 : -1}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button
        type="button"
        aria-label={`Scroll ${label ?? "row"} right`}
        onClick={() => page(1)}
        className={cn(arrow, "right-0", !edges.end && "opacity-0 pointer-events-none")}
        tabIndex={edges.end ? 0 : -1}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}
