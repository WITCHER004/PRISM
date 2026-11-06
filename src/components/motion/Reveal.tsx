"use client"

import { useEffect, useRef } from "react"
import { animate, useInView, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"
import { dur, ease, stagger } from "@/lib/motion"

interface RevealProps {
  children: React.ReactNode
  /** Position in a group; staggers the entrance */
  index?: number
  className?: string
  as?: "div" | "section" | "li" | "article"
}

// Fades and lifts content in the first time it scrolls into view.
// Rendered visible by default: only content that starts below the fold is hidden (after mount,
// while offscreen) and revealed on arrival — so nothing waits on JavaScript to be seen.
export function Reveal({ children, index = 0, className, as = "div" }: RevealProps) {
  const ref = useRef<HTMLElement>(null)
  const armed = useRef(false)
  const reduce = useReducedMotion()
  const inView = useInView(ref, { once: true, margin: "0px 0px -60px 0px" })

  useEffect(() => {
    const el = ref.current
    if (!el || reduce) return
    if (el.getBoundingClientRect().top > window.innerHeight) {
      el.style.opacity = "0"
      el.style.transform = "translateY(18px)"
      armed.current = true
    }
  }, [reduce])

  useEffect(() => {
    const el = ref.current
    if (!inView || !el || !armed.current) return
    armed.current = false
    animate(
      el,
      { opacity: 1, transform: "translateY(0px)" },
      { duration: dur.slow, ease: ease.out, delay: Math.min(index, 8) * stagger }
    )
  }, [inView, index])

  const Tag = as
  return (
    <Tag ref={ref as React.Ref<never>} className={cn(className)}>
      {children}
    </Tag>
  )
}
