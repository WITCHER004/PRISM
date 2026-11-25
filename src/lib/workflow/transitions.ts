// The editorial workflow as pure functions: submit → staff review → (Elite) 10-member peer panel →
// published, plus withdrawals, counter-reasons and rulings on them.
//
// These run on the server (src/app/api/workflow/route.ts), which is the only place allowed to move an
// article between statuses; the Firestore rules refuse those moves from browsers. Every function takes
// the current article and a context describing the verified actor, and returns the next article plus the
// notifications to send, or an error message for the person.

import type { Phase1Report } from "@/lib/moderation/types"
import { canTransition, MIN_WORDS_FOR_SUBMISSION, phase1Outcome, trackFor, VOICE_SKIP_PROVIDER } from "@/lib/moderation/workflow"
import { overlapWithCorpus } from "@/lib/moderation/similarity"
import { CLOSING_NOTE_MIN, COUNTER_REASON_MIN, FAILURE_REASON_MIN, TEXT_MAX } from "@/lib/elite/config"
import {
  assignPanel,
  canCounterVote,
  canReconsiderVote,
  panelStatus,
  reconsiderationStatus,
  resolveVote,
  type PanelDecision,
  type PanelVote,
} from "@/lib/elite/panel"
import { versionOf, type ArticleWorkflow } from "@/lib/live/schema"

export type Draft = ArticleWorkflow

export interface WorkflowNote {
  id: string
  kind: "review" | "idea_published"
  /** Recipient's handle */
  to?: string
  /** Recipient's uid, when known */
  toUid?: string
  articleId?: string
  text: string
  href?: string
  createdAt: string
  read: false
}

export interface WorkflowContext {
  /** Handle of the verified caller */
  actor: string
  /** Firebase uid of the verified caller. Ownership is decided on uids, never on handles (audit F-03) */
  actorUid?: string
  actorIsAdmin: boolean
  actorIsPanelMember: boolean
  /** Handles of every approved, active panel member */
  panelPool: string[]
  /** The article author's plan, from their (admin-controlled) users document */
  authorIsElite: boolean
  /** ISO time of this action */
  at: string
  /** Fresh short ids for votes and notifications */
  newId: () => string
}

/**
 * Is the caller this story's author? Compared on uids when both are known: an author's handle on the
 * article document is client-written, so a handle match alone could be forged (audit F-03).
 */
export function callerIsAuthor(d: Draft, ctx: WorkflowContext): boolean {
  if (d.authorUid && ctx.actorUid) return d.authorUid === ctx.actorUid
  return d.authorUsername === ctx.actor
}

export type Result = { ok: true; draft: Draft; notes: WorkflowNote[] } | { ok: false; error: string }

const fail = (error: string): Result => ({ ok: false, error })
const titleOf = (d: Draft) => (d.submitted?.title ?? d.title).trim() || "Untitled story"

/** The reviewed version of a draft becomes the live one, and produces notifications for any voters */
function publishDraft(d: Draft, ctx: WorkflowContext): { draft: Draft; voterNotes: WorkflowNote[] } {
  const v = d.submitted ?? versionOf(d)
  const draft: Draft = { ...d, status: "PUBLISHED", live: v, publishedAt: d.publishedAt ?? ctx.at, celebrated: false, liveAiPercent: d.phase1?.aiPercent }
  const title = titleOf(d)
  const voterNotes: WorkflowNote[] = (d.voterIds ?? []).slice(0, 100).map((voter) => ({
    id: "n_" + ctx.newId(),
    kind: "idea_published",
    toUid: voter,
    articleId: d.id,
    text: `An idea you sparked was just published as a full article: “${title}”`,
    href: `/story/${d.id}`,
    createdAt: ctx.at,
    read: false,
  }))
  return { draft, voterNotes }
}

/** Seats up to PANEL_SIZE panelists (never the author) and notifies them */
function sendToPanel(d: Draft, ctx: WorkflowContext, pool: string[]): { draft: Draft; notes: WorkflowNote[] } {
  const panel: PanelVote[] = assignPanel(pool, d.authorUsername).map((reviewer) => ({ id: "pv_" + ctx.newId(), reviewer, decision: null }))
  const draft: Draft = { ...d, status: "PENDING_PEER_PANEL", panel }
  const notes: WorkflowNote[] = panel.map((v) => ({
    id: "n_" + ctx.newId(),
    kind: "review",
    to: v.reviewer,
    text: `You've been assigned to the peer panel for “${titleOf(d)}”`,
    href: "/panel",
    createdAt: ctx.at,
    read: false,
  }))
  return { draft, notes }
}

/** Applies a panel change and moves the article to whatever status the votes now imply */
function applyPanel(d: Draft, ctx: WorkflowContext): Result {
  const before = d.status
  const next = d.panel ? panelStatus(d.panel) : d.status
  let updated: Draft = { ...d, status: next }
  const notes: WorkflowNote[] = []
  const title = titleOf(d)
  const notify = (text: string, href: string) =>
    notes.push({ id: "n_" + ctx.newId(), kind: "review", to: d.authorUsername, toUid: d.authorUid, text, href, createdAt: ctx.at, read: false })
  if (next === "PUBLISHED" && before !== "PUBLISHED") {
    const pub = publishDraft(updated, ctx)
    updated = { ...pub.draft, panelPassed: true }
    notes.push(...pub.voterNotes)
    notify(`“${title}” passed the peer panel and is now live`, `/story/${d.id}`)
  } else if (next === "REJECTED" && before === "PENDING_PEER_PANEL") {
    notify(`The peer panel didn't reach consensus on “${title}”. You can submit counter-reasons.`, `/submissions/${d.id}`)
  } else if (next === "REJECTED" && before === "COUNTER_SUBMITTED") {
    notify(`Your counter-reasons on “${title}” were reviewed`, `/submissions/${d.id}`)
  }
  return { ok: true, draft: updated, notes }
}

/**
 * Author submits. `report` is the server's own Phase 1 analysis of the stored text; `corpus` is every
 * other live story, for the plagiarism overlap. The submitted snapshot is what gets reviewed and published.
 */
export function submitForReview(d: Draft, report: Phase1Report, corpus: { id: string; title: string; html: string }[], ctx: WorkflowContext): Result {
  if (!callerIsAuthor(d, ctx)) return fail("Only the author can submit this story.")
  // Voice posts: the recording is the piece. Reviewers listen to it; the text check only runs on show
  // notes long enough to score (on a few lines the AI heuristics are noise, not evidence).
  const voice = d.postFormat === "voice"
  if (voice && !d.audiobookUrl) return fail("Voice posts need a recording. Record or upload one first.")
  if (!voice && report.wordCount < MIN_WORDS_FOR_SUBMISSION) return fail(`Articles need at least ${MIN_WORDS_FOR_SUBMISSION} words.`)
  const textChecked = !voice || report.wordCount >= MIN_WORDS_FOR_SUBMISSION
  if (!textChecked) report = { ...report, passed: true, manualReview: undefined, aiPassed: true, plagiarismPassed: true, provider: VOICE_SKIP_PROVIDER }
  const next = textChecked ? phase1Outcome(report) : "PENDING_EMPLOYEE_REVIEW"
  if (!canTransition(d.status, next)) return fail("This story can't be submitted right now.")
  // The route is fixed at submission time: Elite writers who kept the panel switch on go to the panel
  const track = trackFor(ctx.authorIsElite && d.panelReview !== false)
  // The analyzer scores plagiarism when it was given the corpus; older callers get the lexical check here
  const plagiarismPercent = report.plagiarismScore ?? overlapWithCorpus(d.contentHtml, corpus, d.id).percent
  const draft: Draft = {
    ...d,
    status: next,
    phase1: report,
    plagiarismPercent,
    submittedAt: ctx.at,
    review: undefined,
    appeal: undefined,
    track,
    panel: undefined,
    panelPassed: undefined,
    submitted: versionOf(d),
  }
  return { ok: true, draft, notes: [] }
}

/** Author pulls a submission back. A live story stays live; an unpublished one becomes a draft again. */
export function withdraw(d: Draft, ctx: WorkflowContext): Result {
  if (!callerIsAuthor(d, ctx)) return fail("Only the author can withdraw this story.")
  if (d.status !== "PENDING_EMPLOYEE_REVIEW" && d.status !== "PENDING_PEER_PANEL") return fail("This story isn't waiting for review.")
  return { ok: true, draft: { ...d, status: d.live ? "PUBLISHED" : "DRAFT", panel: undefined }, notes: [] }
}

/** Staff approve or reject a story waiting for employee review */
export function decideReview(d: Draft, decision: "APPROVED" | "REJECTED", rawNotes: string, ctx: WorkflowContext): Result {
  const reviewer = ctx.actor
  if (!ctx.actorIsAdmin) return fail("Only Prism staff can approve or reject stories.")
  if (d.status !== "PENDING_EMPLOYEE_REVIEW") return fail("This story is no longer waiting for review.")
  if (callerIsAuthor(d, ctx) || d.authorUsername === reviewer) return fail("You can't review your own story.")
  const notes = rawNotes.trim()
  if (decision === "REJECTED" && notes.length < 10) return fail("Tell the author what to change (10+ characters).")
  if (notes.length > TEXT_MAX) return fail(`Keep it under ${TEXT_MAX} characters.`)

  const review = { reviewer, decision, notes, at: ctx.at }
  const title = titleOf(d)
  // Elite: an employee approval sends the article on to the 10-member panel instead of publishing
  const toPanel = decision === "APPROVED" && d.track === "PEER_PANEL"
  const pool = ctx.panelPool.filter((u) => u !== d.authorUsername)
  // Until the panel has members, a staff approval publishes Elite stories directly
  const panelReady = toPanel && pool.length > 0
  let updated: Draft
  let extra: WorkflowNote[] = []
  if (panelReady) {
    const sent = sendToPanel({ ...d, review }, ctx, pool)
    updated = sent.draft
    extra = sent.notes
  } else if (decision === "APPROVED") {
    const pub = publishDraft(d, ctx)
    updated = { ...pub.draft, review }
    extra = pub.voterNotes
  } else {
    updated = { ...d, status: "REJECTED", review }
  }
  const note: WorkflowNote = {
    id: "n_" + ctx.newId(),
    kind: "review",
    to: d.authorUsername, toUid: d.authorUid,
    text: panelReady
      ? `“${title}” passed employee review and is now with the peer panel`
      : decision === "APPROVED"
        ? `“${title}” passed review and is now live`
        : `“${title}” needs changes before it can be published`,
    href: decision === "APPROVED" && !panelReady ? `/story/${d.id}` : `/submissions/${d.id}`,
    articleId: d.id,
    createdAt: ctx.at,
    read: false,
  }
  return { ok: true, draft: updated, notes: [note, ...extra] }
}

/** A seated panel member casts their one vote */
export function castPanelVote(d: Draft, decision: PanelDecision, rawReason: string, criterion: string, ctx: WorkflowContext): Result {
  const me = ctx.actor
  if (!ctx.actorIsPanelMember) return fail("Only peer-panel members can vote.")
  if (!d.panel || d.status !== "PENDING_PEER_PANEL") return fail("This paper isn't waiting for panel votes.")
  if (callerIsAuthor(d, ctx)) return fail("You can't vote on your own paper.")
  const vote = d.panel.find((v) => v.reviewer === me)
  if (!vote) return fail("You aren't on this paper's panel.")
  if (vote.decision) return fail("You've already voted on this paper.")
  if (!criterion) return fail("Pick the criterion your vote rests on.")
  const reason = rawReason.trim()
  if (decision === "FAIL" && reason.length < FAILURE_REASON_MIN) return fail(`Explain why it fails (${FAILURE_REASON_MIN}+ characters).`)
  if (reason.length > TEXT_MAX) return fail(`Keep it under ${TEXT_MAX} characters.`)
  const panel = d.panel.map((v) =>
    v.id === vote.id
      ? {
          ...v,
          decision,
          criterion,
          failureReason: decision === "FAIL" ? reason : undefined,
          note: decision === "PASS" ? reason || undefined : undefined,
          decidedAt: ctx.at,
        }
      : v
  ) as PanelVote[]
  return applyPanel({ ...d, panel }, ctx)
}

/** The author contests an employee rejection ("employee") or one panel FAIL vote (its id) */
export function submitCounter(d: Draft, target: string, rawReason: string, clarification: string | undefined, ctx: WorkflowContext): Result {
  if (!callerIsAuthor(d, ctx)) return fail("Only the author can submit a counter-reason.")
  const text = rawReason.trim()
  const extra = clarification?.trim() || undefined
  if (text.length < COUNTER_REASON_MIN) return fail(`Make your case in ${COUNTER_REASON_MIN}+ characters.`)
  if (text.length > TEXT_MAX || (extra?.length ?? 0) > TEXT_MAX) return fail(`Keep it under ${TEXT_MAX} characters.`)
  const counter = { reason: text, clarification: extra, submittedAt: ctx.at }

  if (target === "employee") {
    // Employee rejections (no panel yet) are appealed as a whole; panel FAILs are appealed vote by vote
    if (d.status !== "REJECTED" || d.panel || d.review?.decision !== "REJECTED" || d.appeal) return fail("This rejection can't be appealed.")
    const draft: Draft = { ...d, status: "COUNTER_SUBMITTED", appeal: { counter, rejectedBy: d.review.reviewer, rejectionNotes: d.review.notes } }
    const note: WorkflowNote = {
      id: "n_" + ctx.newId(),
      kind: "review",
      to: d.review.reviewer,
      text: `The author of “${titleOf(d)}” submitted a counter-reason to your rejection`,
      href: "/admin/verification?tab=counters",
      createdAt: ctx.at,
      read: false,
    }
    return { ok: true, draft, notes: [note] }
  }

  const vote = d.panel?.find((v) => v.id === target)
  if (!d.panel || !vote || !canCounterVote(vote, d.status)) return fail("This vote can't be appealed.")
  const panel = d.panel.map((v) => (v.id === vote.id ? { ...v, counter } : v))
  const note: WorkflowNote = {
    id: "n_" + ctx.newId(),
    kind: "review",
    to: vote.reviewer,
    text: `The author of “${titleOf(d)}” submitted a counter-reason to your FAIL vote`,
    href: "/panel?tab=counters",
    createdAt: ctx.at,
    read: false,
  }
  return { ok: true, draft: { ...d, panel, status: "COUNTER_SUBMITTED" }, notes: [note] }
}

/** Staff (employee rejections) or the dissenting panelist / a panel lead (panel votes) rule on a counter */
export function reconsiderCounter(d: Draft, target: string, verdict: "ACCEPT" | "UPHOLD", rawNote: string, ctx: WorkflowContext): Result {
  const me = ctx.actor
  if (d.status !== "COUNTER_SUBMITTED") return fail("There's no open counter-reason on this article.")
  if (callerIsAuthor(d, ctx) || d.authorUsername === me) return fail("You can't rule on your own appeal.")
  const text = rawNote.trim()
  if (verdict === "UPHOLD" && text.length < CLOSING_NOTE_MIN) return fail(`Add a closing note for the writer (${CLOSING_NOTE_MIN}+ characters).`)
  if (text.length > TEXT_MAX) return fail(`Keep it under ${TEXT_MAX} characters.`)
  const staff = ctx.actorIsAdmin

  if (target === "employee") {
    if (!staff) return fail("Only Prism staff can reconsider an employee rejection.")
    if (!d.appeal || reconsiderationStatus(d.appeal) !== "PENDING") return fail("This appeal was already decided.")
    const appeal: Draft["appeal"] = { ...d.appeal, reconsideration: { status: verdict === "ACCEPT" ? "ACCEPTED" : "UPHELD", note: text, by: me, at: ctx.at } }
    const approved: Draft = { ...d, appeal, review: { reviewer: me, decision: "APPROVED", notes: text, at: ctx.at } }
    // An accepted Elite appeal counts as the employee approval, so the article moves on to the panel
    const toPanel = verdict === "ACCEPT" && d.track === "PEER_PANEL"
    const pool = ctx.panelPool.filter((u) => u !== d.authorUsername)
    let updated: Draft
    let extra: WorkflowNote[] = []
    if (toPanel && pool.length > 0) {
      const sent = sendToPanel(approved, ctx, pool)
      updated = sent.draft
      extra = sent.notes
    } else if (verdict === "ACCEPT") {
      const pub = publishDraft(approved, ctx)
      updated = pub.draft
      extra = pub.voterNotes
    } else {
      updated = { ...d, status: "REJECTED", appeal }
    }
    const n: WorkflowNote = {
      id: "n_" + ctx.newId(),
      kind: "review",
      to: d.authorUsername, toUid: d.authorUid,
      text: toPanel
        ? `Your counter-reason was accepted — “${titleOf(d)}” is now with the peer panel`
        : verdict === "ACCEPT"
          ? `Your counter-reason was accepted — “${titleOf(d)}” is now live`
          : `Your counter-reason on “${titleOf(d)}” was reviewed; the rejection stands`,
      href: verdict === "ACCEPT" && !toPanel ? `/story/${d.id}` : `/submissions/${d.id}`,
      createdAt: ctx.at,
      read: false,
    }
    return { ok: true, draft: updated, notes: [n, ...extra] }
  }

  const vote = d.panel?.find((v) => v.id === target)
  if (!d.panel || !vote) return fail("Vote not found.")
  if (!canReconsiderVote(vote, me, staff)) return fail("Only the dissenting panel member or a panel lead can rule on this.")
  const panel = d.panel.map((v) => (v.id === vote.id ? resolveVote(v, verdict, text, me, ctx.at) : v))
  return applyPanel({ ...d, panel }, ctx)
}
