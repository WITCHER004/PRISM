"use client"

import { useEffect, useState } from "react"
import { useUIStore } from "@/lib/store"

/**
 * True once the persisted store has been loaded from localStorage.
 * The store rehydrates after mount (ThemeProvider), so the first render always shows defaults —
 * pages that read drafts wait for this before deciding something is "not found".
 */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    if (useUIStore.persist.hasHydrated()) setHydrated(true)
    return useUIStore.persist.onFinishHydration(() => setHydrated(true))
  }, [])
  return hydrated
}
