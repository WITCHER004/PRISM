"use client"

import { useEffect, useState } from "react"
import { MotionConfig } from "motion/react"
import { useUIStore } from "@/lib/store"
import { Toaster } from "@/components/ui/Toaster"

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme, fontSize, focusMode } = useUIStore()

  const [hydrated, setHydrated] = useState(false)

  // Load saved state after the first render so it matches the server HTML (no hydration mismatch)
  useEffect(() => {
    useUIStore.persist.rehydrate()
    setHydrated(true)
  }, [])

  // Until saved state is loaded, leave the theme the <head> script already applied
  useEffect(() => {
    if (!hydrated) return
    const root = document.documentElement
    root.setAttribute("data-theme", theme)
    root.setAttribute("data-fontsize", fontSize)
  }, [theme, fontSize, hydrated])

  // Focus mode: globals.css fades the header, sidebars and article dock while this class is set
  useEffect(() => {
    if (!hydrated) return
    document.body.classList.toggle("focus-mode", focusMode)
  }, [focusMode, hydrated])

  // reducedMotion="user" turns transform/layout animations off when the OS asks for less motion
  return (
    <MotionConfig reducedMotion="user">
      {children}
      <Toaster />
    </MotionConfig>
  )
}
