"use client"

import { useEffect, useRef, useState } from "react"
import { type Editor, useEditorState } from "@tiptap/react"
import { AnimatePresence, motion } from "motion/react"
import {
  Bold, Italic, Underline, Link2, Heading2, Heading3, List, ListOrdered, Quote,
  SquareCode, Code, Highlighter, Undo2, Redo2, Strikethrough, ImagePlus, Check, X, Unlink,
} from "lucide-react"
import { dur, ease } from "@/lib/motion"
import { cn } from "@/lib/utils"

export type UrlMode = "link" | "image" | null

interface ToolbarProps {
  editor: Editor
  urlMode: UrlMode
  onUrlModeChange: (mode: UrlMode) => void
}

interface ToolbarBtn {
  icon: React.ComponentType<{ className?: string }>
  action: () => void
  active?: boolean
  disabled?: boolean
  label: string
  shortcut?: string
}

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)

function normalizeUrl(raw: string) {
  const v = raw.trim()
  if (!v) return ""
  if (/^(https?:|mailto:)/i.test(v)) return v
  if (v.startsWith("/")) return v
  return `https://${v}`
}

export function EditorToolbar({ editor, urlMode, onUrlModeChange }: ToolbarProps) {
  // TipTap v3 doesn't re-render on every transaction; subscribe to just what the buttons show
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      highlight: e.isActive("highlight"),
      code: e.isActive("code"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      codeBlock: e.isActive("codeBlock"),
      link: e.isActive("link"),
      href: (e.getAttributes("link").href as string | undefined) ?? "",
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  })

  const mod = isMac() ? "⌘" : "Ctrl+"
  const c = () => editor.chain().focus()

  const groups: ToolbarBtn[][] = [
    [
      { icon: Undo2, label: "Undo", shortcut: `${mod}Z`, action: () => c().undo().run(), disabled: !s.canUndo },
      { icon: Redo2, label: "Redo", shortcut: `${mod}Shift+Z`, action: () => c().redo().run(), disabled: !s.canRedo },
    ],
    [
      { icon: Bold, label: "Bold", shortcut: `${mod}B`, action: () => c().toggleBold().run(), active: s.bold },
      { icon: Italic, label: "Italic", shortcut: `${mod}I`, action: () => c().toggleItalic().run(), active: s.italic },
      { icon: Underline, label: "Underline", shortcut: `${mod}U`, action: () => c().toggleUnderline().run(), active: s.underline },
      { icon: Strikethrough, label: "Strikethrough", action: () => c().toggleStrike().run(), active: s.strike },
      { icon: Highlighter, label: "Highlight", action: () => c().toggleHighlight().run(), active: s.highlight },
      { icon: Code, label: "Inline code", action: () => c().toggleCode().run(), active: s.code },
    ],
    [
      { icon: Heading2, label: "Heading", action: () => c().toggleHeading({ level: 2 }).run(), active: s.h2 },
      { icon: Heading3, label: "Subheading", action: () => c().toggleHeading({ level: 3 }).run(), active: s.h3 },
      { icon: List, label: "Bullet list", action: () => c().toggleBulletList().run(), active: s.bullet },
      { icon: ListOrdered, label: "Numbered list", action: () => c().toggleOrderedList().run(), active: s.ordered },
      { icon: Quote, label: "Quote", action: () => c().toggleBlockquote().run(), active: s.quote },
      { icon: SquareCode, label: "Code block", action: () => c().toggleCodeBlock().run(), active: s.codeBlock },
    ],
    [
      { icon: Link2, label: s.link ? "Edit link" : "Add link", shortcut: `${mod}K`, action: () => onUrlModeChange(urlMode === "link" ? null : "link"), active: s.link || urlMode === "link" },
      { icon: ImagePlus, label: "Insert image", action: () => onUrlModeChange(urlMode === "image" ? null : "image"), active: urlMode === "image" },
    ],
  ]

  // Ctrl/Cmd+K opens the link field while typing in the body
  useEffect(() => {
    const dom = editor.view.dom
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        e.stopPropagation()
        onUrlModeChange("link")
      }
    }
    dom.addEventListener("keydown", onKey)
    return () => dom.removeEventListener("keydown", onKey)
  }, [editor, onUrlModeChange])

  return (
    <div className="sticky top-[4.25rem] z-20 mb-10">
      <div
        role="toolbar"
        aria-label="Formatting"
        className="flex items-center gap-0.5 p-1 rounded-full border border-[var(--border)] bg-[var(--panel)]/90 backdrop-blur-md shadow-[var(--shadow)] overflow-x-auto scrollbar-none w-max max-w-full mx-auto"
      >
        {groups.map((group, gi) => (
          <div key={gi} className="flex items-center gap-0.5 shrink-0">
            {gi > 0 && <span aria-hidden className="w-px h-5 bg-[var(--border)] mx-1" />}
            {group.map((btn) => {
              const Icon = btn.icon
              return (
                <button
                  key={btn.label}
                  type="button"
                  onMouseDown={(e) => e.preventDefault() /* keep the text selection */}
                  onClick={btn.action}
                  disabled={btn.disabled}
                  title={btn.shortcut ? `${btn.label} (${btn.shortcut})` : btn.label}
                  aria-label={btn.label}
                  aria-pressed={btn.active ?? undefined}
                  className={cn(
                    "grid place-items-center w-10 h-10 rounded-full transition-colors disabled:opacity-35 disabled:pointer-events-none",
                    btn.active
                      ? "bg-[var(--fg)] text-[var(--bg)]"
                      : "text-[var(--fg-muted)] hover:bg-[var(--surface)] hover:text-[var(--fg)]"
                  )}
                >
                  <Icon className="w-4 h-4" />
                </button>
              )
            })}
          </div>
        ))}
      </div>

      <AnimatePresence>
        {urlMode && (
          <UrlField
            key={urlMode}
            mode={urlMode}
            initial={urlMode === "link" ? s.href : ""}
            hasLink={s.link}
            onClose={() => {
              onUrlModeChange(null)
              editor.commands.focus()
            }}
            onSubmit={(raw) => {
              const url = normalizeUrl(raw)
              if (urlMode === "link") {
                if (!url) c().extendMarkRange("link").unsetLink().run()
                else if (editor.state.selection.empty && !s.link) {
                  c().insertContent({ type: "text", text: raw.trim(), marks: [{ type: "link", attrs: { href: url } }] }).run()
                } else c().extendMarkRange("link").setLink({ href: url }).run()
              } else if (url) {
                // Insert after the selection rather than replacing selected text
                c().setTextSelection(editor.state.selection.to).setImage({ src: url, alt: "" }).run()
              }
              onUrlModeChange(null)
            }}
            onRemove={() => {
              c().extendMarkRange("link").unsetLink().run()
              onUrlModeChange(null)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function UrlField({
  mode,
  initial,
  hasLink,
  onClose,
  onSubmit,
  onRemove,
}: {
  mode: "link" | "image"
  initial: string
  hasLink: boolean
  onClose: () => void
  onSubmit: (url: string) => void
  onRemove: () => void
}) {
  const [value, setValue] = useState(initial)
  const [error, setError] = useState("")
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const v = value.trim()
    if (mode === "image") {
      if (!/^(https?:\/\/)?[^\s/$.?#].[^\s]*$/i.test(v)) return setError("Paste a full image address, like https://…/photo.jpg")
    }
    onSubmit(v)
  }

  const id = `editor-url-${mode}`
  return (
    <motion.form
      onSubmit={submit}
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: dur.base, ease: ease.out } }}
      exit={{ opacity: 0, y: -4, transition: { duration: dur.fast, ease: ease.in } }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation()
          onClose()
        }
      }}
      className="absolute inset-x-0 mx-auto top-full mt-2 w-[min(100%,30rem)] panel shadow-[var(--shadow-lift)] p-3"
    >
      <label htmlFor={id} className="meta block px-1 mb-2">
        {mode === "link" ? "Link address" : "Image address"}
      </label>
      <div className="flex items-center gap-2">
        <input
          ref={ref}
          id={id}
          type="text"
          inputMode="url"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError("")
          }}
          placeholder={mode === "link" ? "https://example.com" : "https://images.unsplash.com/…"}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
          className="flex-1 min-w-0 h-11 px-4 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-sm focus:border-[var(--fg)] outline-none"
        />
        {mode === "link" && hasLink && (
          <button type="button" onClick={onRemove} aria-label="Remove link" title="Remove link"
            className="grid place-items-center w-10 h-10 rounded-full text-[var(--fg-muted)] hover:text-[var(--error)] hover:bg-[var(--surface)] transition-colors">
            <Unlink className="w-4 h-4" />
          </button>
        )}
        <button type="button" onClick={onClose} aria-label="Cancel"
          className="grid place-items-center w-10 h-10 rounded-full text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)] transition-colors">
          <X className="w-4 h-4" />
        </button>
        <button type="submit" aria-label={mode === "link" ? "Apply link" : "Insert image"}
          className="grid place-items-center w-10 h-10 rounded-full bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--fg-secondary)] transition-colors">
          <Check className="w-4 h-4" />
        </button>
      </div>
      {error && (
        <p id={`${id}-err`} className="mt-2 px-1 text-xs text-[var(--error)]">{error}</p>
      )}
    </motion.form>
  )
}
