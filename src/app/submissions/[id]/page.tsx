"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, ExternalLink, FileQuestion, MessageSquareReply, PenLine, ShieldCheck } from "lucide-react"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { useHydrated } from "@/components/studio/useHydrated"
import { AIHumanGauge, StatusPill } from "@/components/moderation/Phase1Report"
import { PanelScorecard, ReconsiderationNote } from "@/components/panel/Scorecard"
import { CounterDialog } from "@/components/panel/CounterDialog"
import { findAccount } from "@/lib/data"
import { STATUS_META } from "@/lib/moderation/workflow"
import { useUIStore, type Draft } from "@/lib/store"
import { formatRelativeDate } from "@/lib/utils"

const pill = "inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-full text-sm font-medium transition-colors"

// Where a submission stands: Phase 1 score, then the employee decision or the peer-panel
// scorecard, with a counter-reason (appeal) option on every FAIL and on employee rejections.
export default function SubmissionPage() {
  const { id } = useParams<{ id: string }>()
  const hydrated = useHydrated()
  const draft = useUIStore((s) => s.drafts[id])
  const currentUser = useUIStore((s) => s.currentUser)
  const asAuthor = !!draft && draft.authorUsername === currentUser

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <SiteHeader />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-24">
        {!hydrated ? (
          <div className="space-y-4" aria-busy="true" aria-label="Loading submission">
            <div className="h-10 w-64 rounded-[14px] bg-[var(--surface)] animate-pulse" />
            <div className="h-64 rounded-[var(--radius-card)] bg-[var(--surface)] animate-pulse" />
          </div>
        ) : !draft || !asAuthor ? (
          <NotFound />
        ) : (
          <Submission draft={draft} />
        )}
      </main>
      <SiteFooter />
    </div>
  )
}

function Submission({ draft }: { draft: Draft }) {
  const title = (draft.submitted?.title ?? draft.title).trim() || "Untitled story"
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/profile#tracker"
          className="inline-flex items-center gap-1 h-10 pl-2 pr-3 rounded-full text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--panel)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Submission tracker
        </Link>
        <div className="flex gap-2">
          {draft.live && (
            <Link href={`/story/${draft.id}`} className={`${pill} border border-[var(--border)] bg-[var(--panel)] hover:border-[var(--border-strong)]`}>
              <ExternalLink className="w-4 h-4" /> View live
            </Link>
          )}
          <Link href={`/editor/${draft.id}`} className={`${pill} bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--fg-secondary)]`}>
            <PenLine className="w-4 h-4" /> Open in editor
          </Link>
        </div>
      </div>

      <header className="mt-8">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={draft.status} tracker />
          <span className="meta">{draft.track === "PEER_PANEL" ? "AI check → employee → peer panel" : "AI check → employee review"}</span>
        </div>
        <h1 className="display mt-4 text-[2rem] sm:text-[2.75rem] leading-[1.02] break-words">{title}</h1>
        <p className="mt-3 text-sm text-[var(--fg-muted)]">
          {draft.submittedAt ? `Submitted ${formatRelativeDate(draft.submittedAt)} · ` : ""}
          {STATUS_META[draft.status].tracker}
        </p>
      </header>

      {draft.phase1 && (
        <section className="mt-8 panel p-5 sm:p-6" aria-label="Phase 1 result">
          <p className="meta mb-4">Phase 1 · AI-content check</p>
          <AIHumanGauge aiPercent={draft.phase1.aiPercent} threshold={draft.phase1.threshold} />
        </section>
      )}

      <div className="mt-6">
        <EmployeeDecision draft={draft} />
      </div>
      <div className="mt-6">
        {draft.panel ? (
          <PanelScorecard draft={draft} asAuthor />
        ) : (
          draft.track === "PEER_PANEL" && (
            <section className="panel p-5 sm:p-6" aria-label="Phase 3 peer panel">
              <p className="meta">Phase 3 · Peer panel</p>
              <p className="mt-2 text-sm text-[var(--fg-muted)]">
                Once the employee approves, a 10-member peer panel is drawn and votes PASS/FAIL.
              </p>
            </section>
          )
        )}
      </div>
    </>
  )
}

function EmployeeDecision({ draft }: { draft: Draft }) {
  const [open, setOpen] = useState(false)
  const appeal = draft.appeal
  const rejection = appeal ? { reviewer: appeal.rejectedBy, notes: appeal.rejectionNotes } : draft.review?.decision === "REJECTED" ? draft.review : null
  const reviewer = findAccount(rejection?.reviewer ?? draft.review?.reviewer)
  const canAppeal = draft.status === "REJECTED" && draft.review?.decision === "REJECTED" && !appeal

  return (
    <section className="panel p-5 sm:p-6" aria-labelledby="employee-title">
      <p className="meta">Phase 2 · Employee review</p>
      <h2 id="employee-title" className="display mt-1 text-[1.6rem]">
        Reviewer decision
      </h2>
      {draft.status === "PENDING_EMPLOYEE_REVIEW" ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-[var(--fg-muted)]">
          <ShieldCheck className="w-4 h-4" /> Waiting for a Prism reviewer.
        </p>
      ) : rejection ? (
        <>
          <figure className="mt-4">
            <figcaption className="text-xs text-[var(--fg-muted)]">
              Rejected by {reviewer?.displayName ?? "a Prism reviewer"}
            </figcaption>
            <blockquote className="mt-1.5 pl-3 border-l-2 border-rose-200 text-sm text-[var(--fg-secondary)] leading-relaxed whitespace-pre-line">
              {rejection.notes}
            </blockquote>
          </figure>
          {appeal && <ReconsiderationNote counter={appeal.counter} reconsideration={appeal.reconsideration} />}
          {canAppeal && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-sm font-medium border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 transition-colors"
            >
              <MessageSquareReply className="w-4 h-4" /> Submit Counter-Reason / Appeal
            </button>
          )}
          <CounterDialog
            open={open}
            onOpenChange={setOpen}
            draftId={draft.id}
            target="employee"
            originalReason={rejection.notes}
            reviewerLabel={reviewer?.displayName ?? "Reviewer"}
          />
        </>
      ) : draft.review ? (
        <p className="mt-4 text-sm text-[var(--fg-muted)]">
          Approved by {reviewer?.displayName ?? "a Prism reviewer"} {formatRelativeDate(draft.review.at)}.
        </p>
      ) : (
        <p className="mt-4 text-sm text-[var(--fg-muted)]">Not submitted for review yet.</p>
      )}
    </section>
  )
}

function NotFound() {
  return (
    <div className="max-w-xl mx-auto py-20 text-center">
      <span className="mx-auto grid place-items-center w-14 h-14 rounded-full bg-[var(--surface)] text-[var(--fg-muted)]">
        <FileQuestion className="w-6 h-6" />
      </span>
      <h1 className="display mt-6 text-[2rem]">Submission not found</h1>
      <p className="mt-3 text-[var(--fg-muted)]">Only the author can see a submission&apos;s scorecard.</p>
      <Link href="/profile#tracker" className={`${pill} mt-8 h-11 px-6 bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--fg-secondary)]`}>
        Go to your tracker
      </Link>
    </div>
  )
}
