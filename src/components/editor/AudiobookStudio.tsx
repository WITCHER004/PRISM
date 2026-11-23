"use client"

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react"
import { AnimatePresence, motion } from "motion/react"
import {
  ChevronDown, CircleAlert, FileAudio, Headphones, Loader2, Mic, Paperclip, Pause, Play, RotateCcw, Square, Trash2,
  UploadCloud, X,
} from "lucide-react"
import { toast, useUIStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { dur, ease } from "@/lib/motion"
import type { AudiobookFields, AudiobookSource } from "@/lib/live/schema"
import {
  AUDIO_ACCEPT, MAX_RECORD_SEC, RECORD_BITRATE, audioFileProblem, formatBytes, formatClock, probeDuration,
  recorderMimeType, recordingName, uploadAudiobook, uploadErrorMessage,
} from "@/lib/audiobook"

/** A recording or chosen file that hasn't been uploaded yet */
interface Take {
  blob: Blob
  url: string
  name: string
  durationSec: number
  source: AudiobookSource
}

type Tab = "record" | "upload"
type RecState = "idle" | "starting" | "recording" | "paused"

export interface AudiobookStudioHandle {
  /** A take is ready but not uploaded yet */
  hasPending: () => boolean
  /** The microphone is recording or paused mid-take */
  isRecording: () => boolean
  /** Uploads the pending take (Submit does this) and resolves to its fields, or null if it failed */
  attachPending: (onProgress: (percent: number) => void) => Promise<AudiobookFields | null>
}

interface AudiobookStudioProps {
  ref?: Ref<AudiobookStudioHandle>
  value: AudiobookFields
  onChange: (next: AudiobookFields) => void
  /**
   * "attach": an essay's optional slot for a studio recording the author already has (upload only).
   * "primary": a voice post's main canvas: record in the browser or upload, and it's required.
   */
  variant?: "attach" | "primary"
}

/**
 * The author's own voice. On an essay it's an optional pre-recorded audiobook readers can stream or
 * download; on a voice post it's the piece itself. Either way the file goes to Firebase Storage
 * (audiobooks/{uid}/…) and the URL travels with the draft through review.
 */
export function AudiobookStudio({ ref, value, onChange, variant = "attach" }: AudiobookStudioProps) {
  const uid = useUIStore((s) => s.authUid)
  const primary = variant === "primary"
  const [openState, setOpen] = useState(false)
  const open = primary || openState
  const [tab, setTab] = useState<Tab>("record")
  const [take, setTake] = useState<Take | null>(null)
  const [replacing, setReplacing] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [recBusy, setRecBusy] = useState(false)
  const cancelUpload = useRef<(() => void) | null>(null)

  const attached = !!value.audiobookUrl
  const uploading = progress !== null
  // Essays only take files; a voice post can be recorded here too
  const activeTab: Tab = primary ? tab : "upload"

  useEffect(() => () => {
    if (take) URL.revokeObjectURL(take.url)
  }, [take])
  useEffect(() => () => cancelUpload.current?.(), [])

  const attach = async (onProgress?: (percent: number) => void, quiet = false): Promise<AudiobookFields | null> => {
    if (!take || progress !== null) return null
    if (!uid) {
      toast("Sign in again to attach audio", { tone: "error" })
      return null
    }
    setProgress(0)
    const { promise, cancel } = uploadAudiobook(take.blob, {
      uid,
      name: take.name,
      durationSec: take.durationSec,
      source: take.source,
      onProgress: (p) => {
        setProgress(p)
        onProgress?.(p)
      },
    })
    cancelUpload.current = cancel
    try {
      const fields = await promise
      onChange(fields)
      setTake(null)
      setReplacing(false)
      if (!quiet) toast(primary ? "Recording saved to your voice post" : "Audiobook attached — it goes live with this version of the story", { tone: "success" })
      return fields
    } catch (err) {
      const msg = uploadErrorMessage(err)
      toast(msg, { tone: msg === "Upload cancelled." ? undefined : "error" })
      return null
    } finally {
      cancelUpload.current = null
      setProgress(null)
    }
  }

  // Submit uploads a take that wasn't attached yet, through this handle
  const attachRef = useRef(attach)
  attachRef.current = attach
  const takeRef = useRef(take)
  takeRef.current = take
  const recBusyRef = useRef(recBusy)
  recBusyRef.current = recBusy
  useImperativeHandle(
    ref,
    () => ({
      hasPending: () => !!takeRef.current,
      isRecording: () => recBusyRef.current,
      attachPending: (onProgress) => attachRef.current(onProgress, true),
    }),
    []
  )

  const remove = () => {
    // The file stays in Storage: a published version may still point at it until the next approval
    onChange({ audiobookUrl: undefined, audiobookDurationSec: undefined, audiobookSource: undefined })
    setReplacing(false)
    toast(primary ? "Recording removed from this voice post" : "Audiobook removed from this draft")
  }

  const Icon = primary ? Mic : Paperclip
  return (
    <section
      className={cn(
        "rounded-[20px] border bg-[var(--panel)] overflow-hidden",
        primary ? "border-[var(--border-strong)] shadow-[var(--shadow)]" : "mt-14 border-[var(--border)]"
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={primary}
        aria-expanded={primary ? undefined : open}
        aria-controls="audiobook-studio"
        className="w-full flex items-center gap-3 px-4 sm:px-5 py-4 text-left enabled:hover:bg-[var(--bg)] transition-colors disabled:cursor-default"
      >
        <span
          className={cn(
            "grid place-items-center w-10 h-10 shrink-0 rounded-full border",
            primary ? "bg-[#141413] text-amber-300 border-black/10" : "bg-[var(--elite-wash)] text-[var(--elite-ink)] border-[var(--elite-line)]"
          )}
        >
          <Icon className="w-4 h-4" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold">{primary ? "Your voice recording" : "Attach Pre-Recorded Audio"}</span>
          <span className="block text-xs text-[var(--fg-muted)] truncate">
            {attached
              ? `${primary ? "Voice post" : "Author Audiobook"} · ${formatClock(value.audiobookDurationSec ?? 0)}`
              : take
                ? `${formatClock(take.durationSec)} ready · uploads when you save it or submit`
                : primary
                  ? "Required · record here or upload a file — this is what you publish"
                  : "Optional · for a studio recording you already have"}
          </span>
        </span>
        {attached ? (
          <span className="hidden sm:inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium bg-[var(--elite-wash)] text-[var(--elite-ink)] border border-[var(--elite-line)]">
            <Headphones className="w-3.5 h-3.5" /> {primary ? "Saved" : "Attached"}
          </span>
        ) : (
          <span className="hidden sm:inline meta">{primary ? "Required" : "Optional"}</span>
        )}
        {!primary && <ChevronDown className={cn("w-4 h-4 shrink-0 text-[var(--fg-muted)] transition-transform", open && "rotate-180")} />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="audiobook-studio"
            initial={primary ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1, transition: { duration: dur.base, ease: ease.out } }}
            exit={{ height: 0, opacity: 0, transition: { duration: dur.fast, ease: ease.in } }}
            className="overflow-hidden"
          >
            <div className="border-t border-[var(--border)] px-4 sm:px-5 pt-5 pb-5">
              {!primary && (
                <p className="mb-4 text-sm text-[var(--fg-muted)] leading-relaxed">
                  Readers can always hear your written article with the AI voice (Listen). Attach a recording only if
                  you&apos;ve narrated it yourself — readers can then stream or download it as your Author Audiobook.
                </p>
              )}

              {attached && !replacing ? (
                <div className="rounded-[16px] border border-[var(--elite-line)] bg-[var(--elite-wash)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="meta text-[var(--elite-ink)]">{primary ? "Your recording" : "Attached audiobook"}</p>
                      <p className="mt-0.5 text-sm font-medium tabular-nums">{formatClock(value.audiobookDurationSec ?? 0)}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setReplacing(true)}
                        className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-sm font-medium border border-[var(--border-strong)] bg-[var(--panel)] hover:border-[var(--fg)] transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> {primary ? "Re-record" : "Replace"}
                      </button>
                      <button
                        type="button"
                        onClick={remove}
                        aria-label="Remove recording"
                        title="Remove recording"
                        className="grid place-items-center w-9 h-9 rounded-full text-[var(--fg-muted)] hover:text-[var(--error)] hover:bg-[var(--panel)] transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <audio controls preload="metadata" src={value.audiobookUrl} className="mt-3 w-full h-10" />
                  <p className="mt-2 text-xs text-[var(--fg-muted)]">Readers hear it once this version passes review.</p>
                </div>
              ) : take ? (
                <TakePreview
                  take={take}
                  progress={progress}
                  primary={primary}
                  onDiscard={() => setTake(null)}
                  onAttach={() => attach()}
                  onCancel={() => cancelUpload.current?.()}
                />
              ) : (
                <>
                  {primary && (
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div role="tablist" aria-label="Recording source" className="inline-flex p-1 rounded-full bg-[var(--surface)]">
                        {(
                          [
                            { id: "record", label: "Record Voice", icon: Mic },
                            { id: "upload", label: "Upload Audio File", icon: UploadCloud },
                          ] as const
                        ).map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            role="tab"
                            id={`audiobook-tab-${t.id}`}
                            aria-selected={tab === t.id}
                            aria-controls={`audiobook-panel-${t.id}`}
                            disabled={recBusy || uploading}
                            onClick={() => setTab(t.id)}
                            className={cn(
                              "inline-flex items-center gap-1.5 h-9 px-3 sm:px-4 rounded-full text-sm font-medium transition-colors disabled:opacity-50",
                              tab === t.id ? "bg-[var(--panel)] text-[var(--fg)] shadow-[var(--shadow)]" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
                            )}
                          >
                            <t.icon className="w-3.5 h-3.5" />
                            <span className="sm:hidden">{t.id === "record" ? "Record" : "Upload"}</span>
                            <span className="hidden sm:inline">{t.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {activeTab === "record" ? (
                    <div role="tabpanel" id="audiobook-panel-record" aria-labelledby="audiobook-tab-record">
                      <Recorder onBusy={setRecBusy} onTake={setTake} />
                    </div>
                  ) : (
                    <div role={primary ? "tabpanel" : undefined} id="audiobook-panel-upload" aria-labelledby={primary ? "audiobook-tab-upload" : undefined}>
                      <FileDrop onPick={setTake} />
                    </div>
                  )}
                  {replacing && (
                    <button
                      type="button"
                      onClick={() => setReplacing(false)}
                      disabled={recBusy}
                      className="mt-3 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:opacity-50"
                    >
                      Keep the current recording
                    </button>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

/* ── Preview before upload ─────────────────────────────────────────────────── */

function TakePreview({
  take,
  progress,
  primary,
  onDiscard,
  onAttach,
  onCancel,
}: {
  take: Take
  progress: number | null
  primary: boolean
  onDiscard: () => void
  onAttach: () => void
  onCancel: () => void
}) {
  const uploading = progress !== null
  return (
    <div className="rounded-[16px] border border-[var(--border)] bg-[var(--bg)] p-4">
      <div className="flex items-center gap-3">
        <span className="grid place-items-center w-10 h-10 shrink-0 rounded-full bg-[var(--surface)] text-[var(--fg-muted)]">
          <FileAudio className="w-4 h-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{take.source === "recorded" ? "Your recording" : take.name}</p>
          <p className="meta normal-case tracking-normal tabular-nums">
            {formatClock(take.durationSec)} · {formatBytes(take.blob.size)}
          </p>
        </div>
      </div>
      <audio controls preload="metadata" src={take.url} className="mt-3 w-full h-10" />

      {uploading ? (
        <div className="mt-4" aria-live="polite">
          <div className="flex items-center justify-between text-xs text-[var(--fg-muted)] mb-1.5">
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading to Prism…
            </span>
            <span className="tabular-nums font-medium text-[var(--fg)]">{progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--surface)] overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Upload progress">
            <div className="h-full rounded-full bg-[var(--elite-ink)] transition-[width] duration-300" style={{ width: `${progress}%` }} />
          </div>
          <button type="button" onClick={onCancel} className="mt-2 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] underline underline-offset-2">
            Cancel upload
          </button>
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button
              type="button"
              onClick={onDiscard}
              className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-full text-sm font-medium border border-[var(--border-strong)] hover:border-[var(--fg)] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> {take.source === "recorded" ? "Re-record" : "Choose another"}
            </button>
            <button
              type="button"
              onClick={onAttach}
              className="inline-flex items-center justify-center gap-1.5 h-10 px-5 rounded-full text-sm font-medium bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--fg-secondary)] transition-colors"
            >
              <Headphones className="w-4 h-4" /> {primary ? "Use this recording" : "Attach to story"}
            </button>
          </div>
          <p className="mt-2 text-xs text-[var(--fg-muted)] sm:text-right">Or just submit — it uploads when you submit.</p>
        </>
      )}
    </div>
  )
}

/* ── Record in the browser (voice posts) ───────────────────────────────────── */

function micErrorMessage(err: unknown): string {
  const name = (err as DOMException)?.name
  if (name === "NotAllowedError" || name === "SecurityError") return "Microphone access is blocked. Allow it in your browser's site settings, then try again."
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No microphone found. Plug one in, or upload a recording instead."
  if (name === "NotReadableError") return "Your microphone is busy in another app. Close it there and try again."
  return "Couldn't start the microphone. Try again, or upload a recording instead."
}

function Recorder({ onBusy, onTake }: { onBusy: (busy: boolean) => void; onTake: (t: Take) => void }) {
  const [state, setState] = useState<RecState>("idle")
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [supported, setSupported] = useState(true)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const ctxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef(0)
  // Elapsed time = finished segments + the running one
  const accMs = useRef(0)
  const segStart = useRef(0)
  const stateRef = useRef<RecState>("idle")

  useEffect(() => {
    setSupported(typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined")
  }, [])

  const setRec = (s: RecState) => {
    stateRef.current = s
    setState(s)
    onBusy(s !== "idle")
  }
  const elapsedMs = () => accMs.current + (stateRef.current === "recording" ? performance.now() - segStart.current : 0)

  const release = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    analyserRef.current = null
    ctxRef.current?.close().catch(() => {})
    ctxRef.current = null
  }, [])

  // Never keep the mic open after leaving the editor
  useEffect(
    () => () => {
      const r = recorderRef.current
      if (r && r.state !== "inactive") {
        r.onstop = null
        r.stop()
      }
      release()
    },
    [release]
  )

  // Live level bars from the AnalyserNode
  const draw = useCallback(() => {
    const bins = new Uint8Array(256)
    const frame = () => {
      const canvas = canvasRef.current
      const analyser = analyserRef.current
      if (canvas) {
        const dpr = window.devicePixelRatio || 1
        const w = canvas.clientWidth
        const h = canvas.clientHeight
        if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr)
        if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr)
        const g = canvas.getContext("2d")
        if (g) {
          g.setTransform(dpr, 0, 0, dpr, 0, 0)
          g.clearRect(0, 0, w, h)
          g.fillStyle = getComputedStyle(canvas).color
          const bars = Math.max(24, Math.floor(w / 7))
          const live = analyser && stateRef.current === "recording"
          if (live) analyser.getByteFrequencyData(bins)
          const barW = Math.max(2, w / bars - 3)
          for (let i = 0; i < bars; i++) {
            // The voice band (lower ~60% of bins) spread across the bars
            const v = live ? bins[Math.floor((i / bars) * bins.length * 0.6)] / 255 : 0
            const bh = Math.max(3, v * h * 0.95)
            g.globalAlpha = live ? 0.35 + v * 0.65 : 0.3
            g.beginPath()
            g.roundRect(i * (w / bars) + 1.5, (h - bh) / 2, barW, bh, barW / 2)
            g.fill()
          }
          g.globalAlpha = 1
        }
      }
      if (stateRef.current === "recording" || stateRef.current === "paused") rafRef.current = requestAnimationFrame(frame)
    }
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(frame)
  }, [])

  const stop = useCallback(() => {
    const r = recorderRef.current
    if (!r || r.state === "inactive") return
    if (stateRef.current === "recording") accMs.current += performance.now() - segStart.current
    stateRef.current = "paused" // stop timing; onstop finishes the job
    r.stop()
  }, [])

  // Live timer, plus the hour cap
  useEffect(() => {
    if (state !== "recording") return
    const t = window.setInterval(() => {
      const sec = elapsedMs() / 1000
      setElapsed(sec)
      if (sec >= MAX_RECORD_SEC) {
        toast("Recordings stop at 60 minutes — longer pieces can be uploaded as a file")
        stop()
      }
    }, 250)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, stop])

  const start = async () => {
    setError(null)
    setRec("starting")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      streamRef.current = stream
      const mimeType = recorderMimeType()
      const recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: RECORD_BITRATE })
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || "audio/webm"
        const blob = new Blob(chunksRef.current, { type })
        // Recorded WebM carries no duration; the timer is the honest length
        const durationSec = Math.round(accMs.current / 1000)
        chunksRef.current = []
        release()
        setRec("idle")
        setElapsed(0)
        if (!blob.size) return setError("Nothing was recorded. Check your microphone and try again.")
        onTake({ blob, url: URL.createObjectURL(blob), name: recordingName(type), durationSec, source: "recorded" })
      }

      const ctx = new AudioContext()
      ctxRef.current = ctx
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.75
      ctx.createMediaStreamSource(stream).connect(analyser)
      analyserRef.current = analyser

      accMs.current = 0
      segStart.current = performance.now()
      recorder.start(1000)
      setRec("recording")
      draw()
    } catch (err) {
      release()
      setRec("idle")
      const msg = micErrorMessage(err)
      setError(msg)
      toast(msg, { tone: "error" })
    }
  }

  const pause = () => {
    const r = recorderRef.current
    if (!r || r.state !== "recording") return
    r.pause()
    accMs.current += performance.now() - segStart.current
    setElapsed(accMs.current / 1000)
    setRec("paused")
  }
  const resume = () => {
    const r = recorderRef.current
    if (!r || r.state !== "paused") return
    r.resume()
    segStart.current = performance.now()
    setRec("recording")
  }

  if (!supported) {
    return (
      <p className="flex items-start gap-2 p-4 rounded-[14px] border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--fg-muted)]">
        <CircleAlert className="w-4 h-4 mt-0.5 shrink-0" />
        This browser can&apos;t record audio. Record in another app and use “Upload Audio File”, or switch to a recent Chrome, Edge, Firefox or Safari.
      </p>
    )
  }

  const active = state === "recording" || state === "paused"
  const btn = "inline-flex items-center gap-2 h-11 px-5 rounded-full text-sm font-medium transition-colors"
  return (
    <div className="rounded-[16px] bg-[#141413] text-[#FAF8F5] p-4 sm:p-5 border border-black/10">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-wider text-white/60">
          <span
            aria-hidden
            className={cn("w-2 h-2 rounded-full", state === "recording" ? "bg-red-500 animate-pulse" : state === "paused" ? "bg-amber-400" : "bg-white/25")}
          />
          {state === "recording" ? "Recording" : state === "paused" ? "Paused" : state === "starting" ? "Opening mic…" : "Studio"}
        </span>
        <span className="font-mono text-2xl tabular-nums tracking-tight">{formatClock(elapsed)}</span>
      </div>

      <canvas ref={canvasRef} aria-hidden className="mt-4 block w-full h-16 text-amber-400" />

      {error && (
        <p role="alert" className="mt-4 flex items-start gap-2 text-sm text-red-300">
          <CircleAlert className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {!active ? (
          <button type="button" onClick={start} disabled={state === "starting"} className={cn(btn, "bg-[#FAF8F5] text-[#141413] hover:bg-white disabled:opacity-60")}>
            {state === "starting" ? <Loader2 className="w-4 h-4 animate-spin" /> : <span aria-hidden className="w-2.5 h-2.5 rounded-full bg-red-500" />}
            Record
          </button>
        ) : (
          <>
            {state === "recording" ? (
              <button type="button" onClick={pause} className={cn(btn, "bg-white/10 hover:bg-white/15")}>
                <Pause className="w-4 h-4" fill="currentColor" /> Pause
              </button>
            ) : (
              <button type="button" onClick={resume} className={cn(btn, "bg-white/10 hover:bg-white/15")}>
                <Play className="w-4 h-4" fill="currentColor" /> Resume
              </button>
            )}
            <button type="button" onClick={stop} className={cn(btn, "bg-[#FAF8F5] text-[#141413] hover:bg-white")}>
              <Square className="w-3.5 h-3.5" fill="currentColor" /> Stop
            </button>
          </>
        )}
      </div>
      {!active && <p className="mt-3 text-xs text-white/45">Up to 60 minutes. You&apos;ll listen back before anything is saved.</p>}
    </div>
  )
}

/* ── Upload a file ─────────────────────────────────────────────────────────── */

function FileDrop({ onPick }: { onPick: (t: Take) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [reading, setReading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pick = async (file: File | undefined) => {
    if (!file) return
    const problem = audioFileProblem(file)
    if (problem) return setError(problem)
    setError(null)
    setReading(true)
    const durationSec = await probeDuration(file)
    setReading(false)
    if (!durationSec) return setError("That file couldn't be played in this browser. Try exporting it as MP3 or M4A.")
    onPick({ blob: file, url: URL.createObjectURL(file), name: file.name, durationSec: Math.round(durationSec), source: "uploaded" })
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          pick(e.dataTransfer.files?.[0])
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-3 px-6 py-9 rounded-[16px] border-2 border-dashed text-center transition-colors",
          over ? "border-[var(--elite-ink)] bg-[var(--elite-wash)]" : "border-[var(--border-strong)] bg-[var(--bg)]"
        )}
      >
        <span className="grid place-items-center w-12 h-12 rounded-full bg-[var(--surface)] text-[var(--fg-muted)]">
          {reading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
        </span>
        <div>
          <p className="text-sm font-medium">{reading ? "Reading the file…" : "Drop your recording here"}</p>
          <p className="mt-1 text-xs text-[var(--fg-muted)]">MP3, WAV, M4A or OGG · up to 50 MB</p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={reading}
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-sm font-medium border border-[var(--border-strong)] bg-[var(--panel)] hover:border-[var(--fg)] transition-colors disabled:opacity-50"
        >
          <FileAudio className="w-4 h-4" /> Choose file
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={AUDIO_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            pick(e.target.files?.[0])
            e.target.value = ""
          }}
        />
      </div>
      {error && (
        <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-[var(--error)]">
          <X className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </p>
      )}
    </div>
  )
}
