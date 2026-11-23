"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { Download, Headphones, Loader2, Pause, Play, RotateCcw, RotateCw, X } from "lucide-react"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useUIStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { formatClock } from "@/lib/audioFormat"
import { useIsDesktop } from "@/lib/useIsDesktop"
import { usePostUnlocked } from "@/components/posts/PaywallContent"

// The author's own pre-recorded voice: one <audio> engine per story, shared by the header's "Author
// Audiobook" button and the floating obsidian player (desktop card / mobile mini-bar), with a download
// for offline listening. Where the reader is gets saved to audio_progress/{uid}_{articleId} so they can pick
// up on any device.

const RATES = [0.85, 1, 1.25, 1.5, 1.75]
const RATE_KEY = "prism.audiobook.rate"
const SKIP_SEC = 15
const SAVE_EVERY_MS = 5000
const AUDIO_PROGRESS = "audio_progress"
const MAX_SEC = 14400 // keep in step with firestore.rules

const rateLabel = (r: number) => `${Number.isInteger(r) ? r.toFixed(1) : r}x`
const warn = (msg: string, err: unknown) => console.warn(`[audiobook] ${msg}`, (err as { code?: string })?.code ?? err)

interface Engine {
  src: string
  title: string
  authorName: string
  playing: boolean
  time: number
  total: number
  rate: number
  resumedFrom: number | null
  failed: boolean
  /** The floating player is showing */
  floating: boolean
  /** File name for downloads, e.g. "my-story.mp3" */
  downloadName: string
  /** Paywall / Elite rules allow this reader to keep a copy */
  canDownload: boolean
  /** Play inside a click handler so phones allow the sound */
  play: () => void
  pause: () => void
  seek: (sec: number) => void
  skip: (delta: number) => void
  cycleRate: () => void
  openFloating: () => void
  /** Pause, save the position and hide the floating player */
  close: () => void
}

const AudiobookContext = createContext<Engine | null>(null)

/** The story's audiobook engine, or null when the story has no author narration */
export const useAudiobook = () => useContext(AudiobookContext)

interface ProviderProps {
  src: string
  /** The story's slug: downloads are saved as {slug}.{ext} */
  slug: string
  /** Members-only stories and Advanced Papers (Elite) */
  paywalled: boolean
  durationSec: number
  title: string
  authorName: string
  articleId: string
  children: React.ReactNode
}

export function AudiobookProvider({ src, slug, paywalled, durationSec, title, authorName, articleId, children }: ProviderProps) {
  // Same rule as the story body: Advanced Papers need Elite, member stories need a plan or an unlock
  const canDownload = usePostUnlocked(articleId, paywalled)
  const downloadName = `${slug || "prism-audiobook"}.${extensionOf(src)}`
  const uid = useUIStore((s) => s.authUid)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(durationSec)
  const [rate, setRate] = useState(1)
  const [resumedFrom, setResumedFrom] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)
  const [floating, setFloating] = useState(false)
  const resumeChecked = useRef(false)
  const lastSaved = useRef(0)
  const lastSavedPos = useRef(-1)
  const isDesktop = useIsDesktop()

  const progressRef = useMemo(() => (uid ? doc(db, AUDIO_PROGRESS, `${uid}_${articleId}`) : null), [uid, articleId])
  const total = duration || durationSec

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(RATE_KEY))
      if (RATES.includes(saved)) setRate(saved)
    } catch {}
  }, [])
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate
  }, [rate])

  const save = useCallback(
    (force = false) => {
      const a = audioRef.current
      if (!progressRef || !a || !uid) return
      const pos = Math.floor(a.ended ? 0 : a.currentTime)
      if (!force && Date.now() - lastSaved.current < SAVE_EVERY_MS) return
      if (pos === lastSavedPos.current) return
      lastSaved.current = Date.now()
      lastSavedPos.current = pos
      const len = Number.isFinite(a.duration) ? a.duration : total
      setDoc(progressRef, {
        userId: uid,
        articleId,
        positionSec: Math.min(Math.max(0, pos), MAX_SEC),
        durationSec: Math.min(Math.max(0, Math.round(len)), MAX_SEC),
        updatedAt: Date.now(),
      }).catch((err) => warn("couldn't save position", err))
    },
    [progressRef, uid, articleId, total]
  )

  // Pick up where this reader left off on any device, unless they've already moved the playhead
  const checkResume = useCallback(() => {
    if (resumeChecked.current || !progressRef) return
    resumeChecked.current = true
    getDoc(progressRef)
      .then((snap) => {
        const pos = snap.data()?.positionSec
        const a = audioRef.current
        if (!a || typeof pos !== "number") return
        const len = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : total
        if (pos > 5 && pos < len - 5 && a.currentTime < 3) {
          a.currentTime = pos
          lastSavedPos.current = Math.floor(pos)
          setResumedFrom(pos)
        }
      })
      .catch((err) => warn("couldn't read saved position", err))
  }, [progressRef, total])

  const play = useCallback(() => {
    const a = audioRef.current
    if (!a) return
    setFailed(false)
    a.playbackRate = rate
    a.play().catch((err: DOMException) => {
      if (err?.name !== "AbortError") setPlaying(false)
    })
    checkResume()
  }, [checkResume, rate])

  const pause = useCallback(() => audioRef.current?.pause(), [])

  const seek = useCallback(
    (sec: number) => {
      const a = audioRef.current
      if (!a) return
      const len = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : total
      a.currentTime = Math.min(Math.max(0, sec), Math.max(0, len - 0.25))
      setTime(a.currentTime)
      setResumedFrom(null)
    },
    [total]
  )
  const skip = useCallback((delta: number) => seek((audioRef.current?.currentTime ?? 0) + delta), [seek])

  const cycleRate = useCallback(() => {
    setRate((r) => {
      const next = RATES[(RATES.indexOf(r) + 1) % RATES.length]
      try {
        localStorage.setItem(RATE_KEY, String(next))
      } catch {}
      return next
    })
  }, [])

  const close = useCallback(() => {
    const a = audioRef.current
    if (a && !a.paused) a.pause()
    save(true)
    setFloating(false)
  }, [save])
  const openFloating = useCallback(() => setFloating(true), [])

  // Save when the tab hides or the reader leaves
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") save(true)
    }
    document.addEventListener("visibilitychange", onHide)
    window.addEventListener("pagehide", onHide)
    return () => {
      document.removeEventListener("visibilitychange", onHide)
      window.removeEventListener("pagehide", onHide)
    }
  }, [save])
  const saveRef = useRef(save)
  saveRef.current = save
  useEffect(() => () => saveRef.current(true), [])

  useEffect(() => {
    if (resumedFrom === null) return
    const t = window.setTimeout(() => setResumedFrom(null), 5000)
    return () => window.clearTimeout(t)
  }, [resumedFrom])

  // Esc closes the floating player
  useEffect(() => {
    if (!floating) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [floating, close])

  // Lock screen and headphone controls while the narration is the thing playing
  useEffect(() => {
    if (!playing || !("mediaSession" in navigator)) return
    const ms = navigator.mediaSession
    ms.metadata = new MediaMetadata({ title, artist: `Narrated by ${authorName}`, album: "Prism" })
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => play()],
      ["pause", () => pause()],
      ["seekbackward", () => skip(-SKIP_SEC)],
      ["seekforward", () => skip(SKIP_SEC)],
      ["seekto", (d) => typeof d.seekTime === "number" && seek(d.seekTime)],
    ]
    for (const [action, fn] of handlers) {
      try {
        ms.setActionHandler(action, fn)
      } catch {}
    }
    return () => {
      for (const [action] of handlers) {
        try {
          ms.setActionHandler(action, null)
        } catch {}
      }
    }
  }, [playing, title, authorName, play, pause, skip, seek])

  // Phones: the mini-bar covers the bottom, so pad the story's end and move the article dock aside
  useEffect(() => {
    if (!floating || isDesktop) return
    document.body.setAttribute("data-audio-player", "")
    return () => document.body.removeAttribute("data-audio-player")
  }, [floating, isDesktop])

  const engine: Engine = {
    src, title, authorName, playing, time, total, rate, resumedFrom, failed, floating, downloadName, canDownload,
    play, pause, seek, skip, cycleRate, openFloating, close,
  }

  return (
    <AudiobookContext.Provider value={engine}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => {
          setPlaying(false)
          save(true)
        }}
        onEnded={() => {
          setPlaying(false)
          save(true)
        }}
        onTimeUpdate={(e) => {
          setTime(e.currentTarget.currentTime)
          if (!e.currentTarget.paused) save()
        }}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration
          if (Number.isFinite(d) && d > 0) setDuration(d)
          e.currentTarget.playbackRate = rate
        }}
        onError={() => {
          setPlaying(false)
          setFailed(true)
        }}
        className="hidden"
      />
      {children}
      <AnimatePresence>{floating && (isDesktop ? <DesktopCard key="card" e={engine} /> : <MiniBar key="mini" e={engine} />)}</AnimatePresence>
    </AudiobookContext.Provider>
  )
}

/* ── The header button ─────────────────────────────────────────────────────── */

/** "🎧 Author Audiobook · 05:30 / Voice of {author}": opens the floating player and starts the narration */
export function AuthorAudiobookButton({ className }: { className?: string }) {
  const e = useAudiobook()
  if (!e) return null
  const active = e.floating
  return (
    <button
      type="button"
      onClick={() => {
        e.openFloating()
        if (!e.playing) e.play()
      }}
      aria-expanded={active}
      className={cn(
        "inline-flex items-center gap-2.5 h-11 pl-1.5 pr-4 rounded-full border text-left transition-colors",
        active
          ? "bg-[#141413] border-[#141413] text-[#FAF8F5]"
          : "bg-[var(--elite-wash)] border-[var(--elite-line)] text-[var(--fg)] hover:border-[var(--elite-ink)]",
        className
      )}
    >
      <span className="grid place-items-center w-8 h-8 shrink-0 rounded-full bg-[#141413] text-amber-300">
        <Headphones className="w-4 h-4" />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-medium">
          Author Audiobook <span className="font-mono text-xs tabular-nums opacity-70">· {formatClock(e.total)}</span>
        </span>
        <span className={cn("block text-[11px]", active ? "text-amber-200/80" : "text-[var(--elite-ink)]")}>Voice of {e.authorName}</span>
      </span>
    </button>
  )
}

/* ── Download ──────────────────────────────────────────────────────────────── */

/** The recording's real extension (from the Storage path), so the saved file opens correctly */
function extensionOf(src: string): string {
  try {
    const path = decodeURIComponent(new URL(src).pathname)
    return path.match(/\.(mp3|wav|m4a|ogg|oga|webm|mp4)$/i)?.[1].toLowerCase() ?? "mp3"
  } catch {
    return "mp3"
  }
}

/**
 * Saves the recording. A blob download names the file properly; it needs CORS on the Storage bucket
 * (storage.cors.json). Without it, the file opens in a new tab instead, where uploads made with
 * Content-Disposition: attachment download anyway.
 */
async function downloadRecording(src: string, name: string) {
  try {
    const res = await fetch(src, { mode: "cors" })
    if (!res.ok) throw new Error(String(res.status))
    const url = URL.createObjectURL(await res.blob())
    const a = document.createElement("a")
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
  } catch {
    window.open(src, "_blank", "noopener,noreferrer")
  }
}

/** "↓ Download recording": hidden when the paywall or Elite rules don't let this reader keep a copy */
export function AudiobookDownloadButton({ tone = "dark", compact = false, className }: { tone?: "dark" | "light"; compact?: boolean; className?: string }) {
  const e = useAudiobook()
  const [busy, setBusy] = useState(false)
  if (!e || !e.canDownload) return null
  return (
    <a
      href={e.src}
      download={e.downloadName}
      target="_blank"
      rel="noopener noreferrer"
      onClick={async (ev) => {
        ev.preventDefault()
        if (busy) return
        setBusy(true)
        await downloadRecording(e.src, e.downloadName)
        setBusy(false)
      }}
      aria-label={`Download recording (${e.downloadName})`}
      title="Download the author's recording for offline listening"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 shrink-0 rounded-full font-medium transition-colors focus-visible:outline-none focus-visible:ring-2",
        tone === "dark"
          ? "text-stone-200 border border-white/10 bg-white/[0.07] hover:bg-white/[0.12] focus-visible:ring-white/40"
          : "text-[var(--fg)] border border-[var(--border)] bg-[var(--panel)] hover:border-[var(--border-strong)] focus-visible:ring-[var(--fg)]/30",
        compact ? "w-8 h-8" : tone === "dark" ? "h-7 px-2.5 text-xs" : "h-9 px-3.5 text-sm",
        className
      )}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
      {!compact && <span>Download{tone === "light" ? " recording" : ""}</span>}
    </a>
  )
}

/* ── Shared controls ───────────────────────────────────────────────────────── */

const ctrl =
  "relative grid place-items-center rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"

function SkipButton({ e, dir, size = "w-10 h-10" }: { e: Engine; dir: -1 | 1; size?: string }) {
  return (
    <button type="button" onClick={() => e.skip(dir * SKIP_SEC)} className={cn(ctrl, size)} aria-label={dir < 0 ? "Back 15 seconds" : "Forward 15 seconds"}>
      {dir < 0 ? <RotateCcw className="w-[18px] h-[18px]" /> : <RotateCw className="w-[18px] h-[18px]" />}
      <span aria-hidden className="absolute text-[8px] font-semibold tabular-nums leading-none">15</span>
    </button>
  )
}

function SpeedButton({ e }: { e: Engine }) {
  return (
    <button
      type="button"
      onClick={e.cycleRate}
      className="inline-flex items-center h-7 shrink-0 rounded-full border border-white/10 bg-white/[0.07] hover:bg-white/[0.12] px-2.5 font-mono text-xs tabular-nums text-stone-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      aria-label={`Playback speed ${rateLabel(e.rate)}, click to change`}
    >
      {rateLabel(e.rate)}
    </button>
  )
}

function PlayButton({ e, size, icon }: { e: Engine; size: string; icon: string }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.92 }}
      onClick={e.playing ? e.pause : e.play}
      className={cn("grid place-items-center shrink-0 rounded-full bg-[#FAF8F5] text-[#0b0b0f] hover:bg-white transition-colors", size)}
      aria-label={e.playing ? "Pause narration" : "Play narration"}
    >
      {e.playing ? <Pause className={icon} fill="currentColor" /> : <Play className={cn(icon, "ml-0.5")} fill="currentColor" />}
    </motion.button>
  )
}

function Note({ e }: { e: Engine }) {
  if (e.failed) return <p role="alert" className="text-xs text-red-300">This recording couldn&apos;t be loaded. Check your connection and press play again.</p>
  if (e.resumedFrom !== null) return <p className="text-xs text-amber-200/80" aria-live="polite">Resumed at {formatClock(e.resumedFrom)} · where you left off</p>
  return null
}

const Times = ({ e }: { e: Engine }) => (
  <span className="font-mono text-[0.75rem] text-white/60 tabular-nums">
    {formatClock(e.time)} <span className="text-white/30">/</span> {formatClock(e.total)}
  </span>
)

/* ── Floating player: desktop card ─────────────────────────────────────────── */

function DesktopCard({ e }: { e: Engine }) {
  return (
    <motion.div
      role="dialog"
      aria-label={`Audiobook: ${e.title}, narrated by ${e.authorName}`}
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 24, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 340, damping: 30 }}
      className="fixed z-[55] right-5 bottom-5 w-[360px] overflow-hidden rounded-[24px] border border-white/10 bg-[#0b0b0f] text-white shadow-[0_30px_60px_-20px_rgba(0,0,0,0.7)]"
    >
      <div className="h-1 bg-gradient-to-r from-amber-300 via-amber-500 to-orange-600" />
      <div className="flex items-start gap-3 px-5 pt-4">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[0.6875rem] uppercase tracking-wider text-amber-300/90 truncate">Narrated by {e.authorName}</p>
          <p className="mt-0.5 text-sm font-medium leading-snug line-clamp-1">{e.title}</p>
        </div>
        <button onClick={e.close} className={cn(ctrl, "w-8 h-8 -mr-2")} aria-label="Close audiobook player">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="px-5 pt-5">
        <Waveform e={e} count={56} height="h-14" />
      </div>
      <div className="px-5 pb-5 pt-2">
        <div className="flex items-center justify-between gap-2">
          <Times e={e} />
          <span className="flex items-center gap-1.5">
            <AudiobookDownloadButton />
            <SpeedButton e={e} />
          </span>
        </div>
        <div className="mt-2 empty:hidden"><Note e={e} /></div>
        <div className="mt-3 flex items-center justify-center gap-4">
          <SkipButton e={e} dir={-1} />
          <PlayButton e={e} size="w-14 h-14" icon="w-5 h-5" />
          <SkipButton e={e} dir={1} />
        </div>
      </div>
    </motion.div>
  )
}

/* ── Floating player: mobile mini-bar ──────────────────────────────────────── */

function MiniBar({ e }: { e: Engine }) {
  return (
    <motion.div
      role="region"
      aria-label={`Audiobook player: ${e.title}, narrated by ${e.authorName}`}
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 32 }}
      transition={{ type: "spring", stiffness: 380, damping: 34 }}
      className="fixed left-3 right-3 z-50 rounded-2xl bg-[#111113]/95 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden text-white"
      style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="px-3 pt-2.5 flex items-center gap-2.5">
        <PlayButton e={e} size="w-9 h-9" icon="w-4 h-4" />
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-[10px] uppercase tracking-wider text-amber-300/90 truncate">Narrated by {e.authorName}</span>
          <span className="block text-[12.5px] font-medium text-[#FAF8F5] truncate">{e.title}</span>
        </span>
        <SpeedButton e={e} />
        <AudiobookDownloadButton compact />
        <button onClick={e.close} className="grid place-items-center w-8 h-8 shrink-0 rounded-full text-stone-300 hover:text-white" aria-label="Close audiobook player">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="px-1.5 pb-2 pt-1 flex items-center gap-1">
        <SkipButton e={e} dir={-1} size="w-9 h-9" />
        <span className="w-10 shrink-0 text-right font-mono text-[10.5px] text-white/55 tabular-nums">{formatClock(e.time)}</span>
        <div className="flex-1 min-w-0 px-1">
          <Waveform e={e} count={40} height="h-7" />
        </div>
        <span className="w-10 shrink-0 font-mono text-[10.5px] text-white/55 tabular-nums">{formatClock(e.total)}</span>
        <SkipButton e={e} dir={1} size="w-9 h-9" />
      </div>
      <div className="px-3.5 pb-2.5 -mt-1 empty:hidden"><Note e={e} /></div>
    </motion.div>
  )
}

/* ── Embedded studio player (voice posts) ──────────────────────────────────── */

/** A voice post's recording is the piece: a prominent obsidian player under the byline */
export function AudiobookEmbed({ className }: { className?: string }) {
  const e = useAudiobook()
  if (!e) return null
  return (
    <section
      aria-label={`Voice post narrated by ${e.authorName}`}
      className={cn("overflow-hidden rounded-[24px] bg-[#0b0b0f] text-white border border-black/10 shadow-[var(--shadow-lift)]", className)}
    >
      <div className="h-1 bg-gradient-to-r from-amber-300 via-amber-500 to-orange-600" />
      <div className="p-5 sm:p-7">
        <div className="flex items-center gap-4 sm:gap-5">
          <PlayButton e={e} size="w-14 h-14 sm:w-16 sm:h-16" icon="w-6 h-6" />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[0.6875rem] uppercase tracking-wider text-amber-300/90 truncate">Narrated by {e.authorName}</p>
            <p className="mt-1 text-base sm:text-lg font-medium leading-snug line-clamp-2">{e.title}</p>
          </div>
        </div>
        <div className="mt-6">
          <Waveform e={e} count={72} height="h-16 sm:h-20" />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <Times e={e} />
          <div className="flex items-center gap-1">
            <SkipButton e={e} dir={-1} size="w-9 h-9" />
            <SkipButton e={e} dir={1} size="w-9 h-9" />
            <SpeedButton e={e} />
            <AudiobookDownloadButton className="ml-1" />
          </div>
        </div>
        <div className="mt-2 empty:hidden"><Note e={e} /></div>
      </div>
    </section>
  )
}

/* ── Waveform scrubber ─────────────────────────────────────────────────────── */

/** Bar heights fixed per recording (decorative; the strip doubles as the scrubber) */
function barsFor(seed: string, count: number): number[] {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  const out: number[] = []
  for (let i = 0; i < count; i++) {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    const r = ((h ^= h >>> 16) >>> 0) / 4294967295
    const env = 0.55 + 0.45 * Math.sin((Math.PI * (i + 0.5)) / count) // quieter at the ends, like speech
    out.push(0.18 + 0.82 * r * env)
  }
  return out
}

/** Looks like the recording, works like a slider: an invisible range input sits over the bars */
function Waveform({ e, count, height }: { e: Engine; count: number; height: string }) {
  const bars = useMemo(() => barsFor(e.src, count), [e.src, count])
  const pct = e.total ? Math.min(100, (e.time / e.total) * 100) : 0
  const head = Math.floor((pct / 100) * count) - 1
  const label = `Seek: ${formatClock(e.time)} of ${formatClock(e.total)}`
  return (
    <div className={cn("relative rounded-md focus-within:ring-2 focus-within:ring-white/40", height)}>
      <div aria-hidden className="absolute inset-0 flex items-center gap-[2px]">
        {bars.map((b, i) => (
          <span
            key={i}
            className={cn(
              "flex-1 rounded-full transition-colors duration-200",
              ((i + 0.5) / count) * 100 <= pct ? "bg-amber-400" : "bg-white/20",
              e.playing && i === head && "animate-pulse"
            )}
            style={{ height: `${Math.round(b * 100)}%` }}
          />
        ))}
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(1, Math.floor(e.total))}
        step={1}
        value={Math.floor(e.time)}
        onChange={(ev) => e.seek(Number(ev.target.value))}
        aria-label={label}
        aria-valuetext={label}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </div>
  )
}
