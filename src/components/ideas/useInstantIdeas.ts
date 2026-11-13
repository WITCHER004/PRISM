"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  deleteRemoteIdea,
  fetchRemoteIdeas,
  isActive,
  loadLocalIdeas,
  loadReactions,
  loadSeen,
  newIdeaId,
  saveLocalIdeas,
  saveReactions,
  saveRemoteIdea,
  saveSeen,
  type IdeaFormat,
  type IdeaReaction,
  type IdeaTheme,
  type InstantIdea,
} from "@/lib/ideas"
import type { Viewer } from "@/components/providers/useViewer"

const CLEANUP_TICK_MS = 30_000

export type NewIdea = { text: string; format: IdeaFormat; theme: IdeaTheme; durationMs: number }

/**
 * Active Instant Ideas: this device's (localStorage) merged with Firestore's. Expired ideas drop out on
 * every render, on a 30-second tick, and exactly when the next one is due, so they vanish live.
 */
export function useInstantIdeas() {
  const [ready, setReady] = useState(false)
  const [now, setNow] = useState(0)
  const [local, setLocal] = useState<InstantIdea[]>([])
  const [remote, setRemote] = useState<InstantIdea[]>([])
  const [reactions, setReactions] = useState<Record<string, IdeaReaction[]>>({})
  const [seen, setSeen] = useState<Set<string>>(() => new Set())

  // Client-only state: load after mount so server and first client render match
  useEffect(() => {
    const t = Date.now()
    setNow(t)
    setLocal(loadLocalIdeas(t))
    setReactions(loadReactions())
    setSeen(loadSeen())
    setReady(true)
    let cancelled = false
    fetchRemoteIdeas(t).then((r) => {
      if (!cancelled) setRemote(r)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), CLEANUP_TICK_MS)
    return () => clearInterval(id)
  }, [])

  const ideas = useMemo(() => {
    const byId = new Map<string, InstantIdea>()
    for (const i of remote) byId.set(i.id, i)
    for (const i of local) byId.set(i.id, i) // this device's copy wins
    return [...byId.values()].filter((i) => isActive(i, now)).sort((a, b) => b.createdAt - a.createdAt)
  }, [local, remote, now])

  // Wake exactly when the soonest idea expires, so it doesn't linger up to 30s
  useEffect(() => {
    if (!ideas.length) return
    const next = Math.min(...ideas.map((i) => i.expiresAt))
    const t = setTimeout(() => setNow(Date.now()), Math.max(0, next - Date.now()) + 50)
    return () => clearTimeout(t)
  }, [ideas])

  // Keep expired ideas out of storage too
  useEffect(() => {
    if (!ready) return
    setLocal((prev) => {
      const kept = prev.filter((i) => isActive(i, now))
      if (kept.length === prev.length) return prev
      saveLocalIdeas(kept)
      return kept
    })
  }, [now, ready])

  const post = useCallback((input: NewIdea, author: Viewer) => {
    const created = Date.now()
    const idea: InstantIdea = {
      id: newIdeaId(),
      text: input.text.trim(),
      format: input.format,
      theme: input.theme,
      authorHandle: author.username,
      authorName: author.displayName,
      authorAvatar: author.avatarUrl,
      authorUid: author.uid,
      createdAt: created,
      expiresAt: created + input.durationMs,
    }
    setNow(created)
    setLocal((prev) => {
      const next = [idea, ...prev]
      saveLocalIdeas(next)
      return next
    })
    saveRemoteIdea(idea) // best effort; never blocks the UI
    return idea
  }, [])

  const remove = useCallback((idea: InstantIdea) => {
    setLocal((prev) => {
      const next = prev.filter((i) => i.id !== idea.id)
      saveLocalIdeas(next)
      return next
    })
    setRemote((prev) => prev.filter((i) => i.id !== idea.id))
    if (!idea.sample) deleteRemoteIdea(idea.id)
  }, [])

  const toggleReaction = useCallback((id: string, r: IdeaReaction, voterHandle?: string) => {
    setReactions((prev) => {
      const mine = prev[id] ?? []
      const next = { ...prev, [id]: mine.includes(r) ? mine.filter((x) => x !== r) : [...mine, r] }
      saveReactions(next)
      return next
    })

    // If voterHandle is provided, record it in local idea voterIds
    if (voterHandle) {
      setLocal((prev) => {
        const next = prev.map((idea) => {
          if (idea.id !== id) return idea
          const existingVoters = idea.voterIds ?? []
          const voterIds = existingVoters.includes(voterHandle) ? existingVoters : [...existingVoters, voterHandle]
          return { ...idea, voterIds }
        })
        saveLocalIdeas(next)
        return next
      })
    }
  }, [])

  /** Test helper to immediately add 5 sparks to verify threshold crossing */
  const addSparksTest = useCallback((id: string, count: number = 5) => {
    setLocal((prev) => {
      const next = prev.map((idea) => {
        if (idea.id !== id) return idea
        const currentSparked = idea.counts?.sparked ?? 0
        const newSparked = currentSparked + count
        const counts = { ...idea.counts, sparked: newSparked }
        const isImmortal = newSparked >= 25
        const testVoters = ["priyarao", "marcuswilliams", "sarahkim", "alexchen", "elena_v"]
        const voterIds = Array.from(new Set([...(idea.voterIds ?? []), ...testVoters.slice(0, count)]))
        return { ...idea, counts, isImmortal, voterIds }
      })
      saveLocalIdeas(next)
      return next
    })
  }, [])

  const markSeen = useCallback((id: string) => {
    setSeen((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev).add(id)
      saveSeen(next)
      return next
    })
  }, [])

  const reactionCount = useCallback(
    (idea: InstantIdea, r: IdeaReaction) => (idea.counts?.[r] ?? 0) + (reactions[idea.id]?.includes(r) ? 1 : 0),
    [reactions]
  )

  return { ready, now, ideas, post, remove, reactions, toggleReaction, reactionCount, seen, markSeen, addSparksTest }
}

export type InstantIdeasApi = ReturnType<typeof useInstantIdeas>
