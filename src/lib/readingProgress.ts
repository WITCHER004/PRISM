"use client"

// Reading progress (resume across devices) and reading history, both in Firestore and keyed by
// `{uid}_{articleId}` so each reader has one document per article:
//
//   reading_progress/{uid}_{articleId}   where the reader is now (scroll %, paragraph) → resume + Continue Reading
//   reading_history/{uid}_{articleId}    that they read it at all (furthest %, read count, last visit) → History
//
// Writes are debounced to one every few seconds while scrolling, plus a flush when the tab hides or the
// reader leaves. Only the owner can read or write either (see firestore.rules).

import { useCallback, useEffect, useRef, useState } from "react"
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { toast, useUIStore } from "@/lib/store"
import { paragraphFromHash, readingPosition, scrollToParagraph } from "@/lib/reader/paragraphs"

export const PROGRESS = "reading_progress"
export const HISTORY = "reading_history"
const WRITE_EVERY_MS = 3000
const HISTORY_AFTER_MS = 5000
const HISTORY_AFTER_PERCENT = 10

const warn = (msg: string, err: unknown) =>
  console.warn(`[reading] ${msg}`, (err as { code?: string })?.code ?? (err as Error)?.message ?? err)

const keyFor = (uid: string, articleId: string) => `${uid}_${articleId}`

/** What the reader page knows about the article (copied into both documents for the list views) */
export interface ReadingMeta {
  articleId: string
  articleTitle: string
  articleSubtitle: string
  topic: string
  authorName: string
  authorAvatar: string
  isAdvancedPaper: boolean
  /** Path to reopen the article */
  href: string
}

export interface ProgressEntry {
  id: string
  articleId: string
  articleTitle: string
  authorName: string
  topic: string
  href: string
  progressPercent: number
  paragraphIndex: number
  lastReadAt: number
}

export interface HistoryEntry {
  id: string
  articleId: string
  articleTitle: string
  articleSubtitle: string
  topic: string
  authorName: string
  authorAvatar: string
  isAdvancedPaper: boolean
  href: string
  progressPercent: number
  readCount: number
  lastVisitedAt: number
}

const n = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d)
const s = (v: unknown, d = "") => (typeof v === "string" ? v : d)

const progressFrom = (id: string, d: Record<string, unknown>): ProgressEntry => ({
  id,
  articleId: s(d.articleId),
  articleTitle: s(d.articleTitle, "Untitled story"),
  authorName: s(d.authorName),
  topic: s(d.topic),
  href: s(d.articleHref),
  progressPercent: n(d.progressPercent),
  paragraphIndex: n(d.paragraphIndex),
  lastReadAt: n(d.lastReadAt),
})

const historyFrom = (id: string, d: Record<string, unknown>): HistoryEntry => ({
  id,
  articleId: s(d.articleId),
  articleTitle: s(d.articleTitle, "Untitled story"),
  articleSubtitle: s(d.articleSubtitle),
  topic: s(d.topic),
  authorName: s(d.authorName),
  authorAvatar: s(d.authorAvatar),
  isAdvancedPaper: d.isAdvancedPaper === true,
  href: s(d.articleHref),
  progressPercent: n(d.progressPercent),
  readCount: n(d.readCount, 1),
  lastVisitedAt: n(d.lastVisitedAt),
})

/* ── The reader page ──────────────────────────────────────────────────────── */

export interface ResumeState {
  percent: number
  paragraphIndex: number
}

/**
 * Tracks the signed-in reader's position in `containerRef`, restores it on open, and logs the visit to
 * their history once they've stayed 5 seconds or read past 10%.
 */
export function useReadingTracker(containerRef: React.RefObject<HTMLElement | null>, meta: ReadingMeta | null) {
  const uid = useUIStore((s) => s.authUid)
  const [resumed, setResumed] = useState<ResumeState | null>(null)
  // The latest meta without re-running the effect when a parent re-renders with a new object
  const metaRef = useRef(meta)
  useEffect(() => {
    metaRef.current = meta
  })
  const articleId = meta?.articleId

  useEffect(() => {
    const container = containerRef.current
    if (!uid || !articleId || !container) return

    const progressRef = doc(db, PROGRESS, keyFor(uid, articleId))
    const historyRef = doc(db, HISTORY, keyFor(uid, articleId))
    let ready = false // nothing is written until the saved position has been read (and maybe restored)
    let disposed = false
    let logged = false
    let furthest = 0
    let current = { percent: 0, paragraphIndex: 0 }
    let lastWritten = -1
    let timer: ReturnType<typeof setTimeout> | undefined

    const base = () => {
      const m = metaRef.current!
      return {
        userId: uid,
        articleId: m.articleId,
        articleTitle: m.articleTitle,
        authorName: m.authorName,
        topic: m.topic,
        articleHref: m.href,
      }
    }

    const logHistory = () => {
      if (logged || !ready) return
      logged = true
      const m = metaRef.current!
      setDoc(
        historyRef,
        {
          ...base(),
          articleSubtitle: m.articleSubtitle,
          authorAvatar: m.authorAvatar,
          isAdvancedPaper: m.isAdvancedPaper,
          progressPercent: furthest,
          readCount: increment(1),
          lastVisitedAt: Date.now(),
        },
        { merge: true }
      ).catch((err) => warn("couldn't log history", err))
    }

    const flush = () => {
      clearTimeout(timer)
      timer = undefined
      if (!ready || current.percent === lastWritten) return
      lastWritten = current.percent
      const at = Date.now()
      setDoc(progressRef, { ...base(), progressPercent: current.percent, paragraphIndex: current.paragraphIndex, lastReadAt: at }, { merge: true }).catch(
        (err) => warn("couldn't save progress", err)
      )
      if (logged) {
        setDoc(historyRef, { ...base(), progressPercent: furthest, lastVisitedAt: at }, { merge: true }).catch((err) => warn("couldn't update history", err))
      }
    }

    const onScroll = () => {
      if (!ready) return
      current = readingPosition(container)
      furthest = Math.max(furthest, current.percent)
      if (current.percent > HISTORY_AFTER_PERCENT) logHistory()
      if (!timer) timer = setTimeout(flush, WRITE_EVERY_MS)
    }
    const onHide = () => {
      if (document.visibilityState === "hidden") flush()
    }

    // Read the saved state, then restore: a #para-N deep link wins over the saved position
    Promise.all([getDoc(progressRef), getDoc(historyRef)])
      .then(([p, h]) => {
        if (disposed) return
        furthest = n(h.data()?.progressPercent)
        const saved = p.exists() ? progressFrom(p.id, p.data()) : null
        const deep = paragraphFromHash(window.location.hash)
        if (deep !== null) {
          requestAnimationFrame(() => scrollToParagraph(container, deep))
        } else if (saved && saved.progressPercent > 5 && saved.progressPercent < 95 && window.scrollY < 200) {
          requestAnimationFrame(() => {
            if (scrollToParagraph(container, saved.paragraphIndex)) setResumed({ percent: saved.progressPercent, paragraphIndex: saved.paragraphIndex })
          })
        }
        if (saved) lastWritten = saved.progressPercent
      })
      .catch((err) => warn("couldn't read saved progress", err))
      .finally(() => {
        if (disposed) return
        // Let a restore scroll settle before positions count as reading
        setTimeout(() => {
          if (disposed) return
          ready = true
          onScroll()
        }, 900)
      })

    const dwell = setTimeout(logHistory, HISTORY_AFTER_MS)
    window.addEventListener("scroll", onScroll, { passive: true })
    document.addEventListener("visibilitychange", onHide)
    window.addEventListener("pagehide", flush)
    return () => {
      disposed = true
      flush()
      clearTimeout(dwell)
      window.removeEventListener("scroll", onScroll)
      document.removeEventListener("visibilitychange", onHide)
      window.removeEventListener("pagehide", flush)
    }
  }, [uid, articleId, containerRef])

  return { resumed, dismissResume: useCallback(() => setResumed(null), []) }
}

/* ── Lists ────────────────────────────────────────────────────────────────── */

/** Live, owner-only list from one of the two collections (single-field query, sorted here) */
function useOwnList<T>(col: string, from: (id: string, d: Record<string, unknown>) => T, sortKey: (t: T) => number) {
  const uid = useUIStore((s) => s.authUid)
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!uid) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    return onSnapshot(
      query(collection(db, col), where("userId", "==", uid)),
      (snap) => {
        setItems(snap.docs.map((d) => from(d.id, d.data())).sort((a, b) => sortKey(b) - sortKey(a)))
        setLoading(false)
      },
      (err) => {
        warn(`${col} listener stopped`, err)
        setLoading(false)
      }
    )
    // from/sortKey are module-level functions passed by the hooks below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, col])
  return { items, loading, uid }
}

const byLastRead = (p: ProgressEntry) => p.lastReadAt
const byLastVisit = (h: HistoryEntry) => h.lastVisitedAt

/** Articles the reader is part-way through (5–95%), most recent first */
export function useContinueReading(max = 3) {
  const { items, loading, uid } = useOwnList(PROGRESS, progressFrom, byLastRead)
  return {
    items: items.filter((p) => p.progressPercent > 5 && p.progressPercent < 95 && p.href).slice(0, max),
    loading,
    signedIn: !!uid,
  }
}

export function useReadingHistory() {
  const { items, loading, uid } = useOwnList(HISTORY, historyFrom, byLastVisit)

  const remove = useCallback(
    async (articleId: string) => {
      if (!uid) return
      try {
        await deleteDoc(doc(db, HISTORY, keyFor(uid, articleId)))
      } catch (err) {
        warn("couldn't remove from history", err)
        toast("Couldn't remove that entry.", { tone: "error" })
      }
    },
    [uid]
  )

  const clearAll = useCallback(async () => {
    if (!uid) return false
    try {
      const snap = await getDocs(query(collection(db, HISTORY), where("userId", "==", uid)))
      for (let i = 0; i < snap.docs.length; i += 450) {
        const batch = writeBatch(db)
        snap.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref))
        await batch.commit()
      }
      return true
    } catch (err) {
      warn("couldn't clear history", err)
      toast("Couldn't clear your history.", { tone: "error" })
      return false
    }
  }, [uid])

  return { items, loading, signedIn: !!uid, remove, clearAll }
}
