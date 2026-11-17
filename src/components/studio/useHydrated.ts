"use client"

import { useEffect, useState } from "react"
import { useUIStore } from "@/lib/store"

/**
 * True once the persisted store has been loaded from localStorage AND Firebase has reported the
 * login state. The store rehydrates after mount (ThemeProvider) and Firebase restores the session a
 * moment later, so until both are done a signed-in user looks signed out. Pages that show a
 * sign-in gate or a "not found" state wait for this.
 */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false)
  const authLoading = useUIStore((s) => s.authLoading)
  useEffect(() => {
    if (useUIStore.persist.hasHydrated()) setHydrated(true)
    return useUIStore.persist.onFinishHydration(() => setHydrated(true))
  }, [])
  return hydrated && !authLoading
}
