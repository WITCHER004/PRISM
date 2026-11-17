"use client"

import { useEffect, useRef } from "react"
import { useHydrated } from "@/components/studio/useHydrated"
import { useUIStore } from "@/lib/store"

/**
 * Logs one view of a published article: deduped per reader per 24h in this browser, then counted on
 * Firestore articles/{id}.views (the author's own reads don't count).
 */
export function ViewTracker({ postId, author }: { postId: string; author: string }) {
  const hydrated = useHydrated()
  const recordView = useUIStore((s) => s.recordView)
  const currentUser = useUIStore((s) => s.currentUser)
  const sent = useRef<string | null>(null)

  useEffect(() => {
    // Wait for the persisted store, then count once per reader per page visit
    if (!hydrated) return
    const key = `${postId}:${currentUser ?? "anon"}`
    if (sent.current === key) return
    sent.current = key
    recordView(postId, author)
    if (process.env.NEXT_PUBLIC_DATA_MODE === "database") {
      fetch(`/api/articles/${encodeURIComponent(postId)}/views`, { method: "POST", keepalive: true }).catch(() => {})
    }
  }, [hydrated, postId, author, currentUser, recordView])

  return null
}
