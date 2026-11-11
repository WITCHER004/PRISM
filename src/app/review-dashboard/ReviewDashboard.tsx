"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { CheckCircle2, Clock, Inbox, Loader2, MessageSquareWarning, ShieldCheck, ShieldX, Users } from "lucide-react"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { useHydrated } from "@/components/studio/useHydrated"
import { StoryArticle } from "@/components/studio/StoryArticle"
import { StudioDialog, DialogActions } from "@/components/studio/StudioDialog"
import { Phase1Breakdown, StatusPill } from "@/components/moderation/Phase1Report"
import { useIdentity } from "@/components/profile/identity"
import { Avatar } from "@/components/ui/Avatar"
import { Button } from "@/components/ui/Button"
import { findAccount, MOCK_USERS, PEER_REVIEWERS } from "@/lib/data"
import { canOpenReviewDashboard, canReview } from "@/lib/moderation/workflow"
import { reconsiderationStatus } from "@/lib/elite/panel"
import { CountersTab, PanelTab } from "@/components/panel/ReviewerTabs"
import { useUIStore, toast, type Draft } from "@/lib/store"
import { dur, ease } from "@/lib/motion"
import { cn, formatRelativeDate } from "@/lib/utils"
import { wordCount } from "@/components/studio/studio-ui"

type Filter = "queue" | "decided"
type Tab = Filter | "panel" | "counters"
const REVIEWER_DEMO = MOCK_USERS.find((u) => u.role === "EMPLOYEE")!
const PANEL_DEMO = PEER_REVIEWERS[0]

export function ReviewDashboard() {
  const hydrated = useHydrated()
  const currentUser = useUIStore((s) => s.currentUser)
  const role = findAccount(currentUser)?.role

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <SiteHeader />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-24">
        {!hydrated ? (
          <div className="space-y-4" aria-busy="true" aria-label="Loading review queue">
            <div className="h-12 w-72 rounded-[14px] bg-[var(--surface)] animate-pulse" />
            <div className="h-64 rounded-[var(--radius-card)] bg-[var(--surface)] animate-pulse" />
          </div>
        ) : canOpenReviewDashboard(role) ? (
          <Workspace me={currentUser!} staff={canReview(role)} />
        ) : (
          <AccessGate signedIn={!!currentUser} />
        )}
      </main>
      <SiteFooter />
    </div>
  )
}

function AccessGate({ signedIn }: { signedIn: boolean }) {
  const setCurrentUser = useUIStore((s) => s.setCurrentUser)
  return (
    <div className="max-w-lg mx-auto text-center py-16">
      <span className="mx-auto grid place-items-center w-14 h-14 rounded-full bg-[var(--surface)] text-[var(--fg-muted)]">
        <ShieldX className="w-6 h-6" />
      </span>
      <p className="meta mt-6">Employees only</p>
      <h1 className="display mt-3 text-[2rem] sm:text-[2.5rem]">The review queue is for Prism staff</h1>
      <p className="mt-3 text-[var(--fg-muted)] leading-relaxed">
        {signedIn
          ? "Your account doesn't have the reviewer role. Stories you submit show up here for our editors."
          : "Sign in with a staff account to review submitted stories."}
      </p>
      <div className="mt-8 rounded-[16px] border border-dashed border-[var(--border-strong)] p-5 text-left">
        <p className="text-sm font-semibold">Demo mode</p>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          Switch to the sample staff account, {REVIEWER_DEMO.displayName}, to try the employee side. Switch back from the account menu.
        </p>
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              setCurrentUser(REVIEWER_DEMO.username)
              toast(`Signed in as ${REVIEWER_DEMO.displayName} (reviewer)`, { tone: "success" })
            }}
          >
            <ShieldCheck className="w-4 h-4" /> Continue as {REVIEWER_DEMO.displayName}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => {
              setCurrentUser(PANEL_DEMO.username)
              toast(`Signed in as ${PANEL_DEMO.displayName} (peer panel)`, { tone: "success" })
            }}
          >
            <Users className="w-4 h-4" /> {PANEL_DEMO.displayName} (panel)
          </Button>
        </div>
      </div>
    </div>
  )
}

function Workspace({ me, staff }: { me: string; staff: boolean }) {
  const drafts = useUIStore((s) => s.drafts)
  const [tab, setTab] = useState<Tab>(staff ? "queue" : "panel")

  // Deep links from notifications: /review-dashboard?tab=panel|counters
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab")
    if (t === "panel" || t === "counters" || (staff && (t === "queue" || t === "decided"))) setTab(t)
  }, [staff])

  const counts = useMemo(() => {
    const all = Object.values(drafts)
    let counters = 0
    for (const d of all) {
      if (d.status !== "COUNTER_SUBMITTED" || d.authorUsername === me) continue
      counters += (d.panel ?? []).filter((v) => reconsiderationStatus(v) === "PENDING" && (staff || v.reviewer === me)).length
      if (staff && d.appeal && reconsiderationStatus(d.appeal) === "PENDING") counters++
    }
    return {
      queue: all.filter((d) => d.status === "PENDING_EMPLOYEE_REVIEW").length,
      decided: all.filter((d) => d.review && d.status !== "PENDING_EMPLOYEE_REVIEW").length,
      panel: all.filter(
        (d) => d.status === "PENDING_PEER_PANEL" && d.panel?.some((v) => (staff ? !v.decision : v.reviewer === me && !v.decision))
      ).length,
      counters,
    }
  }, [drafts, me, staff])

  const tabs: { value: Tab; label: string; count: number }[] = staff
    ? [
        { value: "queue", label: "Waiting", count: counts.queue },
        { value: "panel", label: "Peer panel", count: counts.panel },
        { value: "counters", label: "Counter-Reasons to Reconsider", count: counts.counters },
        { value: "decided", label: "Decided", count: counts.decided },
      ]
    : [
        { value: "panel", label: "Panel assignments", count: counts.panel },
        { value: "counters", label: "Counter-Reasons to Reconsider", count: counts.counters },
      ]

  return (
    <>
      <div className="max-w-2xl">
        <p className="meta">Phase 2 · {staff ? "Employee review & panel lead" : "Peer panel"}</p>
        <h1 className="display mt-3 text-[2.5rem] sm:text-[3.25rem]">Review dashboard</h1>
        <p className="mt-4 text-[var(--fg-muted)] text-base sm:text-lg leading-relaxed">
          {staff
            ? "Every story here passed the automated check (at most 20% AI). Publish it or send it back with notes, oversee Elite peer panels, and rule on writers' counter-reasons."
            : "Vote PASS or FAIL on the Elite papers you're assigned to. A FAIL needs a reason, and writers can answer it with a counter-reason you'll reconsider here."}
        </p>
      </div>

      <div role="tablist" aria-label="Review sections" className="mt-10 flex items-center gap-1 border-b border-[var(--border)] overflow-x-auto">
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
        <PanelTab me={me} staff={staff} />
      ) : tab === "counters" ? (
        <CountersTab me={me} staff={staff} />
      ) : (
        <Queue reviewer={me} filter={tab} />
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
              ? "New submissions appear here as soon as they pass Phase 1."
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
    const res = decideReview(draft.id, mode === "approve" ? "APPROVED" : "REJECTED", notes)
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
            date={draft.submittedAt ?? draft.updatedAt}
            author={{ ...(author.base ?? MOCK_USERS[0]), username: author.username, avatarUrl: author.avatarUrl }}
            authorName={author.displayName}
          />
        )}
      </article>

      {/* Decision rail */}
      <aside className="space-y-4 xl:sticky xl:top-24">
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
