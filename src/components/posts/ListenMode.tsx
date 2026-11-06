"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import SpeakingOrb, { type SpeakingOrbHandle } from "@/components/ui/speaking-orb"
import { Headphones, Pause, Play, SkipBack, SkipForward, X, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUIStore } from "@/lib/store"

interface ListenModeProps {
  title: string
  /** Story text split into speakable pieces (paragraphs / sentences) */
  chunks: string[]
  minutes: number
}

// Reads a story aloud with the browser voice; the orb pulses with the speech and captions each word
export function ListenMode({ title, chunks, minutes }: ListenModeProps) {
  const orbRef = useRef<SpeakingOrbHandle>(null)
  const playBtnRef = useRef<HTMLButtonElement>(null)
  const playingRef = useRef(false)
  const indexRef = useRef(0)
  const autoStart = useRef(false)

  const [open, setOpen] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [index, setIndex] = useState(0)
  const [finished, setFinished] = useState(false)
  const [canSpeak, setCanSpeak] = useState(true)
  const ttsEnabled = useUIStore((s) => s.ttsEnabled)

  useEffect(() => setCanSpeak(typeof window !== "undefined" && "speechSynthesis" in window), [])

  const speak = useCallback(
    (i: number) => {
      indexRef.current = i
      setIndex(i)
      setFinished(false)
      orbRef.current?.say(chunks[i])
    },
    [chunks]
  )

  const play = useCallback(() => {
    playingRef.current = true
    setPlaying(true)
    speak(finished ? 0 : indexRef.current)
  }, [finished, speak])

  const pause = useCallback(() => {
    playingRef.current = false
    setPlaying(false)
    if ("speechSynthesis" in window) speechSynthesis.cancel()
  }, [])

  const skip = (delta: number) => {
    const i = Math.min(chunks.length - 1, Math.max(0, indexRef.current + delta))
    if (playingRef.current) speak(i)
    else {
      indexRef.current = i
      setIndex(i)
      setFinished(false)
    }
  }

  // Orb finished a piece: move on, or stop at the end
  const handleEnd = () => {
    if (!playingRef.current) return
    const next = indexRef.current + 1
    if (next < chunks.length) speak(next)
    else {
      playingRef.current = false
      setPlaying(false)
      setFinished(true)
    }
  }

  const close = useCallback(() => {
    pause()
    setOpen(false)
  }, [pause])

  // Start speaking once the panel (and its orb) has mounted
  useEffect(() => {
    if (open && autoStart.current) {
      autoStart.current = false
      playBtnRef.current?.focus()
      play()
    }
  }, [open, play])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, close])

  // Never leave the voice running after navigating away
  useEffect(() => () => {
    if ("speechSynthesis" in window) speechSynthesis.cancel()
  }, [])

  const progress = chunks.length ? ((index + (finished ? 1 : 0)) / chunks.length) * 100 : 0
  const ctrl =
    "grid place-items-center w-10 h-10 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"

  // Settings → Reading → "Read aloud" turns the Listen control off (an open player stays until closed)
  if (!ttsEnabled && !open) return null

  return (
    <>
      <button
        onClick={() => {
          if (open) return
          autoStart.current = true
          setOpen(true)
        }}
        aria-expanded={open}
        className="inline-flex items-center gap-2 h-9 pl-3 pr-4 rounded-full bg-[var(--panel)] border border-[var(--border)] text-sm font-medium hover:border-[var(--border-strong)] transition-colors"
      >
        <span className="grid place-items-center w-6 h-6 rounded-full hue-wash hue-ink">
          <Headphones className="w-3.5 h-3.5" />
        </span>
        Listen
        <span className="meta normal-case tracking-normal">{minutes} min</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label={`Listening to ${title}`}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            className="fixed z-[55] inset-x-3 bottom-3 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[360px] overflow-hidden rounded-[24px] border border-white/10 bg-[#0b0b0f] text-white shadow-[0_30px_60px_-20px_rgba(0,0,0,0.7)]"
          >
            <div className="h-1 spectrum-bg" />
            <div className="flex items-start gap-3 px-5 pt-4">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[0.6875rem] uppercase tracking-wider text-white/50">
                  {finished ? "Finished" : playing ? "Now reading" : "Paused"}
                </p>
                <p className="mt-0.5 text-sm font-medium leading-snug line-clamp-1">{title}</p>
              </div>
              <button onClick={close} className={cn(ctrl, "w-8 h-8 -mr-2")} aria-label="Close listening mode">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mx-auto w-[min(100%,250px)] px-2">
              <SpeakingOrb
                ref={orbRef}
                state={finished ? "done" : "listening"}
                rest="thinking"
                level={0.25}
                onEnd={handleEnd}
                style={{ ["--cap-font" as string]: "var(--font-geist), system-ui, sans-serif" }}
              />
            </div>

            {!canSpeak && (
              <p className="px-5 text-center text-xs text-white/50">
                This browser has no built-in voice, so you&apos;ll get captions only.
              </p>
            )}

            <div className="px-5 pb-5 pt-3">
              <div className="h-1 rounded-full bg-white/10 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={chunks.length} aria-valuenow={index + 1} aria-label="Story progress">
                <motion.div
                  className="h-full w-full spectrum-bg origin-left"
                  initial={false}
                  animate={{ scaleX: progress / 100 }}
                  transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}
                />
              </div>
              <div className="mt-1.5 flex justify-between font-mono text-[0.6875rem] text-white/45 tabular-nums">
                <span>Part {index + 1} of {chunks.length}</span>
                <span>~{minutes} min</span>
              </div>

              <div className="mt-3 flex items-center justify-center gap-3">
                <button onClick={() => skip(-1)} disabled={index === 0} className={ctrl} aria-label="Previous paragraph">
                  <SkipBack className="w-4 h-4" />
                </button>
                <motion.button
                  ref={playBtnRef}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => (playing ? pause() : play())}
                  className="grid place-items-center w-14 h-14 rounded-full bg-white text-[#0b0b0f] hover:bg-white/90 transition-colors"
                  aria-label={playing ? "Pause" : finished ? "Play again" : "Play"}
                >
                  {playing ? (
                    <Pause className="w-5 h-5" fill="currentColor" />
                  ) : finished ? (
                    <RotateCcw className="w-5 h-5" />
                  ) : (
                    <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
                  )}
                </motion.button>
                <button onClick={() => skip(1)} disabled={index >= chunks.length - 1} className={ctrl} aria-label="Next paragraph">
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
