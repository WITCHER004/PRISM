"use client"

import { type Editor } from "@tiptap/react"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "motion/react"
import { Heading2, Heading3, List, ListOrdered, Quote, SquareCode, ImagePlus, Minus, Pilcrow } from "lucide-react"
import { dur, ease } from "@/lib/motion"
import { cn } from "@/lib/utils"

interface SlashItem {
  label: string
  desc: string
  keywords: string
  icon: React.ComponentType<{ className?: string }>
  run: (editor: Editor, ctx: { requestImage: () => void }) => void
}

const ITEMS: SlashItem[] = [
  { label: "Heading", desc: "Big section heading", keywords: "h2 title section", icon: Heading2, run: (e) => e.chain().focus().setHeading({ level: 2 }).run() },
  { label: "Subheading", desc: "Smaller heading", keywords: "h3", icon: Heading3, run: (e) => e.chain().focus().setHeading({ level: 3 }).run() },
  { label: "Bullet list", desc: "A simple list", keywords: "ul unordered", icon: List, run: (e) => e.chain().focus().toggleBulletList().run() },
  { label: "Numbered list", desc: "Steps in order", keywords: "ol ordered", icon: ListOrdered, run: (e) => e.chain().focus().toggleOrderedList().run() },
  { label: "Quote", desc: "Pull a line forward", keywords: "blockquote callout", icon: Quote, run: (e) => e.chain().focus().toggleBlockquote().run() },
  { label: "Code block", desc: "Monospaced code", keywords: "pre snippet", icon: SquareCode, run: (e) => e.chain().focus().toggleCodeBlock().run() },
  { label: "Image", desc: "Embed from a URL", keywords: "picture photo img", icon: ImagePlus, run: (_e, ctx) => ctx.requestImage() },
  { label: "Divider", desc: "Separate sections", keywords: "hr rule line", icon: Minus, run: (e) => e.chain().focus().setHorizontalRule().run() },
  { label: "Text", desc: "Plain paragraph", keywords: "paragraph p body", icon: Pilcrow, run: (e) => e.chain().focus().setParagraph().run() },
]

interface SlashState {
  from: number
  to: number
  query: string
}

const MENU_W = 272
const MENU_H = 340

// Type "/" at the start of an empty line to insert a block. Arrow keys move, Enter/Tab picks,
// Escape dismisses. The menu follows the caret and flips above it near the bottom of the screen.
export function SlashMenu({ editor, onRequestImage }: { editor: Editor; onRequestImage: () => void }) {
  const [state, setState] = useState<SlashState | null>(null)
  const [selected, setSelected] = useState(0)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const dismissedAt = useRef<number | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = state
    ? ITEMS.filter((i) => {
        const q = state.query.toLowerCase().trim()
        return !q || i.label.toLowerCase().includes(q) || i.keywords.includes(q)
      })
    : []
  const open = !!state && filtered.length > 0

  // Watch the text before the caret for "/query"
  useEffect(() => {
    const check = () => {
      const { selection } = editor.state
      const { $from, empty } = selection
      if (!empty || !editor.isFocused || $from.parent.type.name !== "paragraph") return setState(null)
      const before = $from.parent.textBetween(0, $from.parentOffset, undefined, "￼")
      const m = /^\/([\w ]{0,24})$/.exec(before)
      if (!m) {
        dismissedAt.current = null
        return setState(null)
      }
      const from = $from.pos - m[0].length
      if (dismissedAt.current === from) return setState(null)
      setState((prev) => {
        if (!prev || prev.query !== m[1]) setSelected(0)
        return { from, to: $from.pos, query: m[1] }
      })
    }
    editor.on("transaction", check)
    editor.on("blur", check)
    return () => {
      editor.off("transaction", check)
      editor.off("blur", check)
    }
  }, [editor])

  const place = useCallback(() => {
    if (!state) return
    try {
      const c = editor.view.coordsAtPos(state.from)
      const below = c.bottom + 8
      const top = below + MENU_H > window.innerHeight ? Math.max(8, c.top - MENU_H - 8) : below
      const left = Math.min(Math.max(8, c.left), window.innerWidth - MENU_W - 8)
      setPos({ top, left })
    } catch {
      /* position not in view yet */
    }
  }, [editor, state])

  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  useEffect(() => {
    if (!open) return
    window.addEventListener("scroll", place, true)
    window.addEventListener("resize", place)
    return () => {
      window.removeEventListener("scroll", place, true)
      window.removeEventListener("resize", place)
    }
  }, [open, place])

  const choose = useCallback(
    (item: SlashItem) => {
      if (!state) return
      editor.chain().focus().deleteRange({ from: state.from, to: state.to }).run()
      item.run(editor, { requestImage: onRequestImage })
      setState(null)
    },
    [editor, state, onRequestImage]
  )

  // Capture keys before ProseMirror sees them while the menu is open
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (!editor.view.dom.contains(e.target as Node)) return
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault()
        e.stopPropagation()
        setSelected((s) => (s + (e.key === "ArrowDown" ? 1 : -1) + filtered.length) % filtered.length)
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault()
        e.stopPropagation()
        const item = filtered[Math.min(selected, filtered.length - 1)]
        if (item) choose(item)
      } else if (e.key === "Escape") {
        e.preventDefault()
        e.stopPropagation()
        dismissedAt.current = state?.from ?? null
        setState(null)
      }
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [open, filtered, selected, choose, editor, state])

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${selected}"]`)?.scrollIntoView({ block: "nearest" })
  }, [selected])

  // Portaled to <body> so "fixed" means the viewport even inside transformed layout
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: dur.fast, ease: ease.out } }}
          exit={{ opacity: 0, transition: { duration: dur.fast * 0.75, ease: ease.in } }}
          className="fixed z-[60] panel shadow-[var(--shadow-lift)] overflow-hidden origin-top-left"
          style={{ top: pos.top, left: pos.left, width: MENU_W }}
        >
          <p className="meta px-4 pt-3 pb-1">Insert block</p>
          <div ref={listRef} role="listbox" aria-label="Insert block" className="p-1.5 max-h-[300px] overflow-y-auto">
            {filtered.map((item, i) => {
              const Icon = item.icon
              const active = i === selected
              return (
                <button
                  key={item.label}
                  type="button"
                  role="option"
                  aria-selected={active}
                  data-index={i}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setSelected(i)}
                  onClick={() => choose(item)}
                  className={cn(
                    "flex items-center gap-3 w-full min-h-11 px-2.5 py-2 rounded-[12px] text-left transition-colors",
                    active ? "bg-[var(--surface)] text-[var(--fg)]" : "text-[var(--fg-secondary)]"
                  )}
                >
                  <span className="grid place-items-center w-8 h-8 shrink-0 rounded-[10px] bg-[var(--bg)] border border-[var(--border)] text-[var(--fg-muted)]">
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium leading-tight">{item.label}</span>
                    <span className="block text-xs text-[var(--fg-muted)]">{item.desc}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
