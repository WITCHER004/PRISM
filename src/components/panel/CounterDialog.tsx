"use client"

import { useState } from "react"
import { Loader2, Send } from "lucide-react"
import { StudioDialog, DialogActions } from "@/components/studio/StudioDialog"
import { Button } from "@/components/ui/Button"
import { COUNTER_REASON_MIN, TEXT_MAX } from "@/lib/elite/config"
import { useUIStore, toast } from "@/lib/store"

export const fieldClass =
  "mt-2 w-full p-3.5 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-sm leading-relaxed resize-y focus:border-[var(--fg)] outline-none placeholder:text-[var(--fg-subtle)]"

/** The writer's structured defense of a FAIL vote or an employee rejection */
export function CounterDialog({
  open,
  onOpenChange,
  draftId,
  target,
  originalReason,
  reviewerLabel,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  draftId: string
  /** Panel vote id, or "employee" */
  target: string
  originalReason: string
  reviewerLabel: string
}) {
  const submitCounter = useUIStore((s) => s.submitCounter)
  const [reason, setReason] = useState("")
  const [clarification, setClarification] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const remaining = Math.max(0, COUNTER_REASON_MIN - reason.trim().length)

  const submit = () => {
    setBusy(true)
    const res = submitCounter(draftId, target, reason, clarification)
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    toast("Counter-reason submitted. The reviewer has been notified.", { tone: "success" })
    setReason("")
    setClarification("")
    onOpenChange(false)
  }

  return (
    <StudioDialog
      open={open}
      onOpenChange={onOpenChange}
      className="max-w-xl"
      title="Submit a counter-reason"
      description="Explain why your point or method holds up. Cite evidence where you can. The reviewer reads this next to their original reason and can flip their decision."
    >
      <figure className="mt-5 rounded-[12px] border border-slate-200 bg-slate-50 p-4">
        <figcaption className="meta">{reviewerLabel} · original reason</figcaption>
        <blockquote className="mt-1.5 text-sm text-[var(--fg-secondary)] leading-relaxed whitespace-pre-line">{originalReason}</blockquote>
      </figure>

      <label className="mt-5 block">
        <span className="text-sm font-medium">Your counter-reason</span>
        <textarea
          value={reason}
          onChange={(e) => {
            setReason(e.target.value)
            setError("")
          }}
          rows={6}
          maxLength={TEXT_MAX}
          autoFocus
          placeholder="e.g. The claim is supported in section 3 by two independent datasets (links below). The anecdote illustrates it; it isn't the evidence."
          className={fieldClass}
        />
        <span className="mt-1 flex justify-between text-xs text-[var(--fg-muted)]">
          <span>{remaining > 0 ? `${remaining} more characters needed` : "Ready to submit"}</span>
          <span className="tabular-nums">
            {reason.length}/{TEXT_MAX}
          </span>
        </span>
      </label>

      <label className="mt-4 block">
        <span className="text-sm font-medium">
          Minor clarification to the article <span className="font-normal text-[var(--fg-muted)]">(optional)</span>
        </span>
        <textarea
          value={clarification}
          onChange={(e) => setClarification(e.target.value)}
          rows={3}
          maxLength={TEXT_MAX}
          placeholder="A sentence or citation you'd add if the vote flips. Shown to the reviewer."
          className={fieldClass}
        />
      </label>

      {error && (
        <p role="alert" className="mt-2 text-sm text-[var(--error)]">
          {error}
        </p>
      )}
      <DialogActions>
        <Button variant="secondary" size="lg" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          size="lg"
          className="bg-indigo-600 text-white hover:bg-indigo-700"
          onClick={submit}
          disabled={busy || remaining > 0}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Submit counter-reason
        </Button>
      </DialogActions>
    </StudioDialog>
  )
}
