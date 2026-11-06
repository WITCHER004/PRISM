"use client"

import { useCallback, useSyncExternalStore } from "react"
import { useUIStore } from "@/lib/store"

// ── Store hydration ──────────────────────────────────────────────────────────
// The persisted store loads after mount, so the first client render shows defaults.
// Server + hydration render report `false`; client-side navigations (store already loaded) report `true` at once.
const subscribeHydration = (cb: () => void) => useUIStore.persist.onFinishHydration(cb)
export function useStoreHydrated() {
  return useSyncExternalStore(
    subscribeHydration,
    () => useUIStore.persist.hasHydrated(),
    () => false
  )
}

// ── Small localStorage-backed lists (topics followed, recent searches) ──────
// One in-memory cache per key + listeners, so every component using the same key stays in sync
const cache = new Map<string, string[]>()
const listeners = new Map<string, Set<() => void>>()
const EMPTY: string[] = []

function read(key: string): string[] {
  if (cache.has(key)) return cache.get(key)!
  let value: string[] = EMPTY
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : null
    if (Array.isArray(parsed)) value = parsed.filter((x): x is string => typeof x === "string")
  } catch {
    /* storage unavailable or corrupt — start empty */
  }
  cache.set(key, value)
  return value
}

function write(key: string, value: string[]) {
  cache.set(key, value)
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore quota / privacy mode */
  }
  listeners.get(key)?.forEach((l) => l())
}

function subscribe(key: string, cb: () => void) {
  if (!listeners.has(key)) listeners.set(key, new Set())
  listeners.get(key)!.add(cb)
  // other tabs
  const onStorage = (e: StorageEvent) => {
    if (e.key !== key) return
    cache.delete(key)
    cb()
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.get(key)?.delete(cb)
    window.removeEventListener("storage", onStorage)
  }
}

export function useStoredList(key: string) {
  const list = useSyncExternalStore(
    useCallback((cb) => subscribe(key, cb), [key]),
    () => read(key),
    () => EMPTY
  )
  const set = useCallback((updater: (prev: string[]) => string[]) => write(key, updater(read(key))), [key])
  return [list, set] as const
}

/** Topics the reader follows — stored locally under "prism-topics" */
export function useFollowedTopics() {
  const [topics, set] = useStoredList("prism-topics")
  const toggle = useCallback(
    (slug: string) => {
      const following = read("prism-topics").includes(slug)
      set((prev) => (following ? prev.filter((s) => s !== slug) : [...prev, slug]))
      return !following
    },
    [set]
  )
  return { topics, toggle, isFollowing: (slug: string) => topics.includes(slug) }
}

/** Last searches, newest first, capped at 6 — stored under "prism-recent-searches" */
export function useRecentSearches() {
  const [recent, set] = useStoredList("prism-recent-searches")
  const add = useCallback(
    (q: string) => {
      const term = q.trim()
      if (!term) return
      set((prev) => [term, ...prev.filter((p) => p.toLowerCase() !== term.toLowerCase())].slice(0, 6))
    },
    [set]
  )
  const remove = useCallback((q: string) => set((prev) => prev.filter((p) => p !== q)), [set])
  const clear = useCallback(() => set(() => []), [set])
  return { recent, add, remove, clear }
}
