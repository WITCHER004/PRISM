import type { PeerPanelReview, Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { analyzeArticle } from "@/lib/moderation/analyzer"
import type { ArticleStatus, ReviewTrack } from "@/lib/moderation/types"
import {
  afterEmployeeApproval,
  canReview,
  canSubmit,
  canTransition,
  isPeerReviewer,
  MIN_WORDS_FOR_SUBMISSION,
  phase1Outcome,
  trackFor,
} from "@/lib/moderation/workflow"
import { CLOSING_NOTE_MIN, COUNTER_REASON_MIN, FAILURE_REASON_MIN, TEXT_MAX } from "@/lib/elite/config"
import {
  assignPanel,
  canCounterVote,
  canReconsiderVote,
  panelStatus,
  tallyPanel,
  type PanelVote,
} from "@/lib/elite/panel"
import { isEliteActive } from "@/lib/elite/subscription"
import { ActionError } from "@/lib/session"
import type { SessionUser } from "./api"
import { awardBadges } from "./badges"

// Database edition of the publishing pipeline: 150-word + Phase 1 gate, employee review,
// then (Elite only) the 10-member peer panel, and counter-reason appeals. The browser store applies
// the same rules (from src/lib/elite/panel.ts) in demo mode.

const toVote = (r: PeerPanelReview): PanelVote => ({
  id: r.id,
  reviewer: r.reviewerId,
  decision: r.decision,
  failureReason: r.failureReason ?? undefined,
  decidedAt: r.decidedAt?.toISOString(),
  originalDecision: r.originalDecision ?? undefined,
  counter: r.counterReason
    ? { reason: r.counterReason, clarification: r.counterClarification ?? undefined, submittedAt: r.counterSubmittedAt!.toISOString() }
    : undefined,
  reconsideration:
    r.reconsiderationStatus === "ACCEPTED" || r.reconsiderationStatus === "UPHELD"
      ? {
          status: r.reconsiderationStatus,
          note: r.reconsiderationNote ?? "",
          by: r.reconsideredById ?? "",
          at: r.reconsideredAt?.toISOString() ?? "",
        }
      : undefined,
})

async function currentRound(tx: Prisma.TransactionClient, postId: string) {
  const last = await tx.peerPanelReview.findFirst({ where: { postId }, orderBy: { round: "desc" }, select: { round: true } })
  return last?.round ?? 0
}

/**
 * Elite step after employee approval: draws a fresh 10-member panel (never the author) as a new round.
 * Call inside the same transaction that moves the post to PENDING_PEER_PANEL.
 */
export async function startPanel(tx: Prisma.TransactionClient, postId: string, authorId: string) {
  const reviewers = await tx.user.findMany({ where: { role: "PEER_REVIEWER" }, select: { id: true } })
  let panel: string[]
  try {
    panel = assignPanel(reviewers.map((u) => u.id), authorId)
  } catch {
    throw new ActionError("Not enough peer reviewers to form a panel.", 409)
  }
  const round = (await currentRound(tx, postId)) + 1
  await tx.peerPanelReview.createMany({ data: panel.map((reviewerId) => ({ postId, reviewerId, round })) })
  // Notification fan-out (email / in-app) to the panelists hooks in here
  return panel
}

/** Status an employee approval leads to, plus the panel draw for Elite articles */
export async function approveByEmployee(tx: Prisma.TransactionClient, post: { id: string; authorId: string; reviewTrack: ReviewTrack | null }) {
  const to = afterEmployeeApproval(post.reviewTrack)
  if (to === "PENDING_PEER_PANEL") await startPanel(tx, post.id, post.authorId)
  return to
}

/** The panel for the article's latest submission */
export async function getPanel(postId: string) {
  return db.$transaction(async (tx) => {
    const round = await currentRound(tx, postId)
    const rows = await tx.peerPanelReview.findMany({
      where: { postId, round },
      orderBy: { createdAt: "asc" },
      include: { reviewer: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    })
    return { round, votes: rows, tally: tallyPanel(rows.map(toVote)) }
  })
}

/**
 * Writer submits: 150-word minimum → Phase 1 AI check → employee review. Elite writers' articles
 * are marked for the peer panel, which they reach once the employee approves.
 */
export async function submitArticle(user: SessionUser, postId: string) {
  const post = await db.post.findUnique({ where: { id: postId } })
  if (!post || post.authorId !== user.id) throw new ActionError("Article not found.", 404)
  if (!canSubmit(post.status as ArticleStatus)) throw new ActionError("This article is already in review.", 409)
  const track = trackFor(isEliteActive(user))

  // Always analyzed here, never trusted from the client
  const report = await analyzeArticle({ title: post.title, contentHtml: post.contentHtml })
  if (report.wordCount < MIN_WORDS_FOR_SUBMISSION)
    throw new ActionError(`Articles need at least ${MIN_WORDS_FOR_SUBMISSION} words (this one has ${report.wordCount}).`, 422)

  const next = phase1Outcome(report.aiPercent)
  await db.post.update({
      where: { id: post.id },
      data: {
        status: next,
        reviewTrack: track,
        aiScore: report.aiPercent,
        humanScore: report.humanPercent,
        wordCount: report.wordCount,
        phase1Report: JSON.parse(JSON.stringify(report)),
        submittedAt: new Date(),
        reviewDecision: null,
        reviewerNotes: null,
        reviewedById: null,
        reviewedAt: null,
        counterReason: null,
        counterClarification: null,
        counterSubmittedAt: null,
        reconsiderationStatus: "NONE",
        reconsiderationNote: null,
        reconsideredAt: null,
      },
    })
  return { status: next, track, report }
}

/** Moves the article to whatever status its panel votes imply; publishes on consensus */
async function settlePanel(postId: string) {
  const post = await db.post.findUnique({ where: { id: postId }, select: { status: true, authorId: true, publishedAt: true } })
  if (!post) return null
  const { votes } = await getPanel(postId)
  const next = panelStatus(votes.map(toVote))
  if (next !== post.status) {
    await db.post.update({
      where: { id: postId },
      data: { status: next, ...(next === "PUBLISHED" ? { publishedAt: post.publishedAt ?? new Date() } : {}) },
    })
    if (next === "PUBLISHED") await awardBadges(post.authorId)
  }
  return next
}

/** A panel member casts PASS or FAIL; FAIL requires a failureReason */
export async function castPanelVote(user: SessionUser, postId: string, reviewId: string, decision: "PASS" | "FAIL", failureReason?: string) {
  if (!isPeerReviewer(user.role)) throw new ActionError("Only peer-panel members can vote.", 403)
  const reason = failureReason?.trim() ?? ""
  if (decision === "FAIL" && reason.length < FAILURE_REASON_MIN)
    throw new ActionError(`A FAIL vote needs a failureReason (${FAILURE_REASON_MIN}+ characters).`, 422)
  if (reason.length > TEXT_MAX) throw new ActionError(`Keep the reason under ${TEXT_MAX} characters.`)

  const review = await db.peerPanelReview.findUnique({ where: { id: reviewId }, include: { post: { select: { status: true } } } })
  if (!review || review.postId !== postId) throw new ActionError("Vote not found.", 404)
  if (review.reviewerId !== user.id) throw new ActionError("You aren't on this paper's panel.", 403)
  if (review.post.status !== "PENDING_PEER_PANEL") throw new ActionError("This paper isn't waiting for panel votes.", 409)

  // Conditional update: a vote is cast once
  const { count } = await db.peerPanelReview.updateMany({
    where: { id: reviewId, decision: null },
    data: { decision, failureReason: decision === "FAIL" ? reason : null, decidedAt: new Date() },
  })
  if (count === 0) throw new ActionError("You've already voted on this paper.", 409)
  return { status: await settlePanel(postId) }
}

/**
 * Writer's counter-reason. `reviewId` is a PeerPanelReview id, or "employee" to appeal an
 * employee-review rejection. Sets the article to COUNTER_SUBMITTED.
 */
export async function submitCounter(user: SessionUser, postId: string, reviewId: string, reason: string, clarification?: string) {
  const text = reason.trim()
  const extra = clarification?.trim() || null
  if (text.length < COUNTER_REASON_MIN) throw new ActionError(`A counterReason needs ${COUNTER_REASON_MIN}+ characters.`, 422)
  if (text.length > TEXT_MAX || (extra?.length ?? 0) > TEXT_MAX) throw new ActionError(`Keep it under ${TEXT_MAX} characters.`)

  const post = await db.post.findUnique({ where: { id: postId } })
  if (!post || post.authorId !== user.id) throw new ActionError("Article not found.", 404)
  const now = new Date()

  if (reviewId === "employee") {
    // reviewDecision is only REJECTED when the employee step failed (a panel rejection follows an employee APPROVED)
    if (post.status !== "REJECTED" || post.reviewDecision !== "REJECTED" || post.counterReason)
      throw new ActionError("This rejection can't be appealed.", 409)
    await db.post.update({
      where: { id: postId },
      data: {
        status: "COUNTER_SUBMITTED",
        counterReason: text,
        counterClarification: extra,
        counterSubmittedAt: now,
        reconsiderationStatus: "PENDING",
      },
    })
    return { status: "COUNTER_SUBMITTED" as const, notify: post.reviewedById ? [post.reviewedById] : [] }
  }

  const review = await db.peerPanelReview.findUnique({ where: { id: reviewId } })
  if (!review || review.postId !== postId) throw new ActionError("Vote not found.", 404)
  const round = await db.$transaction((tx) => currentRound(tx, postId))
  if (review.round !== round || !canCounterVote(toVote(review), post.status as ArticleStatus))
    throw new ActionError("This vote can't be appealed.", 409)

  await db.$transaction([
    db.peerPanelReview.update({
      where: { id: reviewId },
      data: { counterReason: text, counterClarification: extra, counterSubmittedAt: now, reconsiderationStatus: "PENDING" },
    }),
    db.post.update({ where: { id: postId }, data: { status: "COUNTER_SUBMITTED" } }),
  ])
  // Notification fan-out (email / in-app) hooks in here: the dissenting member
  return { status: "COUNTER_SUBMITTED" as const, notify: [review.reviewerId] }
}

/**
 * Reconsideration verdict on a counter-reason. ACCEPT flips the FAIL to PASS (publishing on
 * consensus) or, for an employee appeal, publishes; UPHOLD keeps the decision with a closing note.
 */
export async function reconsiderCounter(user: SessionUser, postId: string, reviewId: string, verdict: "ACCEPT" | "UPHOLD", note: string) {
  const text = note.trim()
  if (verdict === "UPHOLD" && text.length < CLOSING_NOTE_MIN)
    throw new ActionError(`Upholding needs a closing note (${CLOSING_NOTE_MIN}+ characters).`, 422)
  if (text.length > TEXT_MAX) throw new ActionError(`Keep it under ${TEXT_MAX} characters.`)

  const post = await db.post.findUnique({ where: { id: postId } })
  if (!post) throw new ActionError("Article not found.", 404)
  if (post.status !== "COUNTER_SUBMITTED") throw new ActionError("There's no open counter-reason on this article.", 409)
  if (post.authorId === user.id) throw new ActionError("You can't rule on your own appeal.", 403)
  const staff = canReview(user.role)
  const now = new Date()

  if (reviewId === "employee") {
    if (!staff) throw new ActionError("Only Prism staff can reconsider an employee rejection.", 403)
    // An accepted appeal counts as the employee approval: Free articles publish, Elite ones go to the panel
    const to: ArticleStatus = verdict === "ACCEPT" ? afterEmployeeApproval(post.reviewTrack) : "REJECTED"
    if (!canTransition("COUNTER_SUBMITTED", to)) throw new ActionError("Invalid transition.")
    await db.$transaction(async (tx) => {
      const { count } = await tx.post.updateMany({
        where: { id: postId, status: "COUNTER_SUBMITTED", reconsiderationStatus: "PENDING" },
        data: {
          status: to,
          reconsiderationStatus: verdict === "ACCEPT" ? "ACCEPTED" : "UPHELD",
          reconsiderationNote: text || null,
          reconsideredAt: now,
          ...(verdict === "ACCEPT" ? { reviewDecision: "APPROVED", reviewedById: user.id, reviewedAt: now } : {}),
          ...(to === "PUBLISHED" ? { publishedAt: post.publishedAt ?? now } : {}),
        },
      })
      if (count === 0) throw new ActionError("This appeal was already decided.", 409)
      if (to === "PENDING_PEER_PANEL") await startPanel(tx, postId, post.authorId)
    })
    if (to === "PUBLISHED") await awardBadges(post.authorId)
    return { status: to }
  }

  const review = await db.peerPanelReview.findUnique({ where: { id: reviewId } })
  if (!review || review.postId !== postId) throw new ActionError("Vote not found.", 404)
  if (!canReconsiderVote(toVote(review), user.id, staff))
    throw new ActionError("Only the dissenting panel member or a panel lead can rule on this.", 403)

  const { count } = await db.peerPanelReview.updateMany({
    where: { id: reviewId, reconsiderationStatus: "PENDING" },
    data: {
      reconsiderationStatus: verdict === "ACCEPT" ? "ACCEPTED" : "UPHELD",
      reconsiderationNote: text || null,
      reconsideredById: user.id,
      reconsideredAt: now,
      ...(verdict === "ACCEPT" ? { decision: "PASS", originalDecision: "FAIL" } : {}),
    },
  })
  if (count === 0) throw new ActionError("This counter-reason was already decided.", 409)
  return { status: await settlePanel(postId) }
}

/** Reviewer dashboard: counters waiting on this user (dissenting member) or on staff */
export async function getCountersToReconsider(user: SessionUser) {
  const staff = canReview(user.role)
  const [panel, employee] = await Promise.all([
    db.peerPanelReview.findMany({
      where: { reconsiderationStatus: "PENDING", ...(staff ? {} : { reviewerId: user.id }) },
      orderBy: { counterSubmittedAt: "asc" },
      include: { post: { select: { id: true, title: true, excerpt: true, contentText: true, author: { select: { username: true, displayName: true } } } } },
    }),
    staff
      ? db.post.findMany({
          where: { status: "COUNTER_SUBMITTED", reconsiderationStatus: "PENDING" },
          orderBy: { counterSubmittedAt: "asc" },
          select: { id: true, title: true, excerpt: true, reviewerNotes: true, counterReason: true, counterClarification: true, counterSubmittedAt: true },
        })
      : Promise.resolve([]),
  ])
  return { panel, employee }
}
