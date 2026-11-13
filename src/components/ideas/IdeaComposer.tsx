"use client"

import { useState } from "react"
import { Timer } from "lucide-react"
import { DialogShell } from "@/components/posts/DialogShell"
import { chipSurface, isDarkCanvas } from "@/components/ideas/IdeaParts"
import type { NewIdea } from "@/components/ideas/useInstantIdeas"
import { CORAL, DEFAULT_DURATION, DURATIONS, FORMATS, IDEA_MAX, THEMES, type IdeaFormat, type IdeaTheme } from "@/lib/ideas"
import { cn } from "@/lib/utils"

const segment = "flex p-0.5 rounded-full bg-[var(--surface)] border border-[var(--border)]"
const segmentBtn = (active: boolean) =>
  cn(
    "flex-1 h-8 px-3 rounded-full text-[13px] font-medium transition-colors whitespace-nowrap",
    active ? "bg-[var(--panel)] text-[var(--fg)] shadow-xs" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
  )

// Fast, distraction-free: type straight onto the canvas, pick a look and a lifetime, drop it.
export function IdeaComposer({ open, onClose, onPost }: { open: boolean; onClose: () => void; onPost: (idea: NewIdea) => void }) {
  const [text, setText] = useState("")
  const [format, setFormat] = useState<IdeaFormat>("thought")
  const [theme, setTheme] = useState<IdeaTheme>("paper")
  const [durationMs, setDurationMs] = useState<number>(DEFAULT_DURATION)

  const left = IDEA_MAX - text.length
  const canPost = text.trim().length > 0 && left >= 0
  const t = THEMES[theme]

  const submit = () => {
    if (!canPost) return
    onPost({ text, format, theme, durationMs })
    setText("")
  }

  return (
    <DialogShell open={open} onClose={onClose} label="Drop an Idea" className="max-w-[520px] p-5 sm:p-6">
      <h2 className="font-display font-semibold text-xl tracking-tight pr-10">Drop an Idea</h2>
      <p className="mt-1 text-sm text-[var(--fg-muted)]">A raw thought, a line worth keeping, a snippet. It deletes itself.</p>

      {/* The canvas is the editor */}
      <div className={cn("relative mt-5 rounded-[20px] p-5 pb-9 min-h-[200px] shadow-[var(--shadow)] ring-1 ring-inset", isDarkCanvas(theme) ? "ring-white/10" : "ring-black/[0.08]", t.canvas)}>
        <label htmlFor="idea-text" className="sr-only">
          Your idea
        </label>
        <textarea
          id="idea-text"
          data-autofocus
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, IDEA_MAX + 20))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              submit()
            }
          }}
          rows={5}
          placeholder={format === "code" ? "// paste a snippet" : format === "quote" ? "A line worth keeping…" : "What's sparking right now?"}
          spellCheck={format !== "code"}
          className={cn(
            "w-full resize-none bg-transparent outline-none focus-visible:outline-none placeholder:opacity-45",
            t.ink,
            format === "code"
              ? "font-mono text-[14px] leading-relaxed"
              : format === "quote"
                ? "font-serif italic text-[1.375rem] leading-snug"
                : "font-display text-[1.25rem] font-semibold leading-snug tracking-[-0.015em]"
          )}
        />
        <span
          aria-live="polite"
          style={left < 20 ? { color: CORAL } : undefined}
          className={cn("absolute bottom-3 right-4 text-xs font-medium tabular-nums", left >= 20 && t.muted)}
        >
          {left}
        </span>
        <span className={cn("absolute bottom-3 left-4 inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] font-medium", chipSurface(theme), t.ink)}>
          <Timer className="w-3 h-3" />
          {DURATIONS.find((d) => d.ms === durationMs)?.short} left
        </span>
      </div>

      <div className="mt-5 space-y-4">
        <div role="radiogroup" aria-label="Format" className={segment}>
          {FORMATS.map((f) => (
            <button key={f.value} type="button" role="radio" aria-checked={format === f.value} onClick={() => setFormat(f.value)} className={segmentBtn(format === f.value)}>
              {f.label}
            </button>
          ))}
        </div>

        <fieldset>
          <legend className="text-xs font-medium text-[var(--fg-secondary)] mb-2">Canvas</legend>
          <div role="radiogroup" className="grid grid-cols-4 gap-2">
            {(Object.keys(THEMES) as IdeaTheme[]).map((key) => {
              const active = theme === key
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setTheme(key)}
                  className="group flex flex-col items-center gap-1.5"
                >
                  <span
                    className={cn(
                      "w-full h-11 rounded-[12px] border transition-shadow",
                      THEMES[key].canvas,
                      isDarkCanvas(key) ? "border-white/10" : "border-black/10",
                      active ? "ring-2 ring-[var(--fg)] ring-offset-2 ring-offset-[var(--panel)]" : "group-hover:ring-1 group-hover:ring-[var(--border-strong)]"
                    )}
                  />
                  <span className={cn("text-[11.5px] leading-tight text-center", active ? "text-[var(--fg)] font-medium" : "text-[var(--fg-muted)]")}>
                    {THEMES[key].label}
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-xs font-medium text-[var(--fg-secondary)] mb-2">Self-destructs after</legend>
          <div role="radiogroup" className={segment}>
            {DURATIONS.map((d) => (
              <button key={d.ms} type="button" role="radio" aria-checked={durationMs === d.ms} onClick={() => setDurationMs(d.ms)} className={segmentBtn(durationMs === d.ms)}>
                {d.label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="hidden sm:block text-xs text-[var(--fg-subtle)]">
          <kbd className="font-mono">Ctrl</kbd> + <kbd className="font-mono">Enter</kbd> to drop
        </p>
        <div className="flex gap-2 ml-auto">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-full text-sm font-medium text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)] transition-colors">
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canPost}
            className="h-10 px-5 rounded-full bg-[var(--nav-cta)] hover:bg-[var(--nav-cta-hover)] text-[var(--nav-cta-fg)] text-sm font-medium shadow-xs disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            Drop idea
          </button>
        </div>
      </div>
    </DialogShell>
  )
}
