"use client"

// Private highlights: passages a reader marks for themselves. Firestore `private_highlights/{id}`:
//   userId · articleId · articleTitle · authorName · articleHref · paragraphIndex · selectedText ·
//   color · personalNote · createdAt
// The rules let only the owner read or change them (see firestore.rules).

import { useCallback, useEffect, useState } from "react"
import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, updateDoc, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { toast, useUIStore } from "@/lib/store"

export const HIGHLIGHTS = "private_highlights"

export type HighlightColor = "amber" | "sage" | "sky"
export const HIGHLIGHT_COLORS: { id: HighlightColor; label: string; swatch: string }[] = [
  { id: "amber", label: "Warm Amber", swatch: "#e9b44c" },
  { id: "sage", label: "Sage Green", swatch: "#8fb48a" },
  { id: "sky", label: "Sky Blue", swatch: "#7fb0dc" },
]

export interface PrivateHighlight {
  id: string
  userId: string
  articleId: string
  articleTitle: string
  authorName: string
  articleHref: string
  paragraphIndex: number
  selectedText: string
  color: HighlightColor
  personalNote: string
  createdAt: number
}

export type NewHighlight = Omit<PrivateHighlight, "id" | "userId" | "createdAt" | "personalNote"> & { personalNote?: string }

const warn = (msg: string, err: unknown) =>
  console.warn(`[highlights] ${msg}`, (err as { code?: string })?.code ?? (err as Error)?.message ?? err)

const isColor = (v: unknown): v is HighlightColor => v === "amber" || v === "sage" || v === "sky"

function fromDoc(id: string, d: Record<string, unknown>): PrivateHighlight {
  return {
    id,
    userId: String(d.userId ?? ""),
    articleId: String(d.articleId ?? ""),
    articleTitle: String(d.articleTitle ?? "Untitled story"),
    authorName: String(d.authorName ?? ""),
    articleHref: String(d.articleHref ?? ""),
    paragraphIndex: typeof d.paragraphIndex === "number" ? d.paragraphIndex : 0,
    selectedText: String(d.selectedText ?? ""),
    color: isColor(d.color) ? d.color : "amber",
    personalNote: String(d.personalNote ?? ""),
    createdAt: typeof d.createdAt === "number" ? d.createdAt : 0,
  }
}

/**
 * The signed-in reader's highlights, live. Pass an articleId to scope to one article.
 * Filters on userId only (no composite index); the article filter and sort happen here.
 */
export function useMyHighlights(articleId?: string, enabled = true) {
  const uid = useUIStore((s) => s.authUid)
  const [items, setItems] = useState<PrivateHighlight[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid || !enabled) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    return onSnapshot(
      query(collection(db, HIGHLIGHTS), where("userId", "==", uid)),
      (snap) => {
        const all = snap.docs.map((d) => fromDoc(d.id, d.data()))
        setItems((articleId ? all.filter((h) => h.articleId === articleId) : all).sort((a, b) => b.createdAt - a.createdAt))
        setLoading(false)
      },
      (err) => {
        warn("listener stopped", err)
        setLoading(false)
      }
    )
  }, [uid, articleId, enabled])

  return { highlights: items, loading, signedIn: !!uid }
}

/** One-off read (exports) */
export async function fetchMyHighlights(uid: string, articleId: string): Promise<PrivateHighlight[]> {
  try {
    const snap = await getDocs(query(collection(db, HIGHLIGHTS), where("userId", "==", uid)))
    return snap.docs
      .map((d) => fromDoc(d.id, d.data()))
      .filter((h) => h.articleId === articleId)
      .sort((a, b) => a.paragraphIndex - b.paragraphIndex || a.createdAt - b.createdAt)
  } catch (err) {
    warn("couldn't load highlights", err)
    return []
  }
}

export function useHighlightActions() {
  const uid = useUIStore((s) => s.authUid)

  const add = useCallback(
    async (h: NewHighlight) => {
      if (!uid) {
        toast("Sign in to keep private highlights.")
        return false
      }
      try {
        await addDoc(collection(db, HIGHLIGHTS), {
          ...h,
          selectedText: h.selectedText.slice(0, 2000),
          personalNote: (h.personalNote ?? "").slice(0, 1000),
          userId: uid,
          createdAt: Date.now(),
        })
        return true
      } catch (err) {
        warn("couldn't save", err)
        toast("Couldn't save your highlight.", { tone: "error" })
        return false
      }
    },
    [uid]
  )

  const update = useCallback(async (id: string, patch: Partial<Pick<PrivateHighlight, "color" | "personalNote">>) => {
    try {
      await updateDoc(doc(db, HIGHLIGHTS, id), patch)
    } catch (err) {
      warn("couldn't update", err)
      toast("Couldn't update that highlight.", { tone: "error" })
    }
  }, [])

  const remove = useCallback(async (id: string) => {
    try {
      await deleteDoc(doc(db, HIGHLIGHTS, id))
    } catch (err) {
      warn("couldn't delete", err)
      toast("Couldn't remove that highlight.", { tone: "error" })
    }
  }, [])

  return { add, update, remove }
}

/* ── Inline rendering ─────────────────────────────────────────────────────── */

const MARK = "mark[data-hl-id]"

/** Remove every highlight mark (and paragraph fallback) previously applied inside `container` */
export function clearInlineHighlights(container: Element) {
  container.querySelectorAll(MARK).forEach((m) => {
    const parent = m.parentNode
    if (!parent) return
    while (m.firstChild) parent.insertBefore(m.firstChild, m)
    parent.removeChild(m)
    parent.normalize()
  })
  container.querySelectorAll("[data-hl-para]").forEach((el) => {
    el.removeAttribute("data-hl-para")
    el.removeAttribute("data-hl-para-id")
  })
}

/** Wrap the first occurrence of `target` (whitespace-insensitive) inside `el` in highlight marks */
function wrapText(el: Element, target: string, h: PrivateHighlight): boolean {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  const map: { node: Text; offset: number }[] = []
  let flat = ""
  let prevSpace = true
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    const t = n.data
    for (let i = 0; i < t.length; i++) {
      const ws = /\s/.test(t[i])
      if (ws && prevSpace) continue
      flat += ws ? " " : t[i]
      prevSpace = ws
      map.push({ node: n, offset: i })
    }
  }
  const at = flat.indexOf(target)
  if (at < 0 || !target) return false

  const start = map[at]
  const end = map[at + target.length - 1]
  const nodes: Text[] = []
  for (const m of map.slice(at, at + target.length)) if (nodes[nodes.length - 1] !== m.node) nodes.push(m.node)

  for (const tn of nodes) {
    const s = tn === start.node ? start.offset : 0
    const e = tn === end.node ? end.offset + 1 : tn.length
    if (s >= e) continue
    let mid = tn
    if (s > 0) mid = mid.splitText(s)
    if (e - s < mid.length) mid.splitText(e - s)
    if (!mid.data.trim()) continue
    const mark = document.createElement("mark")
    mark.className = "prism-hl"
    mark.dataset.hlId = h.id
    mark.dataset.color = h.color
    mark.title = h.personalNote ? `Your note: ${h.personalNote}` : "Your private highlight"
    mid.parentNode?.insertBefore(mark, mid)
    mark.appendChild(mid)
  }
  return true
}

/** Paint the reader's highlights onto the article body. Only this browser's DOM changes. */
export function applyInlineHighlights(container: Element, highlights: PrivateHighlight[], blocks: Element[]) {
  clearInlineHighlights(container)
  const norm = (s: string) => s.replace(/\s+/g, " ").trim()
  // Oldest first, so newer highlights nest inside older ones when they overlap
  for (const h of [...highlights].sort((a, b) => a.createdAt - b.createdAt)) {
    const anchor = blocks[h.paragraphIndex]
    const full = norm(h.selectedText)
    const firstLine = norm(h.selectedText.split(/\n+/)[0] ?? "")
    const placed =
      (anchor && wrapText(anchor, full, h)) ||
      (anchor && firstLine.length >= 3 && wrapText(anchor, firstLine, h)) ||
      blocks.some((b) => b !== anchor && wrapText(b, full, h))
    // The text was edited since: mark the paragraph itself so the highlight isn't silently lost
    if (!placed && anchor && !anchor.hasAttribute("data-hl-para")) {
      anchor.setAttribute("data-hl-para", h.color)
      anchor.setAttribute("data-hl-para-id", h.id)
    }
  }
}
