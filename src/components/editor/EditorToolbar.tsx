"use client"

import { toast } from "@/lib/store"
import { useEffect, useRef, useState } from "react"
import { type Editor, useEditorState } from "@tiptap/react"
import { AnimatePresence, motion } from "motion/react"
import {
  Bold, Italic, Underline, Link2, Heading2, Heading3, List, ListOrdered, Quote,
  SquareCode, Code, Highlighter, Undo2, Redo2, Strikethrough, ImagePlus, Check, X, Unlink, Mic,
} from "lucide-react"
import { dur, ease } from "@/lib/motion"
import { cn } from "@/lib/utils"
import { InlineImageUpload } from "./CoverImageField"
import { DICTATION_LANGS, type Dictation, type DictationLang } from "./Dictation"

export type UrlMode = "link" | "image" | null

interface ToolbarProps {
  editor: Editor
  urlMode: UrlMode
  onUrlModeChange: (mode: UrlMode) => void
  dictation?: Dictation
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

export function EditorToolbar({ editor, urlMode, onUrlModeChange, dictation }: ToolbarProps) {
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
      {/* Speak to Write is its own pill: beside the formatting pill when there's room, on the next line when not,
          but never scrolled out of view inside it */}
      <div className="flex flex-wrap items-center justify-center gap-2">
      <div
        role="toolbar"
        aria-label="Formatting"
        className="flex items-center gap-0.5 p-1 rounded-full border border-[var(--border)] bg-[var(--panel)]/90 backdrop-blur-md shadow-[var(--shadow)] overflow-x-auto scrollbar-none min-w-0"
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
        {dictation && (
          <div
            role="group"
            aria-label="Speak to Write"
            className={cn(
              "flex items-center gap-0.5 p-1 shrink-0 rounded-full border backdrop-blur-md shadow-[var(--shadow)]",
              dictation.listening ? "border-red-500/40 bg-[var(--panel)]" : "border-[var(--elite-line)] bg-[var(--panel)]/90"
            )}
          >
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault() /* keep the caret: dictation writes there */}
              onClick={dictation.toggle}
              aria-pressed={dictation.listening}
              title={dictation.supported ? (dictation.listening ? "Stop dictating" : "Speak to Write: talk and your words appear in the article") : "Speak to Write isn't available in this browser"}
              className={cn(
                "inline-flex items-center gap-1.5 h-10 px-3 rounded-full text-sm font-medium transition-colors",
                dictation.listening
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-[var(--elite-wash)] text-[var(--elite-ink)] hover:bg-[var(--elite-glow)]",
                !dictation.supported && "opacity-50"
              )}
            >
              <Mic className="w-4 h-4" />
              <span className="whitespace-nowrap">{dictation.listening ? "Stop" : <><span className="sm:hidden">Speak</span><span className="hidden sm:inline">Speak to Write</span></>}</span>
            </button>
            <label className="relative">
              <span className="sr-only">Dictation language</span>
              <select
                value={dictation.lang}
                onChange={(e) => dictation.setLang(e.target.value as DictationLang)}
                className="w-[4.75rem] sm:w-auto h-10 pl-2 pr-1 rounded-full bg-transparent text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)] outline-none cursor-pointer [&>option]:bg-[var(--panel)] [&>option]:text-[var(--fg)]"
              >
                {DICTATION_LANGS.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
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
                // Readers only see images hosted in Prism's storage (no third-party tracking pixels):
                // anything else would be stripped from the published story, so refuse it here
                if (!/^https:\/\/(firebasestorage|storage)\.googleapis\.com\//.test(url)) {
                  toast("Upload the image instead: images from other sites aren't shown to readers.", { tone: "error" })
                  return
                }
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
      {mode === "image" && <InlineImageUpload onUploaded={onSubmit} />}
    </motion.form>
  )
}
