"use client"

import { useEffect, useLayoutEffect, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "motion/react"
import { Trash2, X } from "lucide-react"
import { dur, ease } from "@/lib/motion"
import {
  applyInlineHighlights,
  clearInlineHighlights,
  HIGHLIGHT_COLORS,
  useHighlightActions,
  type PrivateHighlight,
} from "@/lib/highlights"
import { paragraphsIn } from "@/lib/reader/paragraphs"
import { toast } from "@/lib/store"

/**
 * Paints the reader's own highlights onto the article body (their browser only) and opens a small
 * editor when one is clicked: recolour, add a private note, or remove it.
 */
export function InlineHighlights({
  containerRef,
  highlights,
}: {
  containerRef: React.RefObject<HTMLElement | null>
  highlights: PrivateHighlight[]
}) {
  const [active, setActive] = useState<{ id: string; top: number; left: number } | null>(null)
  const { update, remove } = useHighlightActions()

  // Re-paint whenever the list changes; the body HTML itself is set once by React and left alone
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    applyInlineHighlights(container, highlights, paragraphsIn(container))
    return () => clearInlineHighlights(container)
  }, [containerRef, highlights])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const onClick = (e: MouseEvent) => {
      if (window.getSelection()?.toString().trim()) return // they're selecting, not clicking
      const el = (e.target as Element).closest<HTMLElement>("mark[data-hl-id], [data-hl-para-id]")
      if (!el) return
      const id = el.dataset.hlId ?? el.dataset.hlParaId
      if (!id) return
      const r = el.getBoundingClientRect()
      setActive({ id, top: window.scrollY + r.bottom + 8, left: window.scrollX + r.left + Math.min(r.width, 320) / 2 })
    }
    container.addEventListener("click", onClick)
    return () => container.removeEventListener("click", onClick)
  }, [containerRef])

  const h = active ? highlights.find((x) => x.id === active.id) : undefined
  if (typeof document === "undefined") return null

  return createPortal(
    <AnimatePresence>
      {active && h && (
        <HighlightEditor
          key={h.id}
          highlight={h}
          top={active.top}
          left={active.left}
          onClose={() => setActive(null)}
          onColor={(color) => update(h.id, { color })}
          onSaveNote={(personalNote) => {
            update(h.id, { personalNote })
            toast(personalNote ? "Note saved to your highlight" : "Note removed")
            setActive(null)
          }}
          onRemove={() => {
            remove(h.id)
            toast("Highlight removed")
            setActive(null)
          }}
        />
      )}
    </AnimatePresence>,
    document.body
  )
}

function HighlightEditor({
  highlight,
  top,
  left,
  onClose,
  onColor,
  onSaveNote,
  onRemove,
}: {
  highlight: PrivateHighlight
  top: number
  left: number
  onClose: () => void
  onColor: (c: PrivateHighlight["color"]) => void
  onSaveNote: (note: string) => void
  onRemove: () => void
}) {
  const [note, setNote] = useState(highlight.personalNote)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const width = 288
  const x = Math.min(Math.max(left - width / 2, 12), (typeof window !== "undefined" ? window.innerWidth : 1024) - width - 12)

  return (
    <>
      <div className="fixed inset-0 z-[9998]" onClick={onClose} aria-hidden />
      <motion.div
        role="dialog"
        aria-label="Your private highlight"
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0, transition: { duration: dur.fast, ease: ease.out } }}
        exit={{ opacity: 0, y: -4, transition: { duration: dur.fast, ease: ease.in } }}
        style={{ position: "absolute", top, left: x, width, zIndex: 9999 }}
        className="p-3 rounded-2xl bg-[#141413] text-[#f4f1ea] border border-white/10 shadow-[0_16px_36px_-8px_rgba(0,0,0,0.5)]"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#f4f1ea]/55">Private · only you</p>
          <button type="button" onClick={onClose} aria-label="Close" className="grid place-items-center w-6 h-6 rounded-full hover:bg-white/10">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="mt-2 flex items-center gap-1.5" role="radiogroup" aria-label="Highlight colour">
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={highlight.color === c.id}
              aria-label={c.label}
              title={c.label}
              onClick={() => onColor(c.id)}
              className={`grid place-items-center w-7 h-7 rounded-full transition-colors ${highlight.color === c.id ? "bg-white/15" : "hover:bg-white/10"}`}
            >
              <span className="w-3.5 h-3.5 rounded-full ring-1 ring-white/25" style={{ background: c.swatch }} />
            </button>
          ))}
        </div>
        <label className="sr-only" htmlFor={`hl-note-${highlight.id}`}>
          Personal note
        </label>
        <textarea
          id={`hl-note-${highlight.id}`}
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 1000))}
          placeholder="Add a private note…"
          rows={3}
          className="mt-2 w-full resize-none rounded-xl bg-white/[0.06] border border-white/10 px-3 py-2 text-[13px] leading-relaxed placeholder:text-[#f4f1ea]/40 outline-none focus:border-amber-300/50"
        />
        <div className="mt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full text-xs text-[#f4f1ea]/70 hover:text-[#ffb4a8] hover:bg-white/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> Remove
          </button>
          <button
            type="button"
            onClick={() => onSaveNote(note.trim())}
            disabled={note.trim() === highlight.personalNote}
            className="h-8 px-3.5 rounded-full text-xs font-semibold bg-[#f4f1ea] text-[#141413] disabled:opacity-40 transition-opacity"
          >
            Save note
          </button>
        </div>
      </motion.div>
    </>
  )
}
