"use client"

import { AnimatePresence, motion } from "motion/react"
import { Check } from "lucide-react"
import { ElitePaperBadge } from "@/components/papers/ElitePaper"
import { newPaper, PAPER_DEPTHS, type AdvancedPaper } from "@/lib/papers"
import { dur, ease } from "@/lib/motion"
import { cn } from "@/lib/utils"

const TAKEAWAY_MAX = 200

// Editor card: turn a story into an Elite-only Advanced Paper and write its abstract
export function PaperSettings({ paper, onChange }: { paper?: AdvancedPaper; onChange: (next: AdvancedPaper | undefined) => void }) {
  const on = !!paper

  return (
    <section
      aria-labelledby="paper-settings-title"
      className={cn(
        "rounded-[16px] border p-4 transition-colors",
        on ? "border-[var(--elite-line)] bg-[var(--elite-wash)]" : "border-[var(--border)] bg-[var(--bg)]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <ElitePaperBadge label="Elite Paper" />
          <h3 id="paper-settings-title" className="mt-2.5 text-sm font-semibold">
            Advanced Paper (Elite Exclusive)
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-[var(--fg-muted)]">
            Elite members read it in full. Everyone else sees your abstract and the opening quarter.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="paper-settings-title"
          onClick={() => onChange(on ? undefined : newPaper())}
          className={cn(
            "relative mt-0.5 shrink-0 w-11 h-6 rounded-full border transition-colors",
            on ? "bg-[var(--gold)] border-[var(--gold)]" : "bg-[var(--surface)] border-[var(--border-strong)]"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-xs transition-transform",
              on && "translate-x-5"
            )}
          />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {paper && (
          <motion.div
            key="fields"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1, transition: { duration: dur.base, ease: ease.out } }}
            exit={{ height: 0, opacity: 0, transition: { duration: dur.fast, ease: ease.in } }}
            className="overflow-hidden"
          >
            <fieldset className="mt-4">
              <legend className="text-xs font-medium text-[var(--fg-secondary)] mb-2">Difficulty / depth</legend>
              <div role="radiogroup" className="space-y-1.5">
                {PAPER_DEPTHS.map((d) => {
                  const active = paper.depth === d.value
                  return (
                    <button
                      key={d.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => onChange({ ...paper, depth: d.value })}
                      className={cn(
                        "w-full flex items-start gap-2.5 px-3 py-2.5 rounded-[12px] border text-left transition-colors",
                        active
                          ? "border-[var(--elite-line)] bg-[var(--panel)]"
                          : "border-transparent hover:bg-[var(--panel)]"
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "mt-0.5 grid place-items-center w-4 h-4 shrink-0 rounded-full border",
                          active ? "bg-[var(--elite-ink)] border-[var(--elite-ink)] text-[var(--panel)]" : "border-[var(--border-strong)] text-transparent"
                        )}
                      >
                        <Check className="w-2.5 h-2.5" strokeWidth={3} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[0.8125rem] font-medium">{d.label}</span>
                        <span className="block text-xs text-[var(--fg-muted)]">{d.desc}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <fieldset className="mt-4">
              <legend className="text-xs font-medium text-[var(--fg-secondary)]">Key takeaways</legend>
              <p className="text-xs text-[var(--fg-muted)] mt-0.5 mb-2">Three points, shown to every reader as the abstract.</p>
              <div className="space-y-2">
                {paper.takeaways.map((t, i) => (
                  <label key={i} className="block">
                    <span className="sr-only">Takeaway {i + 1}</span>
                    <textarea
                      value={t}
                      rows={2}
                      maxLength={TAKEAWAY_MAX}
                      onChange={(e) => {
                        const takeaways = [...paper.takeaways]
                        takeaways[i] = e.target.value
                        onChange({ ...paper, takeaways })
                      }}
                      placeholder={
                        ["The central finding, in one sentence", "The evidence or method behind it", "What it changes for the reader"][i]
                      }
                      className="w-full resize-none px-3 py-2 rounded-[10px] bg-[var(--panel)] border border-[var(--border)] focus:border-[var(--elite-line)] text-[0.8125rem] leading-snug outline-none placeholder:text-[var(--fg-subtle)] transition-colors"
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
