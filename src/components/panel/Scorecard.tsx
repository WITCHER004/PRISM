"use client"

import { useState } from "react"
import { CircleCheck, CircleX, Clock, MessageSquareReply, Scale } from "lucide-react"
import { findAccount } from "@/lib/data"
import { PANEL_PASS_THRESHOLD, PANEL_SIZE } from "@/lib/elite/config"
import { canCounterVote, reconsiderationStatus, tallyPanel, type CounterReason, type PanelVote, type Reconsideration } from "@/lib/elite/panel"
import type { Draft } from "@/lib/store"
import { cn, formatRelativeDate } from "@/lib/utils"
import { CounterDialog } from "./CounterDialog"

/** Ten squares: emerald = PASS, rose = FAIL, outline = not yet voted */
export function PanelMeter({ votes, className }: { votes: readonly PanelVote[]; className?: string }) {
  const t = tallyPanel(votes)
  return (
    <div className={className}>
      <div
        role="img"
        aria-label={`${t.pass} pass, ${t.fail} fail, ${t.pending} not voted. ${PANEL_PASS_THRESHOLD} passes publish.`}
        className="flex gap-1"
      >
        {[...votes]
          .sort((a, b) => rank(a) - rank(b))
          .map((v) => (
            <span
              key={v.id}
              className={cn(
                "h-3 flex-1 rounded-[3px]",
                v.decision === "PASS" ? "bg-emerald-500" : v.decision === "FAIL" ? "bg-rose-400" : "border border-dashed border-slate-300"
              )}
            />
          ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--fg-muted)]">
        <span className="tabular-nums">
          <b className="text-emerald-700">{t.pass} pass</b> · <b className="text-rose-700">{t.fail} fail</b> · {t.pending} pending
        </span>
        <span>
          {PANEL_PASS_THRESHOLD} of {PANEL_SIZE} needed
        </span>
      </div>
    </div>
  )
}

const rank = (v: PanelVote) => (v.decision === "PASS" ? 0 : v.decision === "FAIL" ? 1 : 2)

/** Panelists are shown to the writer by number and field, not by name */
export function panelistLabel(votes: readonly PanelVote[], vote: PanelVote) {
  const n = votes.findIndex((v) => v.id === vote.id) + 1
  const field = findAccount(vote.reviewer)?.bio.replace(/^Peer panel reviewer · /, "").replace(/\.$/, "")
  return `Panelist ${n}${field ? ` · ${field}` : ""}`
}

export function ReconsiderationNote({ counter, reconsideration }: { counter?: CounterReason; reconsideration?: Reconsideration }) {
  if (!counter) return null
  const status = reconsiderationStatus({ counter, reconsideration })
  return (
    <div className="mt-3 rounded-[12px] border border-indigo-100 bg-indigo-50/60 p-3.5">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-indigo-800">
        <MessageSquareReply className="w-3.5 h-3.5" /> Your counter-reason · {formatRelativeDate(counter.submittedAt)}
      </p>
      <p className="mt-1 text-sm text-slate-700 leading-relaxed whitespace-pre-line">{counter.reason}</p>
      {counter.clarification && (
        <p className="mt-2 text-xs text-slate-600">
          <span className="font-semibold">Clarification:</span> {counter.clarification}
        </p>
      )}
      <div className="mt-2.5 pt-2.5 border-t border-indigo-100 text-xs">
        {status === "PENDING" ? (
          <span className="inline-flex items-center gap-1 text-slate-600">
            <Clock className="w-3.5 h-3.5" /> Awaiting reconsideration
          </span>
        ) : status === "ACCEPTED" ? (
          <span className="text-emerald-700">
            <b>Accepted</b> — the vote was flipped to PASS{reconsideration?.note ? `: “${reconsideration.note}”` : "."}
          </span>
        ) : (
          <span className="text-slate-700">
            <b>Upheld</b> — “{reconsideration?.note}”
          </span>
        )}
      </div>
    </div>
  )
}

/** The writer's view of the 10-member panel: every vote, every FAIL reason, and an appeal per FAIL */
export function PanelScorecard({ draft, asAuthor }: { draft: Draft; asAuthor: boolean }) {
  const votes = draft.panel ?? []
  const [appealing, setAppealing] = useState<PanelVote | null>(null)
  const t = tallyPanel(votes)

  return (
    <section className="panel p-5 sm:p-6" aria-labelledby="scorecard-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="meta">Phase 2 · Peer panel</p>
          <h2 id="scorecard-title" className="display mt-1 text-[1.6rem]">
            Peer Panel Scorecard
          </h2>
        </div>
        <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-slate-200 bg-slate-50 text-sm text-slate-700">
          <Scale className="w-4 h-4" />
          {t.complete ? (t.consensus ? "Consensus reached" : "No consensus") : `${t.total - t.pending}/${t.total} voted`}
        </span>
      </div>

      <PanelMeter votes={votes} className="mt-5" />

      <ul className="mt-6 divide-y divide-[var(--border)] border-y border-[var(--border)]">
        {votes.map((v) => {
          const appealable = asAuthor && canCounterVote(v, draft.status)
          return (
            <li key={v.id} className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{panelistLabel(votes, v)}</p>
                <VoteChip vote={v} />
              </div>
              {v.originalDecision === "FAIL" || v.decision === "FAIL" ? (
                v.failureReason && (
                  <blockquote className="mt-2 pl-3 border-l-2 border-rose-200 text-sm text-[var(--fg-secondary)] leading-relaxed whitespace-pre-line">
                    {v.failureReason}
                  </blockquote>
                )
              ) : null}
              <ReconsiderationNote counter={v.counter} reconsideration={v.reconsideration} />
              {appealable && (
                <button
                  type="button"
                  onClick={() => setAppealing(v)}
                  className="mt-3 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-sm font-medium border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 transition-colors"
                >
                  <MessageSquareReply className="w-4 h-4" /> Submit Counter-Reason / Appeal
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {asAuthor && draft.status === "PENDING_PEER_PANEL" && (
        <p className="mt-4 text-sm text-[var(--fg-muted)]">You can appeal FAIL votes once all {PANEL_SIZE} members have voted.</p>
      )}

      {appealing && (
        <CounterDialog
          open
          onOpenChange={(o) => !o && setAppealing(null)}
          draftId={draft.id}
          target={appealing.id}
          originalReason={appealing.failureReason ?? ""}
          reviewerLabel={panelistLabel(votes, appealing)}
        />
      )}
    </section>
  )
}

export function VoteChip({ vote }: { vote: PanelVote }) {
  if (!vote.decision)
    return (
      <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full border border-dashed border-slate-300 text-xs text-slate-500">
        <Clock className="w-3 h-3" /> Not voted
      </span>
    )
  const flipped = vote.originalDecision === "FAIL" && vote.decision === "PASS"
  return vote.decision === "PASS" ? (
    <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full border border-emerald-200 bg-emerald-50 text-xs font-medium text-emerald-700">
      <CircleCheck className="w-3 h-3" /> {flipped ? "PASS (flipped)" : "PASS"}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full border border-rose-200 bg-rose-50 text-xs font-medium text-rose-700">
      <CircleX className="w-3 h-3" /> FAIL
    </span>
  )
}
