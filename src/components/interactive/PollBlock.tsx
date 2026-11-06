"use client"

import { useMemo } from "react"
import { motion } from "motion/react"
import { BarChart2, Check, RotateCcw, Users } from "lucide-react"
import { useUIStore, toast } from "@/lib/store"
import { dur, ease, stagger } from "@/lib/motion"
import { cn } from "@/lib/utils"

interface PollOption {
  id: string
  label: string
  votes: number
}

interface PollBlockProps {
  question?: string
  options?: PollOption[]
}

const defaultOptions: PollOption[] = [
  { id: "1", label: "Orchestrated sagas (central coordinator with a state machine)", votes: 1420 },
  { id: "2", label: "Choreographed sagas (event-driven, no coordinator)", votes: 680 },
  { id: "3", label: "Distributed 2PC / CockroachDB / Spanner primitives", votes: 310 },
  { id: "4", label: "Modular monolith (keep a single DB transaction boundary)", votes: 2190 },
]

// Stable id from the question text, so a vote survives reloads and matches across pages
function pollIdFor(question: string) {
  let h = 5381
  for (const ch of question) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0
  return `poll_${h.toString(36)}`
}

export function PollBlock({
  question = "Which distributed consistency pattern does your engineering organization rely on in production?",
  options = defaultOptions,
}: PollBlockProps) {
  const pollId = useMemo(() => pollIdFor(question), [question])
  const vote = useUIStore((s) => s.pollVotes[pollId])
  const votePoll = useUIStore((s) => s.votePoll)
  const hasVoted = vote !== undefined && vote >= 0 && vote < options.length

  const counts = options.map((o, i) => o.votes + (hasVoted && vote === i ? 1 : 0))
  const total = counts.reduce((a, b) => a + b, 0)
  const leader = Math.max(...counts)

  const choose = (i: number) => {
    if (vote === i) return
    const changed = hasVoted
    votePoll(pollId, i)
    toast(changed ? "Vote changed" : "Vote recorded", { tone: "success" })
  }

  return (
    <section className="not-prose panel p-5 sm:p-6 shadow-[var(--shadow)]" aria-labelledby={`${pollId}-q`}>
      <p className="meta flex items-center gap-1.5 hue-ink">
        <BarChart2 className="w-3.5 h-3.5" /> Reader poll
      </p>
      <h3 id={`${pollId}-q`} className="display text-[1.375rem] leading-[1.15] mt-2">
        {question}
      </h3>

      <div role="group" aria-labelledby={`${pollId}-q`} className="mt-5 space-y-2.5">
        {options.map((opt, i) => {
          const pct = total ? Math.round((counts[i] / total) * 100) : 0
          const selected = vote === i
          return (
            <button
              key={opt.id}
              type="button"

              aria-pressed={selected}
              onClick={() => choose(i)}
              className={cn(
                "group relative w-full overflow-hidden text-left min-h-12 px-4 py-3 rounded-[16px] border transition-colors",
                selected
                  ? "border-[var(--accent)] bg-[var(--panel)]"
                  : "border-[var(--border)] bg-[var(--panel)] hover:border-[var(--border-strong)]"
              )}
            >
              {/* Result bar grows from the left (scaleX) once you've voted */}
              <motion.span
                aria-hidden
                className={cn(
                  "absolute inset-y-0 left-0 w-full origin-left",
                  selected ? "bg-[var(--accent-subtle)]" : "bg-[var(--surface)]"
                )}
                initial={false}
                animate={{ scaleX: hasVoted ? pct / 100 : 0 }}
                transition={{ duration: dur.slow, ease: ease.out, delay: hasVoted ? i * stagger : 0 }}
              />
              <span className="relative flex items-center gap-3">
                <span
                  className={cn(
                    "grid place-items-center w-5 h-5 rounded-full border shrink-0 transition-colors",
                    selected ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]" : "border-[var(--border-strong)]"
                  )}
                >
                  {selected && <Check className="w-3 h-3" strokeWidth={3} />}
                </span>
                <span className={cn("flex-1 text-[0.9375rem] leading-snug", selected ? "font-semibold" : "font-medium")}>
                  {opt.label}
                </span>
                <motion.span
                  className={cn(
                    "font-mono text-sm tabular-nums shrink-0",
                    counts[i] === leader ? "text-[var(--fg)] font-semibold" : "text-[var(--fg-muted)]"
                  )}
                  initial={false}
                  animate={{ opacity: hasVoted ? 1 : 0, x: hasVoted ? 0 : 6 }}
                  transition={{ duration: dur.base, ease: ease.out, delay: hasVoted ? 0.15 + i * stagger : 0 }}
                  aria-hidden={!hasVoted}
                >
                  {pct}%
                </motion.span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--fg-muted)]">
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <Users className="w-4 h-4" />
          {total.toLocaleString()} readers voted
        </span>
        {hasVoted ? (
          <span className="inline-flex items-center gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" /> Tap another option to change your vote
          </span>
        ) : (
          <span>Pick one to see results</span>
        )}
      </div>
    </section>
  )
}
