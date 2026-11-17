"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, CircleCheck, CircleX, Inbox, Loader2, Scale, Users } from "lucide-react"
import { StoryArticle } from "@/components/studio/StoryArticle"
import { StudioDialog, DialogActions } from "@/components/studio/StudioDialog"
import { Phase1Breakdown, StatusPill } from "@/components/moderation/Phase1Report"
import { useIdentity, userOfIdentity } from "@/components/profile/identity"
import { Avatar } from "@/components/ui/Avatar"
import { Button } from "@/components/ui/Button"
import { findAccount } from "@/lib/data"
import { CLOSING_NOTE_MIN, FAILURE_REASON_MIN, TEXT_MAX } from "@/lib/elite/config"
import { passThreshold, REVIEW_CRITERIA, reconsiderationStatus, tallyPanel, type PanelVote, type ReviewCriterion } from "@/lib/elite/panel"
import { IntegrityScores } from "./IntegrityScores"
import { htmlToText } from "@/components/studio/studio-ui"
import { useUIStore, toast, type Draft } from "@/lib/store"
import { cn, formatRelativeDate } from "@/lib/utils"
import { PanelMeter, VoteChip } from "./Scorecard"
import { fieldClass } from "./CounterDialog"

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-6 panel px-6 py-16 text-center">
      <span className="mx-auto grid place-items-center w-12 h-12 rounded-full bg-[var(--surface)] text-[var(--fg-muted)]">
        <Inbox className="w-5 h-5" />
      </span>
      <p className="mt-4 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-[var(--fg-muted)]">{body}</p>
    </div>
  )
}

const versionOf = (d: Draft) => d.submitted ?? { title: d.title, subtitle: d.subtitle, contentHtml: d.contentHtml, tags: d.tags, paywall: d.paywall }

function Preview({ draft }: { draft: Draft }) {
  const author = useIdentity(draft.authorUsername)
  const v = versionOf(draft)
  if (!author) return null
  return (
    <article className="panel p-5 sm:p-8 min-w-0" aria-label="Article preview">
      <p className="meta mb-6">Submitted {formatRelativeDate(draft.submittedAt ?? draft.updatedAt)}</p>
      <StoryArticle
        title={v.title}
        subtitle={v.subtitle}
        html={v.contentHtml}
        tags={v.tags}
        paywall={v.paywall}
        date={draft.submittedAt ?? draft.updatedAt}
        author={userOfIdentity(author)}
        authorName={author.displayName}
      />
    </article>
  )
}

/* ── Peer panel: assignments (members) / overview (staff leads) ─────────────── */

export function PanelTab({ me, staff }: { me: string; staff: boolean }) {
  const drafts = useUIStore((s) => s.drafts)
  const papers = useMemo(
    () =>
      Object.values(drafts)
        .filter((d) => d.panel && (staff || d.panel.some((v) => v.reviewer === me)))
        .filter((d) => d.status === "PENDING_PEER_PANEL" || d.panel!.some((v) => v.reviewer === me && v.decision))
        .sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? "")),
    [drafts, me, staff]
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = papers.find((d) => d.id === selectedId) ?? papers[0]

  if (!papers.length)
    return (
      <Empty
        title="No panel papers"
        body={staff ? "Elite peer-panel submissions show up here." : "Papers you're assigned to appear here when an Elite writer submits."}
      />
    )

  return (
    <div className="mt-6 grid lg:grid-cols-[320px_minmax(0,1fr)] gap-6 items-start">
      <ul className="space-y-2 lg:sticky lg:top-24" aria-label="Panel papers">
        {papers.map((d) => {
          const mine = d.panel!.find((v) => v.reviewer === me)
          return (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => setSelectedId(d.id)}
                aria-current={selected?.id === d.id}
                className={cn(
                  "w-full text-left p-4 rounded-[16px] border bg-[var(--panel)] transition-colors",
                  selected?.id === d.id ? "border-[var(--fg)]" : "border-[var(--border)] hover:border-[var(--border-strong)]"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <StatusPill status={d.status} />
                  {mine ? <VoteChip vote={mine} /> : <span className="text-xs text-[var(--fg-muted)]">Panel lead</span>}
                </div>
                <p className="mt-2 font-semibold leading-snug line-clamp-2">{versionOf(d).title.trim() || "Untitled story"}</p>
                <PanelMeter votes={d.panel!} className="mt-3" />
              </button>
            </li>
          )
        })}
      </ul>
      {selected && <PanelPaper key={selected.id} draft={selected} me={me} staff={staff} />}
    </div>
  )
}

function PanelPaper({ draft, me, staff }: { draft: Draft; me: string; staff: boolean }) {
  const castPanelVote = useUIStore((s) => s.castPanelVote)
  const votes = draft.panel!
  const mine = votes.find((v) => v.reviewer === me)
  const [mode, setMode] = useState<null | "PASS" | "FAIL">(null)
  const [criterion, setCriterion] = useState<ReviewCriterion | null>(null)
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")
  const t = tallyPanel(votes)
  const open = draft.status === "PENDING_PEER_PANEL"

  const start = (m: "PASS" | "FAIL") => {
    setMode(m)
    setCriterion(null)
    setReason("")
    setError("")
  }

  const submit = () => {
    if (!mode) return
    if (!criterion) return setError("Pick the criterion your vote rests on.")
    const res = castPanelVote(draft.id, mode, reason, criterion)
    if (!res.ok) return setError(res.error)
    toast(mode === "PASS" ? `Approved (PASS) on ${criterion}` : `Rejected (FAIL) on ${criterion}, with your reason`, { tone: "success" })
    setMode(null)
  }
  const canSubmit = !!criterion && (mode === "PASS" || reason.trim().length >= FAILURE_REASON_MIN)

  return (
    <div className="grid xl:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start min-w-0">
      <Preview draft={draft} />
      <aside className="space-y-4 xl:sticky xl:top-24">
        <section className="panel p-5">
          <h2 className="font-display text-lg font-semibold tracking-tight flex items-center gap-2">
            <Users className="w-4 h-4" /> Panel ({votes.length})
          </h2>
          <PanelMeter votes={votes} className="mt-4" />
          {staff && (
            <ul className="mt-4 space-y-1.5 text-sm">
              {votes.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{findAccount(v.reviewer)?.displayName ?? v.reviewer}</span>
                  <VoteChip vote={v} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <IntegrityScores draft={draft} />

        {draft.phase1 && (
          <section className="panel p-5">
            <h2 className="font-display text-lg font-semibold tracking-tight">Phase 1 report</h2>
            <div className="mt-4">
              <Phase1Breakdown report={draft.phase1} compact />
            </div>
          </section>
        )}

        {mine && (
          <section className="panel p-5">
            <h2 className="font-display text-lg font-semibold tracking-tight">Your vote</h2>
            {mine.decision ? (
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <VoteChip vote={mine} />
                  {mine.criterion && (
                    <span className="inline-flex items-center h-6 px-2.5 rounded-full border border-[var(--border)] text-xs text-[var(--fg-secondary)]">
                      {mine.criterion}
                    </span>
                  )}
                </div>
                {mine.note && <p className="text-sm text-[var(--fg-secondary)] whitespace-pre-line">{mine.note}</p>}
                {mine.failureReason && (
                  <blockquote className="pl-3 border-l-2 border-rose-200 text-sm text-[var(--fg-secondary)] whitespace-pre-line">
                    {mine.failureReason}
                  </blockquote>
                )}
                {mine.decidedAt && <p className="text-xs text-[var(--fg-muted)]">{formatRelativeDate(mine.decidedAt)}</p>}
              </div>
            ) : open ? (
              <div className="mt-4 flex flex-col gap-2">
                <Button size="lg" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => start("PASS")}>
                  <CircleCheck className="w-4 h-4" /> Approve (Pass)
                </Button>
                <Button variant="outline" size="lg" onClick={() => start("FAIL")}>
                  <CircleX className="w-4 h-4" /> Reject (Fail)
                </Button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-[var(--fg-muted)]">Voting has closed.</p>
            )}
          </section>
        )}
      </aside>

      <StudioDialog
        open={mode !== null}
        onOpenChange={(o) => !o && setMode(null)}
        title={mode === "PASS" ? "Approve (Pass)" : "Reject (Fail)"}
        description={
          mode === "PASS"
            ? `Your vote counts toward the ${passThreshold(votes.length)} needed to publish. Votes can't be changed.`
            : "A FAIL vote must say why. The writer sees your reason (not your name) and can answer it with a counter-rebuttal."
        }
      >
        <fieldset className="mt-5">
          <legend className="text-sm font-medium">
            {mode === "PASS" ? "Strongest criterion" : "Failing criterion"} <span className="text-[var(--error)]">*</span>
          </legend>
          <div role="radiogroup" className="mt-2 grid grid-cols-2 gap-2">
            {REVIEW_CRITERIA.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={criterion === c}
                onClick={() => {
                  setCriterion(c)
                  setError("")
                }}
                className={cn(
                  "h-10 px-3 rounded-[10px] border text-sm text-left transition-colors",
                  criterion === c
                    ? mode === "PASS"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-900 font-medium"
                      : "border-rose-400 bg-rose-50 text-rose-900 font-medium"
                    : "border-[var(--border)] hover:border-[var(--border-strong)]"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="mt-4 block">
          <span className="text-sm font-medium">{mode === "FAIL" ? "Failure reason (required)" : "Note to the panel (optional)"}</span>
          <textarea
            value={reason}
            onChange={(e) => {
              setReason(e.target.value)
              setError("")
            }}
            rows={mode === "FAIL" ? 5 : 3}
            maxLength={TEXT_MAX}
            placeholder={mode === "FAIL" ? "Which claim, method or section fails, and what would fix it." : "What makes it hold up."}
            className={fieldClass}
          />
          {mode === "FAIL" && (
            <span className="mt-1 block text-xs text-[var(--fg-muted)]">
              {Math.max(0, FAILURE_REASON_MIN - reason.trim().length) > 0
                ? `${FAILURE_REASON_MIN - reason.trim().length} more characters needed`
                : "Ready"}
            </span>
          )}
        </label>
        {error && (
          <p role="alert" className="mt-2 text-sm text-[var(--error)]">
            {error}
          </p>
        )}
        <DialogActions>
          <Button variant="secondary" size="lg" onClick={() => setMode(null)}>
            Cancel
          </Button>
          <Button
            size="lg"
            className={mode === "PASS" ? "bg-emerald-600 text-white hover:bg-emerald-700" : undefined}
            variant={mode === "FAIL" ? "primary" : undefined}
            onClick={submit}
            disabled={!canSubmit}
          >
            {mode === "PASS" ? "Cast Approve vote" : "Cast Reject vote"}
          </Button>
        </DialogActions>
      </StudioDialog>
    </div>
  )
}

/* ── Counter-reasons to reconsider ────────────────────────────────────────── */

interface CounterItem {
  key: string
  draft: Draft
  target: string
  kind: "panel" | "employee"
  originalReason: string
  originalBy: string
  counter: NonNullable<PanelVote["counter"]>
}

export function CountersTab({ me, staff, actor }: { me: string; staff: boolean; actor?: string }) {
  const drafts = useUIStore((s) => s.drafts)
  const items = useMemo(() => {
    const out: CounterItem[] = []
    for (const d of Object.values(drafts)) {
      if (d.status !== "COUNTER_SUBMITTED" || d.authorUsername === me) continue
      for (const v of d.panel ?? []) {
        if (reconsiderationStatus(v) !== "PENDING" || !(staff || v.reviewer === me)) continue
        out.push({ key: v.id, draft: d, target: v.id, kind: "panel", originalReason: v.failureReason ?? "", originalBy: v.reviewer, counter: v.counter! })
      }
      if (staff && d.appeal && reconsiderationStatus(d.appeal) === "PENDING")
        out.push({
          key: `${d.id}:employee`,
          draft: d,
          target: "employee",
          kind: "employee",
          originalReason: d.appeal.rejectionNotes,
          originalBy: d.appeal.rejectedBy,
          counter: d.appeal.counter,
        })
    }
    return out.sort((a, b) => a.counter.submittedAt.localeCompare(b.counter.submittedAt))
  }, [drafts, me, staff])

  if (!items.length)
    return <Empty title="No counter-reasons waiting" body="When a writer appeals a FAIL vote or a rejection you made, it shows up here." />

  return (
    <ul className="mt-6 space-y-4">
      {items.map((it) => (
        <li key={it.key}>
          <CounterCard item={it} me={me} actor={actor} />
        </li>
      ))}
    </ul>
  )
}

function CounterCard({ item, me, actor }: { item: CounterItem; me: string; actor?: string }) {
  const reconsiderCounter = useUIStore((s) => s.reconsiderCounter)
  const author = useIdentity(item.draft.authorUsername)
  const [mode, setMode] = useState<null | "ACCEPT" | "UPHOLD">(null)
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const v = versionOf(item.draft)
  const excerpt = htmlToText(v.contentHtml).slice(0, 420)
  const by = findAccount(item.originalBy)
  const panelVotes = item.draft.panel
  const t = panelVotes ? tallyPanel(panelVotes) : null
  const publishesOnAccept = item.kind === "employee" || (t ? t.pass + 1 >= passThreshold(t.total) : false)

  useEffect(() => setError(""), [mode])

  const decide = () => {
    if (!mode) return
    setBusy(true)
    const res = reconsiderCounter(item.draft.id, item.target, mode, note, actor)
    setBusy(false)
    if (!res.ok) return setError(res.error)
    toast(
      mode === "ACCEPT"
        ? publishesOnAccept
          ? "Counter-reason accepted — consensus reached, article published"
          : "Counter-reason accepted — vote flipped to PASS"
        : "Original decision upheld; the writer has your closing note",
      { tone: "success" }
    )
    setMode(null)
  }

  return (
    <article className="panel p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar src={author?.avatarUrl} alt={author?.displayName ?? ""} size="sm" />
          <div className="min-w-0">
            <p className="font-semibold leading-snug truncate">{v.title.trim() || "Untitled story"}</p>
            <p className="text-xs text-[var(--fg-muted)]">
              {author?.displayName} · appealed {formatRelativeDate(item.counter.submittedAt)} ·{" "}
              {item.kind === "panel" ? "peer panel FAIL vote" : "employee rejection"}
            </p>
          </div>
        </div>
        {t && (
          <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-slate-200 bg-slate-50 text-xs text-slate-700 tabular-nums">
            <Scale className="w-3.5 h-3.5" /> {t.pass}/{t.total} pass · {passThreshold(t.total)} needed
          </span>
        )}
      </div>

      <ol className="mt-5 grid gap-3 md:grid-cols-3">
        <li className="rounded-[12px] border border-[var(--border)] p-4">
          <p className="meta">1 · Article excerpt</p>
          <p className="mt-2 text-sm text-[var(--fg-secondary)] leading-relaxed line-clamp-[9]">{excerpt}…</p>
        </li>
        <li className="rounded-[12px] border border-rose-100 bg-rose-50/50 p-4">
          <p className="meta">2 · Original {item.kind === "panel" ? "failureReason" : "rejection"}</p>
          <p className="mt-2 text-sm text-slate-700 leading-relaxed whitespace-pre-line">{item.originalReason}</p>
          <p className="mt-2 text-xs text-slate-500">{by?.username === me ? "You" : by?.displayName ?? "Reviewer"}</p>
        </li>
        <li className="rounded-[12px] border border-indigo-100 bg-indigo-50/60 p-4">
          <p className="meta">3 · Writer&apos;s counter-reason</p>
          <p className="mt-2 text-sm text-slate-700 leading-relaxed whitespace-pre-line">{item.counter.reason}</p>
          {item.counter.clarification && (
            <p className="mt-2 text-xs text-slate-600">
              <span className="font-semibold">Proposed clarification:</span> {item.counter.clarification}
            </p>
          )}
        </li>
      </ol>

      <div className="mt-5 flex flex-col sm:flex-row gap-2 sm:justify-end">
        <Button variant="outline" size="lg" onClick={() => { setMode("UPHOLD"); setNote("") }}>
          Uphold {item.kind === "panel" ? "Fail" : "rejection"}
        </Button>
        <Button size="lg" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => { setMode("ACCEPT"); setNote("") }}>
          <CheckCircle2 className="w-4 h-4" />
          {item.kind === "panel" ? "Accept Counter-Reason & Flip to PASS" : "Accept Counter-Reason & Publish"}
        </Button>
      </div>

      <StudioDialog
        open={mode !== null}
        onOpenChange={(o) => !o && setMode(null)}
        title={mode === "ACCEPT" ? "Accept the counter-reason?" : "Uphold the original decision?"}
        description={
          mode === "ACCEPT"
            ? item.kind === "panel"
              ? publishesOnAccept
                ? `The FAIL becomes a PASS. That brings the panel to ${t ? passThreshold(t.total) : ""} passes, so the article publishes now.`
                : "The FAIL becomes a PASS. The article publishes once the panel reaches consensus."
              : "The rejection is reversed and the article publishes now."
            : "The decision stands. The writer sees your closing note."
        }
      >
        <label className="mt-5 block">
          <span className="text-sm font-medium">{mode === "ACCEPT" ? "Note to the writer (optional)" : "Closing note (required)"}</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            maxLength={TEXT_MAX}
            autoFocus
            className={fieldClass}
            placeholder={mode === "ACCEPT" ? "What convinced you." : "Why the original reason still applies."}
          />
        </label>
        {error && (
          <p role="alert" className="mt-2 text-sm text-[var(--error)]">
            {error}
          </p>
        )}
        <DialogActions>
          <Button variant="secondary" size="lg" onClick={() => setMode(null)}>
            Cancel
          </Button>
          <Button
            size="lg"
            className={mode === "ACCEPT" ? "bg-emerald-600 text-white hover:bg-emerald-700" : undefined}
            variant={mode === "UPHOLD" ? "primary" : undefined}
            onClick={decide}
            disabled={busy || (mode === "UPHOLD" && note.trim().length < CLOSING_NOTE_MIN)}
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "ACCEPT" ? (item.kind === "panel" ? "Flip to PASS" : "Accept & publish") : "Uphold"}
          </Button>
        </DialogActions>
      </StudioDialog>
    </article>
  )
}
