"use client"

import { useSyncExternalStore } from "react"

const MD_QUERY = "(min-width: 768px)"
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(MD_QUERY)
  m.addEventListener("change", cb)
  return () => m.removeEventListener("change", cb)
}

/** md and up. Players mount one layout at a time (desktop card or mobile bar), so this isn't a CSS breakpoint. */
export const useIsDesktop = () => useSyncExternalStore(subscribe, () => window.matchMedia(MD_QUERY).matches, () => true)
