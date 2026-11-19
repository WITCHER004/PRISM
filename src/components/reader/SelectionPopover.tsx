"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { createPortal } from "react-dom"
import { Highlighter, MessageSquarePlus, Sparkles } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { dur, ease } from "@/lib/motion"
import { HIGHLIGHT_COLORS, type HighlightColor } from "@/lib/highlights"
import { paragraphIndexOf } from "@/lib/reader/paragraphs"

export interface SelectionPayload {
  text: string
  paragraphIndex: number
  rect: DOMRect
}

interface SelectionPopoverProps {
  containerRef: React.RefObject<HTMLElement | null>
  onAddMarginNote: (payload: SelectionPayload) => void
  onCreateQuoteCard: (payload: SelectionPayload) => void
  /** Omit to hide the private-highlight action */
  onPrivateHighlight?: (payload: SelectionPayload, color: HighlightColor) => void
}

/**
 * Floating #141413 obsidian popover pill that appears whenever text is highlighted
 * inside an article body.
 */
export function SelectionPopover({ containerRef, onAddMarginNote, onCreateQuoteCard, onPrivateHighlight }: SelectionPopoverProps) {
  const [selectionPayload, setSelectionPayload] = useState<SelectionPayload | null>(null)
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSelectionChange = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      setSelectionPayload(null)
      return
    }

    const text = sel.toString().trim()
    if (!text || text.length < 3) {
      setSelectionPayload(null)
      return
    }

    const container = containerRef.current
    if (!container) return

    const range = sel.getRangeAt(0)
    // Check if selection is inside container
    const commonAncestor = range.commonAncestorContainer
    if (!container.contains(commonAncestor)) {
      setSelectionPayload(null)
      return
    }

    // Nearest paragraph index within container (same counting as highlights and reading progress)
    const paragraphIndex = paragraphIndexOf(container, range.startContainer)

    const rect = range.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) return

    setSelectionPayload({
      text,
      paragraphIndex: Math.max(0, paragraphIndex),
      rect,
    })

    // Calculate position: centered above selection
    const top = window.scrollY + rect.top - 54
    const left = window.scrollX + rect.left + rect.width / 2
    setPopoverPos({ top, left })
  }, [containerRef])

  useEffect(() => {
    const onMouseUp = () => {
      // Small timeout to allow selection to settle
      setTimeout(handleSelectionChange, 10)
    }

    document.addEventListener("mouseup", onMouseUp)
    document.addEventListener("selectionchange", handleSelectionChange)

    return () => {
      document.removeEventListener("mouseup", onMouseUp)
      document.removeEventListener("selectionchange", handleSelectionChange)
    }
  }, [handleSelectionChange])

  if (!mounted || !selectionPayload || !popoverPos) return null

  return createPortal(
    <AnimatePresence>
      <motion.div
        ref={popoverRef}
        initial={{ opacity: 0, y: 6, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: dur.fast, ease: ease.out } }}
        exit={{ opacity: 0, y: 6, scale: 0.94, transition: { duration: dur.fast, ease: ease.in } }}
        style={{
          position: "absolute",
          top: `${popoverPos.top}px`,
          left: `${popoverPos.left}px`,
          transform: "translateX(-50%)",
          zIndex: 9999,
        }}
        className="flex items-center gap-1 p-1 rounded-full bg-[#141413] text-[#f4f1ea] border border-white/10 shadow-[0_16px_36px_-8px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.06)] backdrop-blur-md select-none"
        onMouseDown={(e) => {
          // Prevent losing selection on click
          e.preventDefault()
        }}
      >
        <button
          type="button"
          onClick={() => {
            onAddMarginNote(selectionPayload)
            setSelectionPayload(null)
          }}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium text-[#f4f1ea] hover:bg-white/15 transition-colors"
        >
          <MessageSquarePlus className="w-3.5 h-3.5 text-amber-400" />
          <span>Add Margin Note</span>
        </button>

        <span className="w-px h-3.5 bg-white/15" aria-hidden />

        <button
          type="button"
          onClick={() => {
            onCreateQuoteCard(selectionPayload)
            setSelectionPayload(null)
          }}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold text-amber-300 hover:bg-white/15 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 fill-amber-300" />
          <span>Create Quote Card</span>
        </button>

        {onPrivateHighlight && (
          <>
            <span className="w-px h-3.5 bg-white/15" aria-hidden />
            <div className="inline-flex items-center gap-0.5 pr-1" role="group" aria-label="Private highlight">
              <button
                type="button"
                onClick={() => {
                  onPrivateHighlight(selectionPayload, "amber")
                  setSelectionPayload(null)
                }}
                title="Only you can see your highlights"
                className="inline-flex items-center gap-1.5 h-8 pl-3 pr-2 rounded-full text-xs font-medium text-[#f4f1ea] hover:bg-white/15 transition-colors"
              >
                <Highlighter className="w-3.5 h-3.5 text-amber-300" />
                <span>Private Highlight</span>
              </button>
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-label={`Highlight in ${c.label}`}
                  title={c.label}
                  onClick={() => {
                    onPrivateHighlight(selectionPayload, c.id)
                    setSelectionPayload(null)
                  }}
                  className="grid place-items-center w-6 h-6 rounded-full hover:bg-white/15 transition-colors"
                >
                  <span className="w-3 h-3 rounded-full ring-1 ring-white/25" style={{ background: c.swatch }} />
                </button>
              ))}
            </div>
          </>
        )}
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}

