"use client"

import { useCallback, useMemo, useRef } from "react"
import type { Editor } from "@tiptap/react"
import { BREAK_MS, downsample, emptyCraft, SESSION_GAP_MS, type CraftTelemetry } from "@/lib/craft"

const SAMPLE_EVERY_MS = 90_000
const BIG_JUMP_WORDS = 120

/**
 * Records how a story is written: active time, sittings, typed vs pasted characters and how the
 * word count grows. Counts only — the text typed or pasted is never kept.
 */
export function useCraftTracker(initial?: CraftTelemetry) {
  const data = useRef<CraftTelemetry>(initial ? { ...initial, growth: [...initial.growth] } : emptyCraft())

  /** Any edit (body, title, subtitle, settings) counts as writing time */
  const noteActivity = useCallback(() => {
    const now = Date.now()
    const t = data.current
    const gap = t.lastAt ? now - t.lastAt : Infinity
    // Within a sitting the time between edits counts; after a break, only a nominal few seconds
    t.activeMs += gap < BREAK_MS ? gap : 4000
    // Coming back after 30+ minutes (including reopening the draft later) starts a new sitting
    if (t.lastAt && gap > SESSION_GAP_MS) t.sessions += 1
    t.lastAt = now
  }, [])

  /** Body changed: sample the word count over active time */
  const noteWords = useCallback((words: number) => {
    const t = data.current
    const last = t.growth[t.growth.length - 1]
    if (!last || t.activeMs - last.ms >= SAMPLE_EVERY_MS || Math.abs(words - last.words) >= BIG_JUMP_WORDS) {
      t.growth = downsample([...t.growth, { ms: t.activeMs, words }])
    } else {
      // Keep the latest count on the newest point so the final length is always accurate
      t.growth[t.growth.length - 1] = { ms: t.activeMs, words }
    }
  }, [])

  /** Listen to the editor's DOM for typing and pasting. Returns a cleanup. */
  const attach = useCallback((editor: Editor) => {
    const dom = editor.view.dom
    const onBeforeInput = (e: Event) => {
      const ev = e as InputEvent
      if (ev.inputType === "insertText" || ev.inputType === "insertReplacementText" || ev.inputType === "insertCompositionText") {
        data.current.typedChars += ev.data?.length ?? 0
      } else if (ev.inputType === "insertParagraph" || ev.inputType === "insertLineBreak") {
        data.current.typedChars += 1
      }
    }
    const onPaste = (e: ClipboardEvent) => {
      data.current.pastedChars += e.clipboardData?.getData("text/plain").length ?? 0
    }
    dom.addEventListener("beforeinput", onBeforeInput)
    dom.addEventListener("paste", onPaste)
    return () => {
      dom.removeEventListener("beforeinput", onBeforeInput)
      dom.removeEventListener("paste", onPaste)
    }
  }, [])

  /** A copy safe to store */
  const snapshot = useCallback((): CraftTelemetry => ({ ...data.current, growth: [...data.current.growth] }), [])

  // Stable identity so callers can list it as a dependency
  return useMemo(() => ({ noteActivity, noteWords, attach, snapshot }), [noteActivity, noteWords, attach, snapshot])
}
