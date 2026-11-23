"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Editor } from "@tiptap/react"
import { AnimatePresence, motion } from "motion/react"
import { Square } from "lucide-react"
import { toast } from "@/lib/store"
import { dur, ease } from "@/lib/motion"

// "Speak to write": live dictation into the story body with the browser's speech recognition.
// Finalized phrases go in at the caret with tidy spacing and capitals; a few spoken commands become
// punctuation and line breaks. Dictated text counts as the author's own composition in Proof of Craft.

export const DICTATION_LANGS = [
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "en-IN", label: "English (India)" },
  { code: "hi-IN", label: "Hindi" },
] as const
export type DictationLang = (typeof DICTATION_LANGS)[number]["code"]
const LANG_KEY = "prism.dictate.lang"

/* Minimal typing for the Web Speech API (not in TypeScript's DOM lib everywhere) */
interface RecognitionAlternative {
  transcript: string
}
interface RecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  [index: number]: RecognitionAlternative
}
interface RecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: { readonly length: number; [index: number]: RecognitionResult }
}
interface RecognitionErrorEvent extends Event {
  readonly error: string
}
interface Recognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: RecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type RecognitionCtor = new () => Recognition

const recognitionCtor = (): RecognitionCtor | null => {
  if (typeof window === "undefined") return null
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/* ── Turning a transcript into edits ───────────────────────────────────────── */

type Piece = { kind: "text"; text: string } | { kind: "punct"; text: string } | { kind: "paragraph" } | { kind: "line" }

const COMMANDS: { re: RegExp; piece: Piece }[] = [
  { re: /\bnew paragraph\b/i, piece: { kind: "paragraph" } },
  { re: /\b(?:next|new) line\b/i, piece: { kind: "line" } },
  { re: /\bfull stop\b/i, piece: { kind: "punct", text: "." } },
  { re: /\bquestion mark\b/i, piece: { kind: "punct", text: "?" } },
  { re: /\bexclamation (?:mark|point)\b/i, piece: { kind: "punct", text: "!" } },
  { re: /\bcomma\b/i, piece: { kind: "punct", text: "," } },
]
const ANY_COMMAND = new RegExp(COMMANDS.map((c) => c.re.source).join("|"), "gi")

/** "hello comma world new paragraph" → text "hello", punct ",", text "world", paragraph */
export function parseDictation(transcript: string): Piece[] {
  const out: Piece[] = []
  let last = 0
  for (const m of transcript.matchAll(ANY_COMMAND)) {
    const before = transcript.slice(last, m.index).trim()
    if (before) out.push({ kind: "text", text: before })
    out.push(COMMANDS.find((c) => c.re.test(m[0]))!.piece)
    last = m.index! + m[0].length
  }
  const rest = transcript.slice(last).trim()
  if (rest) out.push({ kind: "text", text: rest })
  return out
}

/** Writes the pieces at the caret. Returns how many characters went in. */
function insertPieces(editor: Editor, pieces: Piece[], lang: string): number {
  let chars = 0
  for (const piece of pieces) {
    const { state } = editor
    const { from, $from } = state.selection
    // What's just before the caret inside this block decides spacing and capitals
    const before = state.doc.textBetween($from.start(), from, "\n", " ")
    if (piece.kind === "paragraph") {
      editor.chain().splitBlock().run()
      chars += 1
    } else if (piece.kind === "line") {
      editor.chain().setHardBreak().run()
      chars += 1
    } else if (piece.kind === "punct") {
      // Hug the previous word: drop a trailing space if there is one
      if (/ $/.test(before)) editor.chain().deleteRange({ from: from - 1, to: from }).run()
      editor.chain().insertContent({ type: "text", text: piece.text }).run()
      chars += piece.text.length
    } else {
      let text = piece.text.replace(/\s+/g, " ")
      if (lang.startsWith("en")) text = text.replace(/\bi\b/g, "I")
      const atSentenceStart = /^\s*$/.test(before) || /[.?!।]["'”’)]?\s*$/.test(before)
      if (atSentenceStart) text = text.charAt(0).toLocaleUpperCase(lang) + text.slice(1)
      const needsSpace = before.length > 0 && !/\s$/.test(before) && !/^[,.;:?!)]/.test(text)
      if (needsSpace) text = " " + text
      editor.chain().insertContent({ type: "text", text }).run()
      chars += text.length
    }
  }
  return chars
}

/* ── The hook ──────────────────────────────────────────────────────────────── */

export interface Dictation {
  supported: boolean
  listening: boolean
  interim: string
  lang: DictationLang
  setLang: (lang: DictationLang) => void
  toggle: () => void
  stop: () => void
}

export function useDictation(editor: Editor | null, onDictated?: (chars: number) => void): Dictation {
  const [supported, setSupported] = useState(true)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState("")
  const [lang, setLangState] = useState<DictationLang>("en-US")
  const recRef = useRef<Recognition | null>(null)
  const wantRef = useRef(false) // the writer wants it on; Chrome ends sessions on its own and we restart
  const langRef = useRef(lang)
  const onDictatedRef = useRef(onDictated)
  onDictatedRef.current = onDictated
  const editorRef = useRef(editor)
  editorRef.current = editor

  useEffect(() => {
    setSupported(!!recognitionCtor())
    try {
      const saved = localStorage.getItem(LANG_KEY)
      if (DICTATION_LANGS.some((l) => l.code === saved)) {
        langRef.current = saved as DictationLang
        setLangState(saved as DictationLang)
      }
    } catch {}
  }, [])

  const halt = useCallback(() => {
    wantRef.current = false
    const rec = recRef.current
    recRef.current = null
    if (rec) {
      rec.onend = null
      rec.onresult = null
      rec.onerror = null
      try {
        rec.stop()
      } catch {}
    }
    setListening(false)
    setInterim("")
  }, [])

  const begin = useCallback(() => {
    const Ctor = recognitionCtor()
    const ed = editorRef.current
    if (!Ctor || !ed) return
    const rec = new Ctor()
    rec.lang = langRef.current
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (e) => {
      let pending = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        const text = r[0]?.transcript ?? ""
        if (r.isFinal) {
          const editorNow = editorRef.current
          if (editorNow && text.trim()) {
            const chars = insertPieces(editorNow, parseDictation(text), langRef.current)
            onDictatedRef.current?.(chars)
          }
        } else pending += text
      }
      setInterim(pending.trim())
    }
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return // onend restarts
      const msg =
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "Microphone access is blocked. Allow it in your browser's site settings to dictate."
          : e.error === "audio-capture"
            ? "No microphone found. Plug one in to dictate."
            : e.error === "network"
              ? "Dictation needs an internet connection in this browser."
              : e.error === "language-not-supported"
                ? "This browser can't dictate in that language. Pick another one."
                : "Dictation stopped unexpectedly. Try again."
      toast(msg, { tone: "error" })
      halt()
    }
    rec.onend = () => {
      if (!wantRef.current || recRef.current !== rec) return
      try {
        rec.start()
      } catch {
        halt()
      }
    }
    recRef.current = rec
    try {
      rec.start()
      setListening(true)
    } catch {
      toast("Couldn't start dictation. Try again.", { tone: "error" })
      halt()
    }
  }, [halt])

  const start = useCallback(() => {
    if (!recognitionCtor()) {
      toast("Dictation isn't available in this browser. Try Chrome, Edge or Safari.", { tone: "error" })
      return
    }
    const ed = editorRef.current
    if (!ed) return
    // Write at the caret if the writer was in the body; otherwise continue from the end
    if (!ed.isFocused) ed.commands.focus("end")
    wantRef.current = true
    begin()
  }, [begin])

  const setLang = useCallback(
    (next: DictationLang) => {
      langRef.current = next
      setLangState(next)
      try {
        localStorage.setItem(LANG_KEY, next)
      } catch {}
      if (wantRef.current) {
        halt()
        wantRef.current = true
        begin()
      }
    },
    [begin, halt]
  )

  const toggle = useCallback(() => (wantRef.current ? halt() : start()), [halt, start])

  // Stop listening when the editor goes away
  useEffect(() => halt, [halt])

  return { supported, listening, interim, lang, setLang, toggle, stop: halt }
}

/* ── The live indicator ────────────────────────────────────────────────────── */

export function DictationPill({ dictation }: { dictation: Dictation }) {
  const { listening, interim, lang, stop } = dictation
  const label = DICTATION_LANGS.find((l) => l.code === lang)?.label ?? lang
  return (
    <AnimatePresence>
      {listening && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 16, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%", transition: { duration: dur.base, ease: ease.out } }}
          exit={{ opacity: 0, y: 16, x: "-50%", transition: { duration: dur.fast, ease: ease.in } }}
          className="fixed z-[45] left-1/2 bottom-[4.25rem] sm:bottom-4 w-[min(calc(100vw-2rem),36rem)] flex items-center gap-3 h-12 pl-4 pr-1.5 rounded-full bg-[#141413] text-[#FAF8F5] border border-white/10 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.55)]"
        >
          <span aria-hidden className="relative flex w-2.5 h-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60 animate-ping" />
            <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-red-500" />
          </span>
          <span className="min-w-0 flex-1 text-sm truncate">
            {interim ? (
              <span className="text-stone-400 italic">{interim.length > 90 ? "…" + interim.slice(-90) : interim}</span>
            ) : (
              <span className="text-stone-300">
                Listening · <span className="text-stone-400">{label}</span>
              </span>
            )}
          </span>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault() /* keep the caret where it is */}
            onClick={stop}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 shrink-0 rounded-full text-sm font-medium bg-[#FAF8F5] text-[#141413] hover:bg-white transition-colors"
          >
            <Square className="w-3 h-3" fill="currentColor" />
            <span className="hidden sm:inline">Stop dictating</span>
            <span className="sm:hidden">Stop</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
