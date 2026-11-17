"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { CheckCircle2, Clock, Inbox, Loader2, MessageSquareWarning } from "lucide-react"
import { StoryArticle } from "@/components/studio/StoryArticle"
import { StudioDialog, DialogActions } from "@/components/studio/StudioDialog"
import { Phase1Breakdown, StatusPill } from "@/components/moderation/Phase1Report"
import { IntegrityScores } from "@/components/panel/IntegrityScores"
import { useIdentity, userOfIdentity } from "@/components/profile/identity"
import { Avatar } from "@/components/ui/Avatar"
import { Button } from "@/components/ui/Button"
import { findAccount } from "@/lib/data"
import { reconsiderationStatus } from "@/lib/elite/panel"
import { CountersTab, PanelTab } from "@/components/panel/ReviewerTabs"
import { useUIStore, toast, type Draft } from "@/lib/store"
import { dur, ease } from "@/lib/motion"
import { cn, formatRelativeDate } from "@/lib/utils"
import { wordCount } from "@/components/studio/studio-ui"

type Filter = "queue" | "decided"
type Tab = Filter | "panel" | "counters"

/**
 * Admin portal: Phase 2 verification. Free and Elite articles that passed the ≤ 20% AI check wait
 * here for an employee to publish, reject, or (Elite) send on to the panel. Staff also oversee
 * panels and rule on counter-reasons to employee rejections. Every action is taken as `actor`,
 * the admin-portal session.
 */
export function VerificationWorkspace({ actor }: { actor: string }) {
  const drafts = useUIStore((s) => s.drafts)
  const [tab, setTab] = useState<Tab>("queue")

  // Deep links from notifications: /admin/verification?tab=counters
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab")
    if (t === "panel" || t === "counters" || t === "queue" || t === "decided") setTab(t)
  }, [])

  const counts = useMemo(() => {
    const all = Object.values(drafts)
    let counters = 0
    for (const d of all) {
      if (d.status !== "COUNTER_SUBMITTED") continue
      counters += (d.panel ?? []).filter((v) => reconsiderationStatus(v) === "PENDING").length
      if (d.appeal && reconsiderationStatus(d.appeal) === "PENDING") counters++
    }
    return {
      queue: all.filter((d) => d.status === "PENDING_EMPLOYEE_REVIEW").length,
      decided: all.filter((d) => d.review && d.status !== "PENDING_EMPLOYEE_REVIEW").length,
      panel: all.filter((d) => d.status === "PENDING_PEER_PANEL" && d.panel?.some((v) => !v.decision)).length,
      counters,
    }
  }, [drafts])

  const tabs: { value: Tab; label: string; count: number }[] = [
    { value: "queue", label: "Awaiting verification", count: counts.queue },
    { value: "panel", label: "Panel oversight", count: counts.panel },
    { value: "counters", label: "Counter-reasons", count: counts.counters },
    { value: "decided", label: "Decided", count: counts.decided },
  ]

  return (
    <>
      <div role="tablist" aria-label="Verification sections" className="flex items-center gap-1 border-b border-[var(--border)] overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.value}
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              "relative h-11 px-4 text-sm font-medium whitespace-nowrap transition-colors",
              tab === t.value ? "text-[var(--fg)]" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
            )}
          >
            {t.label} <span className="ml-1 meta tabular-nums">{t.count}</span>
            {tab === t.value && <span className="absolute left-2 right-2 -bottom-px h-[2px] rounded-full bg-[var(--fg)]" />}
          </button>
        ))}
      </div>

      {tab === "panel" ? (
        <PanelTab me={actor} staff />
      ) : tab === "counters" ? (
        <CountersTab me={actor} staff actor={actor} />
      ) : (
        <Queue reviewer={actor} filter={tab} />
      )}
    </>
  )
}

function Queue({ reviewer, filter }: { reviewer: string; filter: Filter }) {
  const drafts = useUIStore((s) => s.drafts)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const pending = useMemo(
    () =>
      Object.values(drafts)
        .filter((d) => d.status === "PENDING_EMPLOYEE_REVIEW")
        .sort((a, b) => (a.submittedAt ?? a.updatedAt).localeCompare(b.submittedAt ?? b.updatedAt)),
    [drafts]
  )
  const decided = useMemo(
    () =>
      Object.values(drafts)
        .filter((d) => d.review && d.status !== "PENDING_EMPLOYEE_REVIEW")
        .sort((a, b) => b.review!.at.localeCompare(a.review!.at)),
    [drafts]
  )
  const list = filter === "queue" ? pending : decided
  const selected = list.find((d) => d.id === selectedId) ?? list[0]

  // Keep a selection when the list changes (e.g. after a decision removes the current item)
  useEffect(() => {
    if (selectedId && !list.some((d) => d.id === selectedId)) setSelectedId(list[0]?.id ?? null)
  }, [list, selectedId])

  const oldest = pending[0]?.submittedAt

  return (
    <>
      {filter === "queue" && pending.length > 0 && (
        <p className="mt-4 text-sm text-[var(--fg-muted)]">
          {pending.length} waiting · oldest {oldest ? formatRelativeDate(oldest) : "–"}
        </p>
      )}
      {list.length === 0 ? (
        <div className="mt-6 panel px-6 py-16 text-center">
          <span className="mx-auto grid place-items-center w-12 h-12 rounded-full bg-[var(--surface)] text-[var(--fg-muted)]">
            <Inbox className="w-5 h-5" />
          </span>
          <p className="mt-4 font-semibold">{filter === "queue" ? "Queue is clear" : "No decisions yet"}</p>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            {filter === "queue"
              ? "Free and Elite submissions appear here as soon as they pass the AI check."
              : "Stories you approve or send back are listed here."}
          </p>
        </div>
      ) : (
        <div className="mt-6 grid lg:grid-cols-[320px_minmax(0,1fr)] gap-6 items-start">
          <ul className="space-y-2 lg:sticky lg:top-24" aria-label={filter === "queue" ? "Waiting for review" : "Decided"}>
            {list.map((d) => (
              <li key={d.id}>
                <QueueItem draft={d} active={selected?.id === d.id} onSelect={() => setSelectedId(d.id)} />
              </li>
            ))}
          </ul>
          {selected && <ReviewPanel key={selected.id} draft={selected} reviewer={reviewer} />}
        </div>
      )}
    </>
  )
}

function QueueItem({ draft, active, onSelect }: { draft: Draft; active: boolean; onSelect: () => void }) {
  const author = useIdentity(draft.authorUsername)
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active}
      className={cn(
        "w-full text-left p-4 rounded-[16px] border transition-colors",
        active ? "border-[var(--fg)] bg-[var(--panel)]" : "border-[var(--border)] bg-[var(--panel)] hover:border-[var(--border-strong)]"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <StatusPill status={draft.status} />
        {draft.phase1 && <span className="text-xs tabular-nums text-[var(--fg-muted)]">{Math.round(draft.phase1.humanPercent)}% human</span>}
      </div>
      <p className="mt-2 font-semibold leading-snug line-clamp-2">{draft.title.trim() || "Untitled story"}</p>
      <div className="mt-2 flex items-center gap-2 text-xs text-[var(--fg-muted)]">
        <Avatar src={author?.avatarUrl} alt={author?.displayName ?? ""} size="xs" />
        <span className="truncate">{author?.displayName}</span>
        <span aria-hidden>·</span>
        <Clock className="w-3 h-3 shrink-0" />
        <span className="whitespace-nowrap">{formatRelativeDate(draft.review?.at ?? draft.submittedAt ?? draft.updatedAt)}</span>
      </div>
    </button>
  )
}

function ReviewPanel({ draft, reviewer }: { draft: Draft; reviewer: string }) {
  const decideReview = useUIStore((s) => s.decideReview)
  const author = useIdentity(draft.authorUsername)
  const decidedBy = findAccount(draft.review?.reviewer)
  const [mode, setMode] = useState<null | "approve" | "reject">(null)
  // Elite submissions continue to the peer panel after the employee approves
  const toPanel = draft.track === "PEER_PANEL"
  const [notes, setNotes] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const pending = draft.status === "PENDING_EMPLOYEE_REVIEW"
  const ownStory = draft.authorUsername === reviewer

  const decide = () => {
    if (!mode) return
    setBusy(true)
    const res = decideReview(draft.id, mode === "approve" ? "APPROVED" : "REJECTED", notes, reviewer)
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    toast(mode === "approve" ? (toPanel ? "Approved. Sent to the 10-member peer panel" : "Approved and published") : "Sent back to the author with your notes", {
      tone: "success",
      action: mode === "approve" && !toPanel ? { label: "View", href: `/story/${draft.id}` } : undefined,
    })
    setMode(null)
  }

  return (
    <div className="grid xl:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start min-w-0">
      {/* Article preview */}
      <article className="panel p-5 sm:p-8 min-w-0" aria-label="Article preview">
        <p className="meta mb-6">
          Submitted {formatRelativeDate(draft.submittedAt ?? draft.updatedAt)} · {wordCount(draft.contentHtml)} words
          {draft.live && " · update to a published story"}
        </p>
        {author && (
          <StoryArticle
            title={draft.title}
            subtitle={draft.subtitle}
            html={draft.contentHtml}
            tags={draft.tags}
            paywall={draft.paywall}
            // No postId: reviewers always read the whole paper
            paper={draft.paper}
            date={draft.submittedAt ?? draft.updatedAt}
            author={userOfIdentity(author)}
            authorName={author.displayName}
          />
        )}
      </article>

      {/* Decision rail */}
      <aside className="space-y-4 xl:sticky xl:top-24">
        <IntegrityScores draft={draft} />
        <section className="panel p-5" aria-labelledby={`p1-${draft.id}`}>
          <h2 id={`p1-${draft.id}`} className="font-display text-lg font-semibold tracking-tight">
            Phase 1 report
          </h2>
          <div className="mt-4">
            {draft.phase1 ? <Phase1Breakdown report={draft.phase1} compact /> : <p className="text-sm text-[var(--fg-muted)]">No report on file.</p>}
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="font-display text-lg font-semibold tracking-tight">Decision</h2>
          {pending ? (
            ownStory ? (
              <p className="mt-3 text-sm text-[var(--fg-muted)]">You wrote this story, so another reviewer has to decide it.</p>
            ) : (
              <div className="mt-4 flex flex-col gap-2">
                <Button variant="accent" size="lg" onClick={() => { setMode("approve"); setNotes(""); setError("") }}>
                  <CheckCircle2 className="w-4 h-4" /> {toPanel ? "Approve & send to panel" : "Approve & publish"}
                </Button>
                <Button variant="outline" size="lg" onClick={() => { setMode("reject"); setNotes(""); setError("") }}>
                  <MessageSquareWarning className="w-4 h-4" /> Reject
                </Button>
              </div>
            )
          ) : draft.review ? (
            <div className="mt-3 space-y-2">
              <StatusPill status={draft.review.decision === "APPROVED" ? "PUBLISHED" : "REJECTED"} />
              {draft.review.notes && (
                <blockquote className="pl-3 border-l-2 border-[var(--border-strong)] text-sm text-[var(--fg-secondary)] whitespace-pre-line">
                  {draft.review.notes}
                </blockquote>
              )}
              <p className="text-xs text-[var(--fg-muted)]">
                {decidedBy?.displayName ?? draft.review.reviewer} · {formatRelativeDate(draft.review.at)}
              </p>
              {draft.live && (
                <Link href={`/story/${draft.id}`} className="inline-block text-sm underline underline-offset-2">
                  View live story
                </Link>
              )}
            </div>
          ) : null}
        </section>
      </aside>

      <StudioDialog
        open={mode !== null}
        onOpenChange={(o) => !o && setMode(null)}
        title={mode === "approve" ? (toPanel ? "Send to the peer panel?" : "Publish this story?") : "Reject with feedback"}
        description={
          mode === "approve" && toPanel
            ? `“${draft.title.trim() || "Untitled story"}” is by an Elite writer, so approving it sends it to a 10-member peer panel. It publishes when 7 of 10 vote PASS.`
            : mode === "approve"
            ? `“${draft.title.trim() || "Untitled story"}” goes live for readers right away${draft.live ? ", replacing the published version" : ""}, and ${author?.displayName ?? "the author"} is notified.`
            : `The story goes back to ${author?.displayName ?? "the author"} marked “Rejected”, with your notes. They can revise and resubmit, or appeal with a counter-reason.`
        }
      >
        <label className="mt-5 block">
          <span className="text-sm font-medium">{mode === "approve" ? "Note to the author (optional)" : "Feedback for the author (required)"}</span>
          <textarea
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value)
              setError("")
            }}
            rows={5}
            maxLength={2000}
            autoFocus
            placeholder={
              mode === "approve"
                ? "Anything you'd like them to know."
                : "Be specific: which sections, what's missing, what reads as generated."
            }
            className="mt-2 w-full p-3.5 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-sm leading-relaxed resize-y focus:border-[var(--fg)] outline-none placeholder:text-[var(--fg-subtle)]"
          />
        </label>
        <AnimatePresence>
          {error && (
            <motion.p
              role="alert"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0, transition: { duration: dur.fast, ease: ease.out } }}
              exit={{ opacity: 0 }}
              className="mt-2 text-sm text-[var(--error)]"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
        <DialogActions>
          <Button variant="secondary" size="lg" onClick={() => setMode(null)}>
            Cancel
          </Button>
          <Button variant={mode === "approve" ? "accent" : "primary"} size="lg" onClick={decide} disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "approve" ? "Approve & publish" : "Reject with feedback"}
          </Button>
        </DialogActions>
      </StudioDialog>
    </div>
  )
}
