"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { ArrowRight, Check, HandCoins, Loader2 } from "lucide-react"
import { DialogShell } from "@/components/posts/DialogShell"
import { useUIStore, toast } from "@/lib/store"
import { dur, ease, spring, stagger } from "@/lib/motion"
import { cn } from "@/lib/utils"

interface TipModalProps {
  authorId: string
  authorName: string
  authorUsername: string
  isOpen: boolean
  onClose: () => void
}

const PRESETS = [2, 5, 10, 25]
const MIN = 1
const MAX = 500
const NOTE_MAX = 280

type Phase = "form" | "processing" | "done"

// Demo tipping: no real payment provider — a short simulated processing step, then the tip is
// recorded in the local store.
export function TipModal({ authorName, authorUsername, isOpen, onClose }: TipModalProps) {
  const recordTip = useUIStore((s) => s.recordTip)
  const [preset, setPreset] = useState<number | null>(5)
  const [custom, setCustom] = useState("")
  const [note, setNote] = useState("")
  const [phase, setPhase] = useState<Phase>("form")
  const [touched, setTouched] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset once closed (the exiting dialog keeps its last frame), so it reopens on a fresh form
  useEffect(() => {
    if (isOpen) return
    setPreset(5)
    setCustom("")
    setNote("")
    setPhase("form")
    setTouched(false)
  }, [isOpen])

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const usingCustom = custom.trim() !== ""
  const parsed = usingCustom ? Number(custom) : preset ?? 0
  const amount = Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0
  const error = !usingCustom
    ? null
    : !Number.isFinite(parsed) || parsed <= 0
    ? "Enter an amount"
    : parsed < MIN
    ? `The minimum tip is $${MIN}`
    : parsed > MAX
    ? `The maximum tip is $${MAX}`
    : null
  const valid = amount >= MIN && amount <= MAX && !error

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!valid || phase !== "form") return
    setPhase("processing")
    timer.current = setTimeout(() => {
      recordTip(authorUsername, amount)
      setPhase("done")
      toast(`You tipped ${authorName} $${amount.toFixed(2)}`, { tone: "success" })
    }, 1000)
  }

  return (
    <DialogShell open={isOpen} onClose={onClose} label={`Tip ${authorName}`} locked={phase === "processing"}>
      <AnimatePresence mode="wait" initial={false}>
        {phase === "done" ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out } }}
            exit={{ opacity: 0, transition: { duration: dur.fast } }}
            className="text-center pt-6 pb-2"
          >
            <div className="relative mx-auto w-16 h-16">
              {/* Two soft rings ripple out once behind the check */}
              {[0, 1].map((i) => (
                <motion.span
                  key={i}
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-[var(--accent)]"
                  initial={{ scale: 0.8, opacity: 0.35 }}
                  animate={{ scale: 2.1, opacity: 0 }}
                  transition={{ duration: 1.1, delay: 0.1 + i * 0.25, ease: ease.out }}
                />
              ))}
              <motion.span
                className="relative grid place-items-center w-16 h-16 rounded-full bg-[var(--accent)] text-[var(--on-accent)]"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1, transition: spring.snappy }}
              >
                <Check className="w-7 h-7" strokeWidth={2.5} />
              </motion.span>
            </div>
            <motion.h2
              className="display text-[1.75rem] mt-6"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0, transition: { delay: stagger * 3, duration: dur.base, ease: ease.out } }}
            >
              Thank you
            </motion.h2>
            <motion.p
              className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)] max-w-xs mx-auto"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0, transition: { delay: stagger * 5, duration: dur.base, ease: ease.out } }}
            >
              Your ${amount.toFixed(2)} tip is on its way to {authorName}.
              {note.trim() && " They’ll see your note too."}
            </motion.p>
            <button
              type="button"
              onClick={onClose}
              data-autofocus
              className="mt-6 h-11 px-6 rounded-full bg-[var(--fg)] text-[var(--bg)] text-sm font-medium hover:bg-[var(--fg-secondary)] transition-colors"
            >
              Done
            </button>
            <p className="mt-4 meta">Demo mode · no card was charged</p>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            onSubmit={submit}
            noValidate
            exit={{ opacity: 0, transition: { duration: dur.fast } }}
          >
            <div className="flex items-center gap-3 pr-10">
              <span className="grid place-items-center w-10 h-10 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)]">
                <HandCoins className="w-[18px] h-[18px]" />
              </span>
              <div className="min-w-0">
                <p className="meta">Say thanks</p>
                <h2 className="display text-[1.5rem] truncate">Tip {authorName}</h2>
              </div>
            </div>
            <p className="mt-3 text-sm text-[var(--fg-muted)] leading-relaxed">
              Writers keep 95% of every tip. One-time, no subscription.
            </p>

            <fieldset className="mt-5" disabled={phase === "processing"}>
              <legend className="sr-only">Amount</legend>
              <div className="grid grid-cols-4 gap-2">
                {PRESETS.map((amt) => {
                  const active = !usingCustom && preset === amt
                  return (
                    <button
                      key={amt}
                      type="button"
                      aria-pressed={active}
                      data-autofocus={active ? "" : undefined}
                      onClick={() => {
                        setPreset(amt)
                        setCustom("")
                      }}
                      className={cn(
                        "relative h-11 rounded-full text-sm font-semibold tabular-nums transition-colors",
                        active ? "text-[var(--bg)]" : "bg-[var(--surface)] text-[var(--fg)] hover:bg-[var(--surface-hover)]"
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="tip-preset"
                          className="absolute inset-0 rounded-full bg-[var(--fg)]"
                          transition={spring.snappy}
                        />
                      )}
                      <span className="relative">${amt}</span>
                    </button>
                  )
                })}
              </div>

              <label className="block mt-3">
                <span className="sr-only">Custom amount in dollars</span>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--fg-muted)]">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder={`Custom amount (${MIN}–${MAX})`}
                    value={custom}
                    onChange={(e) => {
                      setCustom(e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1").replace(/(\.\d{2})\d+/, "$1"))
                      setPreset(null)
                    }}
                    onBlur={() => {
                      setTouched(true)
                      if (!custom.trim()) setPreset((p) => p ?? 5)
                    }}
                    aria-invalid={!!(touched && error)}
                    aria-describedby="tip-error"
                    className={cn(
                      "w-full h-11 pl-8 pr-4 rounded-[16px] bg-[var(--panel)] border outline-none text-sm tabular-nums transition-colors placeholder:text-[var(--fg-subtle)]",
                      touched && error ? "border-[var(--error)]" : "border-[var(--border)] focus:border-[var(--fg)]"
                    )}
                  />
                </div>
              </label>
              <AnimatePresence initial={false}>
                {touched && error && (
                  <motion.p
                    id="tip-error"
                    role="alert"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: { duration: dur.fast } }}
                    className="mt-1.5 pl-1 text-xs text-[var(--error)]"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <label className="block mt-3">
                <span className="sr-only">Note to {authorName} (optional)</span>
                <textarea
                  rows={2}
                  maxLength={NOTE_MAX}
                  placeholder={`Add a note for ${authorName.split(" ")[0]} (optional)`}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full p-3.5 rounded-[16px] bg-[var(--panel)] border border-[var(--border)] focus:border-[var(--fg)] outline-none text-sm resize-none transition-colors placeholder:text-[var(--fg-subtle)]"
                />
                <span className="block text-right meta -mt-0.5">{note.length}/{NOTE_MAX}</span>
              </label>
            </fieldset>

            <button
              type="submit"
              disabled={phase === "processing" || (touched && !valid)}
              className="mt-4 w-full h-12 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-sm font-semibold hover:bg-[var(--accent-hover)] transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={phase}
                  className="inline-flex items-center gap-2"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4, transition: { duration: dur.fast } }}
                >
                  {phase === "processing" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Processing…
                    </>
                  ) : (
                    <>
                      Send {valid ? `$${amount.toFixed(2)}` : "tip"} <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </motion.span>
              </AnimatePresence>
            </button>
            <p className="mt-3 text-center meta">Demo mode · no card will be charged</p>
          </motion.form>
        )}
      </AnimatePresence>
    </DialogShell>
  )
}
