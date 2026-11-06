"use client"

import { motion, useScroll, useSpring } from "motion/react"

// Thin progress line in the article's topic hue, sprung so it glides rather than ticks
export function ReadingProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 28, restDelta: 0.001 })

  return (
    <motion.div
      aria-hidden="true"
      className="hue-dot fixed inset-x-0 top-0 h-[3px] z-[60] origin-left"
      style={{ scaleX }}
    />
  )
}
