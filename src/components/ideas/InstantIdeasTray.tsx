"use client"

import { useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { Plus } from "lucide-react"
import { CountdownRing, IdeaBody, TimePill } from "@/components/ideas/IdeaParts"
import { IdeaComposer } from "@/components/ideas/IdeaComposer"
import { IdeaViewer } from "@/components/ideas/IdeaViewer"
import { useInstantIdeas } from "@/components/ideas/useInstantIdeas"
import { useViewer } from "@/components/providers/useViewer"
import { DURATIONS, THEMES, type InstantIdea } from "@/lib/ideas"
import { dur, ease, spring } from "@/lib/motion"
import { toast } from "@/lib/store"
import { cn } from "@/lib/utils"

const CARD = "shrink-0 snap-start h-[148px] rounded-[18px]"

// Horizontal tray of short-lived ideas above the feed
export function InstantIdeasTray({ className }: { className?: string }) {
  const api = useInstantIdeas()
  const { ready, ideas, now, seen } = api
  const { viewer } = useViewer()
  const [composing, setComposing] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <section aria-labelledby="instant-ideas-title" className={cn("max-w-7xl mx-auto px-4 sm:px-6", className)}>
      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          <h2 id="instant-ideas-title" className="font-display font-semibold text-xl tracking-tight">
            Instant Ideas
          </h2>
          <p className="mt-0.5 text-sm text-[var(--fg-muted)]">Raw sparks &amp; fleeting notes · Vanishes automatically</p>
        </div>
        {ready && ideas.length > 0 && (
          <span className="shrink-0 inline-flex items-center gap-1.5 text-xs text-[var(--fg-muted)] tabular-nums">
            <span aria-hidden className="relative flex w-1.5 h-1.5">
              <span className="absolute inset-0 rounded-full bg-[var(--nav-dot)] opacity-60 animate-ping motion-reduce:animate-none" />
              <span className="relative w-1.5 h-1.5 rounded-full bg-[var(--nav-dot)]" />
            </span>
            {ideas.length} live
          </span>
        )}
      </div>

      <div
        role="list"
        aria-label="Instant Ideas"
        className="flex gap-3 overflow-x-auto scrollbar-none snap-x scroll-px-4 sm:scroll-px-0 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:[mask-image:linear-gradient(to_right,black_calc(100%-48px),transparent)]"
      >
        <div role="listitem" className="contents">
          {viewer ? (
            <button type="button" onClick={() => setComposing(true)} className={cn(CARD, dropCard)}>
              <DropFace />
            </button>
          ) : (
            <Link href="/auth/login?redirectTo=%2F" className={cn(CARD, dropCard)}>
              <DropFace signedOut />
            </Link>
          )}
        </div>

        {!ready ? (
          [0, 1, 2].map((i) => <div key={i} aria-hidden className={cn(CARD, "w-[252px] bg-[var(--surface)] animate-pulse")} />)
        ) : (
          <AnimatePresence initial={false} mode="popLayout">
            {ideas.map((idea) => (
              <motion.div
                key={idea.id}
                role="listitem"
                layout
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1, transition: { duration: dur.base, ease: ease.out } }}
                // Vanishing is the feature: dissolve rather than blink out
                exit={{ opacity: 0, scale: 0.9, filter: "blur(8px)", transition: { duration: dur.slow, ease: ease.in } }}
                transition={{ layout: spring.soft }}
                className="shrink-0 snap-start"
              >
                <IdeaCard idea={idea} now={now} seen={seen.has(idea.id)} onOpen={() => setOpenId(idea.id)} />
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {ready && ideas.length === 0 && (
          <div className={cn(CARD, "w-[280px] grid place-items-center px-6 border border-[var(--border)] text-center")}>
            <p className="text-sm text-[var(--fg-muted)]">Every idea has vanished. Drop the next one.</p>
          </div>
        )}
      </div>

      <IdeaComposer
        open={composing}
        onClose={() => setComposing(false)}
        onPost={(input) => {
          if (!viewer) return
          api.post(input, viewer)
          setComposing(false)
          const d = DURATIONS.find((x) => x.ms === input.durationMs)
          toast(`Idea dropped · vanishes in ${d?.short ?? "24h"}`, { tone: "success" })
        }}
      />
      <IdeaViewer api={api} startId={openId} onClose={() => setOpenId(null)} />
    </section>
  )
}

const dropCard =
  "w-[148px] flex flex-col items-center justify-center gap-2.5 border border-dashed border-[var(--border-strong)] bg-[var(--panel)] hover:border-[var(--fg)] hover:bg-[var(--bg-secondary)] transition-colors text-center"

function DropFace({ signedOut }: { signedOut?: boolean }) {
  return (
    <>
      <span className="grid place-items-center w-10 h-10 rounded-full bg-[var(--nav-cta)] text-[var(--nav-cta-fg)]">
        <Plus className="w-[18px] h-[18px]" />
      </span>
      <span className="text-sm font-medium leading-tight">Drop an Idea</span>
      <span className="text-[11px] text-[var(--fg-muted)] leading-tight px-3">
        {signedOut ? "Sign in to post" : "Gone in 24h or less"}
      </span>
    </>
  )
}

function IdeaCard({ idea, now, seen, onOpen }: { idea: InstantIdea; now: number; seen: boolean; onOpen: () => void }) {
  const t = THEMES[idea.theme]
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open idea by ${idea.authorName}`}
      className={cn(
        CARD,
        "w-[252px] flex flex-col p-3.5 text-left shadow-[var(--shadow)] hover:shadow-[var(--shadow-lift)] hover:-translate-y-0.5 transition-[box-shadow,translate] duration-300",
        t.canvas
      )}
    >
      <span className="flex items-center gap-2.5">
        <CountdownRing idea={idea} now={now} size={38} seen={seen} />
        <span className={cn("flex-1 min-w-0 text-[13px] font-semibold truncate", t.ink)}>{idea.authorName}</span>
        <TimePill idea={idea} now={now} />
      </span>
      <span className="mt-auto block">
        <IdeaBody text={idea.text} format={idea.format} theme={idea.theme} />
      </span>
    </button>
  )
}
