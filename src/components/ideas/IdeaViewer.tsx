"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import { ChevronLeft, ChevronRight, Clock, Flame, Lightbulb, Pause, Quote, Sparkles, Trash2, X, Zap } from "lucide-react"
import { CountdownRing, IdeaBody, chipSurface, isDarkCanvas } from "@/components/ideas/IdeaParts"
import type { InstantIdeasApi } from "@/components/ideas/useInstantIdeas"
import { useViewer } from "@/components/providers/useViewer"
import { CORAL, HOUR, isImmortal, isUrgent, MINUTE, setPromotedIdeaSeed, setQuoteSeed, THEMES, vanishesIn, type IdeaReaction, type InstantIdea } from "@/lib/ideas"
import { dur, ease } from "@/lib/motion"
import { toast } from "@/lib/store"
import { cn } from "@/lib/utils"

const STORY_MS = 7000

const postedAgo = (idea: InstantIdea, now: number) => {
  const ms = Math.max(0, now - idea.createdAt)
  if (ms >= HOUR) return `${Math.floor(ms / HOUR)}h ago`
  if (ms >= MINUTE) return `${Math.floor(ms / MINUTE)}m ago`
  return "just now"
}

const REACTIONS: { key: IdeaReaction; label: string; icon: typeof Lightbulb }[] = [
  { key: "sparked", label: "Sparked", icon: Lightbulb },
  { key: "deep", label: "Deep", icon: Flame },
]

interface IdeaViewerProps {
  api: InstantIdeasApi
  /** Idea to open on; null = closed */
  startId: string | null
  onClose: () => void
}

// Full-screen, Stories-style. Auto-advances every 7s; tap/arrow keys move; hold or Space pauses.
export function IdeaViewer({ api, startId, onClose }: IdeaViewerProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(
    <AnimatePresence>{startId && <ViewerPanel key="viewer" api={api} startId={startId} onClose={onClose} />}</AnimatePresence>,
    document.body
  )
}

function ViewerPanel({ api, startId, onClose }: { api: InstantIdeasApi; startId: string; onClose: () => void }) {
  const { ideas, toggleReaction, reactionCount, reactions, markSeen, remove, addSparksTest } = api
  const router = useRouter()
  const { viewer } = useViewer()
  const [currentId, setCurrentId] = useState(startId)
  const [held, setHeld] = useState(false)
  const holdStart = useRef(0)
  const wasHold = useRef(false)
  const [paused, setPaused] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const barRef = useRef<HTMLSpanElement>(null)
  const elapsed = useRef(0)
  const panelRef = useRef<HTMLDivElement>(null)
  // Where the current idea sat, so an idea that expires mid-view hands over to its neighbour
  const lastIndex = useRef(0)

  const index = ideas.findIndex((i) => i.id === currentId)
  const idea = index >= 0 ? ideas[index] : undefined
  if (index >= 0) lastIndex.current = index

  // The idea vanished (expired or removed) while open: move to the next one, or close
  useEffect(() => {
    if (idea) return
    const fallback = ideas[Math.min(lastIndex.current, ideas.length - 1)]
    if (fallback) setCurrentId(fallback.id)
    else onClose()
  }, [idea, ideas, onClose])

  const next = useCallback(() => {
    const i = ideas.findIndex((x) => x.id === currentId)
    if (i >= 0 && i < ideas.length - 1) setCurrentId(ideas[i + 1].id)
    else onClose()
  }, [ideas, currentId, onClose])

  const prev = useCallback(() => {
    const i = ideas.findIndex((x) => x.id === currentId)
    if (i > 0) setCurrentId(ideas[i - 1].id)
    else elapsed.current = 0
  }, [ideas, currentId])

  // New idea on screen: restart its timer, mark it seen
  useEffect(() => {
    elapsed.current = 0
    if (barRef.current) barRef.current.style.transform = "scaleX(0)"
    if (idea) markSeen(idea.id)
  }, [currentId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Progress: driven by rAF and written straight to the bar, so the panel doesn't re-render per frame
  const stopped = held || paused
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const loop = (t: number) => {
      const dt = t - last
      last = t
      if (!stopped && !document.hidden) elapsed.current += dt
      const p = Math.min(1, elapsed.current / STORY_MS)
      if (barRef.current) barRef.current.style.transform = `scaleX(${p})`
      if (p >= 1) {
        next()
        return
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [stopped, next, currentId])

  // Live countdown text
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Keyboard, scroll lock, focus in/out
  useEffect(() => {
    const returnTo = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      else if (e.key === "ArrowRight") next()
      else if (e.key === "ArrowLeft") prev()
      else if (e.key === " " && (e.target as HTMLElement)?.tagName !== "BUTTON") {
        e.preventDefault()
        setPaused((p) => !p)
      }
    }
    document.addEventListener("keydown", onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = overflow
      returnTo?.focus?.({ preventScroll: true })
    }
  }, [next, prev, onClose])

  if (!idea) return null
  const t = THEMES[idea.theme]
  const dark = isDarkCanvas(idea.theme)
  const urgent = isUrgent(idea, now)
  const savedImmortal = isImmortal(idea)
  const mine = !!viewer && viewer.username === idea.authorHandle

  const quoteInArticle = () => {
    setQuoteSeed(idea)
    onClose()
    router.push("/editor/new")
  }

  const turnIntoArticle = () => {
    setPromotedIdeaSeed(idea, viewer ? [viewer.username] : [])
    onClose()
    router.push("/editor/new")
  }

  return (
    <motion.div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Instant Idea by ${idea.authorName}`}
      tabIndex={-1}
      className="fixed inset-0 z-[90] flex items-center justify-center outline-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: dur.base, ease: ease.out } }}
      exit={{ opacity: 0, transition: { duration: dur.fast, ease: ease.in } }}
    >
      <div aria-hidden className="absolute inset-0 bg-[#0b0b0c]/90 backdrop-blur-md" onClick={onClose} />

      {/* Desktop arrows, outside the card */}
      <button
        type="button"
        onClick={prev}
        aria-label="Previous idea"
        disabled={index === 0}
        className="hidden sm:grid relative place-items-center w-11 h-11 mr-5 rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 transition-colors"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <motion.article
        key={idea.id}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1, transition: { duration: dur.base, ease: ease.out } }}
        className={cn(
          "relative flex flex-col w-full h-[100dvh] sm:w-[420px] sm:h-[min(760px,calc(100dvh-48px))] sm:rounded-[28px] overflow-hidden shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]",
          t.canvas
        )}
      >
        {/* Tap zones: left third back, the rest forward; hold anywhere to pause */}
        <div
          className="absolute inset-0 z-0 flex"
          onPointerDown={() => {
            holdStart.current = Date.now()
            setHeld(true)
          }}
          onPointerUp={() => {
            // A long press only pauses; releasing it shouldn't also skip the idea
            wasHold.current = Date.now() - holdStart.current > 280
            setHeld(false)
          }}
          onPointerLeave={() => setHeld(false)}
          onPointerCancel={() => setHeld(false)}
        >
          <button type="button" aria-label="Previous idea" tabIndex={-1} onClick={() => !wasHold.current && prev()} className="w-1/3 h-full cursor-w-resize" />
          <button type="button" aria-label="Next idea" tabIndex={-1} onClick={() => !wasHold.current && next()} className="flex-1 h-full cursor-e-resize" />
        </div>

        {/* Progress */}
        <div className="relative z-10 flex gap-1 px-4 pt-4 pointer-events-none" aria-hidden>
          {ideas.map((x, i) => (
            <span key={x.id} className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ backgroundColor: t.track }}>
              <span
                ref={i === index ? barRef : undefined}
                className={cn("block h-full origin-left", dark ? "bg-white" : "bg-[#141413]")}
                style={{ transform: i < index ? "scaleX(1)" : "scaleX(0)" }}
              />
            </span>
          ))}
        </div>

        {/* Header */}
        <header className="relative z-10 flex items-center gap-3 px-4 pt-3.5 pointer-events-none">
          <CountdownRing idea={idea} now={now} size={42} />
          <div className="min-w-0 flex-1">
            <p className={cn("text-sm font-semibold truncate", t.ink)}>{idea.authorName}</p>
            <p className={cn("text-xs truncate", t.muted)}>
              @{idea.authorHandle} · {postedAgo(idea, now)}
            </p>
          </div>
          {stopped && (
            <span className={cn("grid place-items-center w-8 h-8 rounded-full", chipSurface(idea.theme), t.ink)} aria-label="Paused">
              <Pause className="w-3.5 h-3.5" />
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={cn("pointer-events-auto grid place-items-center w-9 h-9 rounded-full transition-colors", chipSurface(idea.theme), t.ink)}
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="relative z-10 px-4 pt-3 pointer-events-none flex items-center justify-between">
          {savedImmortal ? (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-semibold tracking-wide",
                dark ? "bg-amber-400 text-black shadow-sm" : "bg-[#141413] text-[#f4f1ea]"
              )}
            >
              <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              🔥 25+ Sparks · Saved
            </span>
          ) : (
            <span
              style={urgent ? { backgroundColor: CORAL } : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium tabular-nums",
                urgent ? "text-white" : cn(chipSurface(idea.theme), t.ink)
              )}
            >
              <Clock className="w-3.5 h-3.5" />
              Vanishes in {vanishesIn(idea, now)}
            </span>
          )}

          {/* Testing shortcut: +5 Sparks (Test) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              addSparksTest?.(idea.id, 5)
              toast("Added +5 Sparks to this idea!")
            }}
            title="Fast-test: Add 5 sparks to cross 25 threshold"
            className="pointer-events-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-black/30 hover:bg-black/50 text-white backdrop-blur-sm transition-colors"
          >
            <Zap className="w-3 h-3 text-amber-300 fill-amber-300" />
            +5 Sparks (Test)
          </button>
        </div>

        {/* The idea */}
        <div className="relative z-0 flex-1 flex items-center px-7 sm:px-8 pointer-events-none">
          <IdeaBody text={idea.text} format={idea.format} theme={idea.theme} size="story" className="w-full" />
        </div>

        {/* Reactions & Promotion */}
        <footer className="relative z-10 flex flex-wrap items-center gap-2 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
          {REACTIONS.map(({ key, label, icon: Icon }) => {
            const on = reactions[idea.id]?.includes(key)
            return (
              <button
                key={key}
                type="button"
                aria-pressed={!!on}
                onClick={() => toggleReaction(idea.id, key, viewer?.username)}
                className={cn(
                  "inline-flex items-center gap-1.5 h-10 px-3.5 rounded-full text-[13px] font-medium transition-colors",
                  on ? (dark ? "bg-white text-[#141413]" : "bg-[#141413] text-[#f4f1ea]") : cn(chipSurface(idea.theme), t.ink)
                )}
              >
                <Icon className="w-4 h-4" strokeWidth={1.9} />
                {label}
                <span className="tabular-nums opacity-70">{reactionCount(idea, key)}</span>
              </button>
            )
          })}

          {savedImmortal ? (
            <button
              type="button"
              onClick={turnIntoArticle}
              className={cn(
                "inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-[13px] font-semibold transition-all shadow-sm ring-1 ring-amber-400/40",
                dark ? "bg-amber-400 text-black hover:bg-amber-300" : "bg-[#141413] text-[#f4f1ea] hover:bg-black"
              )}
            >
              <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500" strokeWidth={2} />
              ✦ Turn into Article
            </button>
          ) : (
            <button
              type="button"
              onClick={quoteInArticle}
              className={cn("inline-flex items-center gap-1.5 h-10 px-3.5 rounded-full text-[13px] font-medium transition-colors", chipSurface(idea.theme), t.ink)}
            >
              <Quote className="w-4 h-4" strokeWidth={1.9} />
              Quote in Article
            </button>
          )}
          {mine && (
            <button
              type="button"
              onClick={() => {
                remove(idea)
                toast("Idea removed")
              }}
              aria-label="Remove this idea now"
              className={cn("ml-auto grid place-items-center w-10 h-10 rounded-full transition-colors", chipSurface(idea.theme), t.ink)}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </footer>
      </motion.article>

      <button
        type="button"
        onClick={next}
        aria-label={index === ideas.length - 1 ? "Close" : "Next idea"}
        className="hidden sm:grid relative place-items-center w-11 h-11 ml-5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </motion.div>
  )
}
