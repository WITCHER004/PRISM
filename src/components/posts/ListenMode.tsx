"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useDragControls } from "motion/react"
import SpeakingOrb, { type SpeakingOrbHandle } from "@/components/ui/speaking-orb"
import { Headphones, Pause, Play, SkipBack, SkipForward, X, RotateCcw, Mic, ChevronUp, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUIStore } from "@/lib/store"
import { curateVoices, type VoiceOption } from "@/lib/voices"
import { useIsDesktop } from "@/lib/useIsDesktop"
import { useAudiobook } from "./AudiobookPlayer"

interface ListenModeProps {
  title: string
  minutes: number
  /** Where the rendered story lives; each block in it becomes one or more parts */
  bodySelector?: string
}

interface Part {
  text: string
  /** The article block this part comes from (the title has none) */
  el: HTMLElement | null
}

const BLOCKS = "p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, figcaption, td, th"
const MAX_CHARS = 220 // Chrome stops speaking an utterance after ~15s, so keep each one short
const RATES = [0.85, 1, 1.25, 1.5, 1.75]
const VOICE_KEY = "prism.listen.voice"
const RATE_KEY = "prism.listen.rate"
const TICK_MS = 40

const hasWords = (s: string) => s.replace(/[^\p{L}\p{N}]/gu, "").length > 0

// Strip leftover markdown / markup symbols and collapse all whitespace (blank lines included)
const clean = (s: string) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#~|>]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()

// Break text at sentence ends (then commas, then words) so no piece exceeds MAX_CHARS
function splitText(text: string): string[] {
  if (text.length <= MAX_CHARS) return [text]
  const out: string[] = []
  let cur = ""
  const push = (piece: string) => {
    if (cur && (cur + piece).length > MAX_CHARS) {
      out.push(cur.trim())
      cur = ""
    }
    cur += piece
  }
  for (const sentence of text.match(/[^.!?]+[.!?]+["'”’)\]]*\s*|[^.!?]+$/g) ?? [text]) {
    if (sentence.length <= MAX_CHARS) {
      push(sentence)
      continue
    }
    for (const clause of sentence.match(/[^,;:]+[,;:]\s*|[^,;:]+$/g) ?? [sentence]) {
      if (clause.length <= MAX_CHARS) push(clause)
      else for (const word of clause.split(/(?<=\s)/)) push(word)
    }
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

function buildParts(title: string, bodySelector: string): Part[] {
  const parts: Part[] = []
  const add = (raw: string, el: HTMLElement | null) => {
    for (const piece of splitText(clean(raw))) if (hasWords(piece)) parts.push({ text: piece, el })
  }
  add(title, null)
  const root = document.querySelector(bodySelector)
  if (!root) return parts
  for (const el of root.querySelectorAll<HTMLElement>(BLOCKS)) {
    if (el.querySelector(BLOCKS)) continue // a wrapper: its inner blocks are read instead
    if (!el.getClientRects().length) continue // hidden
    add(el.textContent ?? "", el)
  }
  return parts
}

const readStore = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
const writeStore = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {}
}
const rateLabel = (r: number) => `${Number.isInteger(r) ? r.toFixed(1) : r}x`

// Caption phrases: up to 7 words, ending early at a sentence end, with their character ranges
function phrasesOf(text: string): { start: number; end: number; text: string }[] {
  const out: { start: number; end: number; text: string }[] = []
  let words: RegExpExecArray[] = []
  const flush = () => {
    if (!words.length) return
    const start = words[0].index
    const last = words[words.length - 1]
    const end = last.index + last[0].length
    out.push({ start, end, text: text.slice(start, end) })
    words = []
  }
  for (const m of text.matchAll(/\S+/g)) {
    words.push(m as RegExpExecArray)
    if (words.length >= 7 || /[.!?]["'”’)\]]*$/.test(m[0])) flush()
  }
  flush()
  return out
}

// Reads a story aloud with the browser voice; the orb pulses with the speech and captions each word
export function ListenMode({ title, minutes, bodySelector = "#article-body .prose-prism" }: ListenModeProps) {
  const orbRef = useRef<SpeakingOrbHandle | null>(null)
  const playBtnRef = useRef<HTMLButtonElement>(null)
  const playingRef = useRef(false)
  const indexRef = useRef(0)
  const partsRef = useRef<Part[]>([])
  const autoStart = useRef(false)
  // Held here so the browser can't garbage-collect it before onend fires
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const timersRef = useRef<number[]>([])
  const highlightRef = useRef<HTMLElement | null>(null)
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null)
  const rateRef = useRef(1)
  const captionRef = useRef<string | null>(null)
  const dragControls = useDragControls()

  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [index, setIndex] = useState(0)
  const [count, setCount] = useState(0)
  const [finished, setFinished] = useState(false)
  const [canSpeak, setCanSpeak] = useState(true)
  const [voices, setVoices] = useState<VoiceOption[]>([])
  const [voiceUri, setVoiceUri] = useState("")
  const [rate, setRate] = useState(1)
  const [caption, setCaptionState] = useState<string | null>(null)
  const ttsEnabled = useUIStore((s) => s.ttsEnabled)
  // The author's own narration (a separate player): only one voice plays at a time
  const audiobook = useAudiobook()
  const isDesktop = useIsDesktop()
  const mobile = !isDesktop

  const setCaption = (c: string | null) => {
    if (captionRef.current === c) return
    captionRef.current = c
    setCaptionState(c)
  }

  // Restore saved speed; load voices (Chrome fills the list asynchronously)
  useEffect(() => {
    const supported = typeof window !== "undefined" && "speechSynthesis" in window
    setCanSpeak(supported)
    const saved = Number(readStore(RATE_KEY))
    if (RATES.includes(saved)) {
      rateRef.current = saved
      setRate(saved)
    }
    if (!supported) return
    const synth = window.speechSynthesis
    const load = () => {
      const list = curateVoices(synth.getVoices())
      if (!list.length) return
      setVoices(list)
      const want = voiceRef.current?.voiceURI ?? readStore(VOICE_KEY)
      const pick = list.find((v) => v.uri === want) ?? list[0]
      voiceRef.current = pick.voice
      setVoiceUri(pick.uri)
    }
    load()
    synth.addEventListener("voiceschanged", load)
    return () => synth.removeEventListener("voiceschanged", load)
  }, [])

  // Switching between mini-bar, sheet and card mounts a fresh orb; point it at the line being spoken
  // (React 19 ref cleanup: an outgoing orb only clears the ref if it still owns it)
  const attachOrb = useCallback((handle: SpeakingOrbHandle | null) => {
    if (!handle) return
    orbRef.current = handle
    const u = activeUtteranceRef.current
    if (u && playingRef.current) {
      // the engine starts in an effect, after this ref is set
      requestAnimationFrame(() => {
        if (orbRef.current === handle && activeUtteranceRef.current === u) handle.say(u.text, { utterance: u })
      })
    }
    return () => {
      if (orbRef.current === handle) orbRef.current = null
    }
  }, [])

  const clearTimers = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t))
    timersRef.current = []
  }
  const later = (fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms))
  }

  const highlight = useCallback((el: HTMLElement | null) => {
    if (highlightRef.current === el) return
    highlightRef.current?.removeAttribute("data-listening")
    highlightRef.current = el
    if (!el) return
    el.setAttribute("data-listening", "")
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    el.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "center" })
  }, [])

  const showPart = useCallback(
    (i: number) => {
      indexRef.current = i
      setIndex(i)
      setFinished(false)
      setCaption(null)
      highlight(partsRef.current[i]?.el ?? null)
    },
    [highlight]
  )

  const stopSpeech = () => {
    clearTimers()
    activeUtteranceRef.current = null // anything the cancel fires on the old utterance is now ignored
    if ("speechSynthesis" in window) window.speechSynthesis.cancel()
  }

  const finish = useCallback(() => {
    playingRef.current = false
    setPlaying(false)
    setFinished(true)
    setCaption(null)
    highlight(null)
  }, [highlight])

  // speakPart and advance call each other, so they go through a ref
  const speakRef = useRef<(i: number) => void>(() => {})

  const advance = useCallback(() => {
    if (!playingRef.current) return
    const next = indexRef.current + 1
    if (next < partsRef.current.length) speakRef.current(next)
    else finish()
  }, [finish])

  const speakPart = useCallback(
    (i: number) => {
      const part = partsRef.current[i]
      if (!part) return finish()
      showPart(i)
      stopSpeech()

      // No voice in this browser: captions only, the orb's own timing moves us on
      if (!("speechSynthesis" in window)) {
        orbRef.current?.say(part.text)
        return
      }

      // Give the engine a beat after cancel(); speaking straight away can be silently dropped
      later(() => {
        if (!playingRef.current) return
        const synth = window.speechSynthesis
        const u = new SpeechSynthesisUtterance(part.text)
        if (voiceRef.current) {
          u.voice = voiceRef.current
          u.lang = voiceRef.current.lang
        }
        u.rate = rateRef.current
        activeUtteranceRef.current = u

        let settled = false
        const done = () => {
          if (settled || activeUtteranceRef.current !== u) return
          settled = true
          activeUtteranceRef.current = null
          clearTimers()
          advance()
        }
        u.onend = done
        u.onerror = (e) => {
          if (e.error === "interrupted" || e.error === "canceled") return
          done()
        }

        // Live caption for the mobile player: the phrase holding the word being spoken
        const phrases = phrasesOf(part.text)
        u.addEventListener("boundary", (e) => {
          if (activeUtteranceRef.current !== u || (e.name && e.name !== "word")) return
          const p = phrases.find((ph) => e.charIndex < ph.end) ?? phrases[phrases.length - 1]
          if (p) setCaption(p.text)
        })

        orbRef.current?.say(part.text, { utterance: u })
        synth.speak(u)

        // Watchdog: if onend never arrives (dropped event, stalled engine), move on anyway.
        // The hard cap is generous: ~2.5 words/sec at this rate, doubled, plus slack.
        const words = part.text.split(/\s+/).length
        const cap = Date.now() + (words / (2.5 * rateRef.current)) * 2000 + 8000
        const check = () => {
          if (settled || activeUtteranceRef.current !== u) return
          if ((!synth.speaking && !synth.pending) || Date.now() > cap) return done()
          later(check, 1000)
        }
        later(check, 1500)
      }, TICK_MS)
    },
    [advance, finish, showPart]
  )
  speakRef.current = speakPart

  const play = useCallback(() => {
    if (!partsRef.current.length) partsRef.current = buildParts(title, bodySelector)
    setCount(partsRef.current.length)
    playingRef.current = true
    setPlaying(true)
    speakPart(finished ? 0 : Math.min(indexRef.current, partsRef.current.length - 1))
  }, [bodySelector, finished, speakPart, title])

  const pause = useCallback(() => {
    playingRef.current = false
    setPlaying(false)
    stopSpeech()
  }, [])

  const togglePlay = () => (playing ? pause() : play())

  const skip = (delta: number) => {
    const i = Math.min(partsRef.current.length - 1, Math.max(0, indexRef.current + delta))
    if (playingRef.current) speakPart(i)
    else showPart(i)
  }

  // Captions-only mode: the orb finished a piece
  const handleOrbEnd = () => {
    if (!canSpeak) advance()
  }

  const chooseVoice = (uri: string) => {
    const pick = voices.find((v) => v.uri === uri)
    if (!pick) return
    voiceRef.current = pick.voice
    setVoiceUri(uri)
    writeStore(VOICE_KEY, uri)
    if (playingRef.current) speakPart(indexRef.current)
  }

  const cycleRate = () => {
    const next = RATES[(RATES.indexOf(rateRef.current) + 1) % RATES.length]
    rateRef.current = next
    setRate(next)
    writeStore(RATE_KEY, String(next))
    if (playingRef.current) speakPart(indexRef.current) // a running utterance's rate can't change, so restart the part
  }

  const close = useCallback(() => {
    pause()
    highlight(null)
    setExpanded(false)
    setOpen(false)
  }, [highlight, pause])

  // Start speaking once the panel (and its orb) has mounted
  useEffect(() => {
    if (open && autoStart.current) {
      autoStart.current = false
      playBtnRef.current?.focus()
      partsRef.current = [] // pick up the story as it's rendered now
      indexRef.current = 0
      play()
    }
  }, [open, play])

  // Esc minimizes the mobile sheet first, then closes the player
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (mobile && expanded) setExpanded(false)
      else close()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, close, mobile, expanded])

  // On phones the mini-bar takes the bottom of the screen: pad the story's end and move the article dock aside
  useEffect(() => {
    if (!open || !mobile) return
    document.body.setAttribute("data-audio-player", "")
    return () => document.body.removeAttribute("data-audio-player")
  }, [open, mobile])

  // Never leave the voice running after navigating away
  useEffect(
    () => () => {
      timersRef.current.forEach((t) => window.clearTimeout(t))
      activeUtteranceRef.current = null
      highlightRef.current?.removeAttribute("data-listening")
      if ("speechSynthesis" in window) window.speechSynthesis.cancel()
    },
    []
  )

  const progress = count ? ((index + (finished ? 1 : 0)) / count) * 100 : 0
  const totalMin = minutes / rate
  const leftMin = totalMin * (1 - progress / 100)
  const remaining = finished ? "Done" : leftMin < 1 ? "<1 min left" : `~${Math.ceil(leftMin)} min left`
  const status = finished ? "Finished" : playing ? "Now reading" : "Paused"
  const partLabel = `Part ${Math.min(index + 1, Math.max(count, 1))} of ${count}`
  const currentText = partsRef.current[index]?.text ?? title

  const ctrl =
    "grid place-items-center w-10 h-10 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"
  const pill =
    "inline-flex items-center gap-1.5 h-7 rounded-full border border-white/10 bg-white/[0.07] hover:bg-white/[0.12] px-3 py-1 text-xs text-stone-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
  const orbStyle = { ["--cap-font" as string]: "var(--font-geist), system-ui, sans-serif" }
  const playIcon = (size: string) =>
    playing ? (
      <Pause className={size} fill="currentColor" />
    ) : finished ? (
      <RotateCcw className={size} />
    ) : (
      <Play className={cn(size, "ml-0.5")} fill="currentColor" />
    )
  const playLabel = playing ? "Pause" : finished ? "Play again" : "Play"

  // ── Shared pieces ───────────────────────────────────────────────────────────
  const progressBar = (
    <div className="h-1 rounded-full bg-white/10 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={count} aria-valuenow={index + 1} aria-label="Story progress">
      <motion.div
        className="h-full w-full spectrum-bg origin-left"
        initial={false}
        animate={{ scaleX: progress / 100 }}
        transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}
      />
    </div>
  )

  const voiceSpeed = canSpeak && (
    <div className="flex items-center justify-between gap-2">
      <label className={cn(pill, "relative min-w-0 max-w-[70%] pr-2")}>
        <Mic className="w-3.5 h-3.5 shrink-0 text-white/60" aria-hidden />
        <span className="sr-only">Voice</span>
        <select
          value={voiceUri}
          onChange={(e) => chooseVoice(e.target.value)}
          disabled={!voices.length}
          className="min-w-0 flex-1 truncate bg-transparent text-xs text-stone-200 outline-none cursor-pointer [&>option]:bg-[#111113] [&>option]:text-stone-200"
        >
          {!voices.length && <option value="">Default voice</option>}
          {voices.map((v) => (
            <option key={v.uri} value={v.uri}>
              {v.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={cycleRate}
        className={cn(pill, "font-mono tabular-nums")}
        aria-label={`Playback speed ${rateLabel(rate)}, click to change`}
      >
        {rateLabel(rate)}
      </button>
    </div>
  )

  const transport = (
    <div className="flex items-center justify-center gap-3">
      <button onClick={() => skip(-1)} disabled={index === 0} className={ctrl} aria-label="Previous part">
        <SkipBack className="w-4 h-4" />
      </button>
      <motion.button
        ref={playBtnRef}
        whileTap={{ scale: 0.92 }}
        onClick={togglePlay}
        className="grid place-items-center w-14 h-14 rounded-full bg-white text-[#0b0b0f] hover:bg-white/90 transition-colors"
        aria-label={playLabel}
      >
        {playIcon("w-5 h-5")}
      </motion.button>
      <button onClick={() => skip(1)} disabled={index >= count - 1} className={ctrl} aria-label="Next part">
        <SkipForward className="w-4 h-4" />
      </button>
    </div>
  )

  const noVoiceNote = !canSpeak && (
    <p className="px-5 text-center text-xs text-white/50">
      This browser has no built-in voice, so you&apos;ll get captions only.
    </p>
  )

  // ── Desktop: floating card (unchanged) ──────────────────────────────────────
  const desktopCard = (
    <motion.div
      key="card"
      role="dialog"
      aria-label={`Listening to ${title}`}
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 24, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 340, damping: 30 }}
      className="fixed z-[55] right-5 bottom-5 w-[360px] overflow-hidden rounded-[24px] border border-white/10 bg-[#0b0b0f] text-white shadow-[0_30px_60px_-20px_rgba(0,0,0,0.7)]"
    >
      <div className="h-1 spectrum-bg" />
      <div className="flex items-start gap-3 px-5 pt-4">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[0.6875rem] uppercase tracking-wider text-white/50">{status}</p>
          <p className="mt-0.5 text-sm font-medium leading-snug line-clamp-1">{title}</p>
        </div>
        <button onClick={close} className={cn(ctrl, "w-8 h-8 -mr-2")} aria-label="Close listening mode">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mx-auto w-[min(100%,250px)] px-2">
        <SpeakingOrb ref={attachOrb} state={finished ? "done" : "listening"} rest="thinking" level={0.25} onEnd={handleOrbEnd} style={orbStyle} />
      </div>

      {noVoiceNote}

      <div className="px-5 pb-5 pt-3">
        {voiceSpeed && <div className="mb-3">{voiceSpeed}</div>}
        {progressBar}
        <div className="mt-1.5 flex justify-between font-mono text-[0.6875rem] text-white/45 tabular-nums">
          <span>{partLabel}</span>
          <span>~{Math.max(1, Math.round(totalMin))} min</span>
        </div>
        <div className="mt-3">{transport}</div>
      </div>
    </motion.div>
  )

  // ── Mobile: compact mini-bar ────────────────────────────────────────────────
  const miniBar = (
    <motion.div
      key="mini"
      role="region"
      aria-label={`Audio player: ${title}`}
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 32 }}
      transition={{ type: "spring", stiffness: 380, damping: 34 }}
      className="fixed left-3 right-3 z-50 rounded-2xl bg-[#111113]/95 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden text-white"
      style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="h-[2px] w-full bg-white/10">
        <motion.div
          className="h-full w-full spectrum-bg origin-left"
          initial={false}
          animate={{ scaleX: progress / 100 }}
          transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}
        />
      </div>
      <div className="px-3.5 py-2.5 flex items-center justify-between gap-3">
        {/* Tapping the info area opens the sheet; the ⌃ button is the keyboard route */}
        <div onClick={() => setExpanded(true)} className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer">
          <div className="w-9 h-9 shrink-0 rounded-full overflow-hidden" aria-hidden>
            <SpeakingOrb
              ref={attachOrb}
              state={finished ? "done" : "listening"}
              rest="thinking"
              level={0.25}
              particles={320}
              onEnd={handleOrbEnd}
              className="[&_.cap]:hidden [&_canvas.fx]:hidden"
            />
          </div>
          <span className="min-w-0">
            <span className="block text-[12.5px] font-medium text-[#FAF8F5] truncate">{caption ?? title}</span>
            <span className="block text-[11px] font-mono text-stone-400 tabular-nums truncate">
              {finished ? "Finished" : partLabel} · {rateLabel(rate)}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <motion.button
            ref={playBtnRef}
            whileTap={{ scale: 0.9 }}
            onClick={togglePlay}
            className="w-9 h-9 rounded-full bg-[#FAF8F5] text-[#111113] flex items-center justify-center"
            aria-label={playLabel}
          >
            {playIcon("w-4 h-4")}
          </motion.button>
          <button
            onClick={() => skip(1)}
            disabled={index >= count - 1}
            className="grid place-items-center w-8 h-8 rounded-full text-stone-300 hover:text-white disabled:opacity-30"
            aria-label="Next part"
          >
            <SkipForward className="w-4 h-4" fill="currentColor" />
          </button>
          <button
            onClick={() => setExpanded(true)}
            className="grid place-items-center w-8 h-8 rounded-full text-stone-300 hover:text-white"
            aria-label="Expand player"
            aria-expanded={false}
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            onClick={close}
            className="grid place-items-center w-8 h-8 rounded-full text-stone-300 hover:text-white"
            aria-label="Close listening mode"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  )

  // ── Mobile: expanded bottom sheet ───────────────────────────────────────────
  const sheet = (
    <motion.div key="sheet" className="fixed inset-0 z-50" initial="closed" animate="open" exit="closed">
      <motion.button
        type="button"
        aria-label="Minimize player"
        tabIndex={-1}
        onClick={() => setExpanded(false)}
        className="absolute inset-0 bg-black/40"
        variants={{ open: { opacity: 1 }, closed: { opacity: 0 } }}
        transition={{ duration: 0.2 }}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={`Listening to ${title}`}
        variants={{ open: { y: 0 }, closed: { y: "100%" } }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.7 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 90 || info.velocity.y > 500) setExpanded(false)
        }}
        className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-[#111113] border-t border-white/10 p-5 pb-8 shadow-2xl max-h-[82vh] overflow-y-auto text-white"
        style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="touch-none cursor-grab active:cursor-grabbing -mx-5 -mt-5 px-5 pt-3" onPointerDown={(e) => dragControls.start(e)}>
          <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" aria-hidden />
          <div className="flex items-center justify-between">
            <button
              onClick={() => setExpanded(false)}
              className="inline-flex items-center gap-1 h-9 -ml-2 px-2 rounded-full text-sm text-stone-300 hover:text-white hover:bg-white/10"
            >
              <ChevronDown className="w-4 h-4" />
              Minimize
            </button>
            <p className="font-mono text-[0.6875rem] uppercase tracking-wider text-white/50">{status}</p>
            <button
              onClick={close}
              className="inline-flex items-center gap-1 h-9 -mr-2 px-2 rounded-full text-sm text-stone-300 hover:text-white hover:bg-white/10"
            >
              <X className="w-4 h-4" />
              Close
            </button>
          </div>
        </div>

        <p className="mt-3 text-center text-sm font-medium text-[#FAF8F5] line-clamp-2">{title}</p>

        <div className="w-36 h-36 mx-auto mt-2">
          <SpeakingOrb
            ref={attachOrb}
            state={finished ? "done" : "listening"}
            rest="thinking"
            level={0.25}
            particles={2500}
            onEnd={handleOrbEnd}
            className="[&_.cap]:hidden [&_canvas.fx]:hidden"
          />
        </div>
        <p className="mt-1 text-sm text-center text-stone-200 min-h-[40px] line-clamp-3" aria-live="polite">
          {finished ? "That's the end of the story." : caption ?? currentText}
        </p>

        {noVoiceNote}

        <div className="mt-4">
          {progressBar}
          <div className="mt-1.5 flex justify-between font-mono text-[0.6875rem] text-white/45 tabular-nums">
            <span>{partLabel}</span>
            <span>{remaining}</span>
          </div>
        </div>

        {voiceSpeed && <div className="mt-5">{voiceSpeed}</div>}

        <div className="mt-5">{transport}</div>
      </motion.div>
    </motion.div>
  )

  const startAi = () => {
    if (open) return
    if (audiobook?.playing || audiobook?.floating) audiobook.close()
    autoStart.current = true
    setOpen(true)
  }

  // The author's narration started (header button or embedded player): stop the AI voice
  const narrationPlaying = !!audiobook?.playing
  useEffect(() => {
    if (narrationPlaying && open) close()
  }, [narrationPlaying, open, close])

  // Settings → Reading → "Read aloud" turns the Listen control off (an open player stays until closed)
  if (!ttsEnabled && !open) return null

  return (
    <>
      <button
        onClick={startAi}
        aria-expanded={open}
        className="inline-flex items-center gap-2 h-9 pl-3 pr-4 rounded-full bg-[var(--panel)] border border-[var(--border)] text-sm font-medium hover:border-[var(--border-strong)] transition-colors"
      >
        <span className="grid place-items-center w-6 h-6 rounded-full hue-wash hue-ink">
          <Headphones className="w-3.5 h-3.5" />
        </span>
        Listen
        <span className="meta normal-case tracking-normal">{minutes} min</span>
      </button>

      <AnimatePresence>{open && (isDesktop ? desktopCard : expanded ? sheet : miniBar)}</AnimatePresence>
    </>
  )
}
