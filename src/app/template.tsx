"use client"

import { useEffect } from "react"
import { motion } from "motion/react"
import { dur, ease } from "@/lib/motion"

// Set after the first client mount. The server never runs effects, so it always renders the
// page fully visible — the first load is never blank while JS downloads.
let hasNavigated = false

// Re-mounts on every navigation: pages reached by clicking arrive with a short fade and rise
export default function Template({ children }: { children: React.ReactNode }) {
  const animateIn = hasNavigated
  useEffect(() => {
    hasNavigated = true
  }, [])

  return (
    <motion.div
      className="flex flex-col flex-1"
      initial={animateIn ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: dur.base, ease: ease.out }}
    >
      {children}
    </motion.div>
  )
}
