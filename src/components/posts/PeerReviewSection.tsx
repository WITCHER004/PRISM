"use client"

import { useState } from "react"
import { useUIStore, toast } from "@/lib/store"
import { calculatePeerReviewStats, type PeerReview, type PeerReviewDecision } from "@/lib/data"
import { PeerReviewModal } from "@/components/posts/PeerReviewModal"
import { Avatar } from "@/components/ui/Avatar"
import { formatRelativeDate, cn } from "@/lib/utils"
import {
  ShieldCheck,
  Award,
  Star,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ThumbsUp,
  Sparkles,
  ExternalLink,
  ChevronDown,
  Info,
  Scale,
} from "lucide-react"
import { motion, AnimatePresence } from "motion/react"

interface PeerReviewSectionProps {
  postId: string
  postTitle: string
  defaultReviews?: PeerReview[]
}

export function PeerReviewSection({ postId, postTitle, defaultReviews }: PeerReviewSectionProps) {
  const storeReviews = useUIStore((s) => s.peerReviews[postId])
  const reviews = storeReviews !== undefined ? storeReviews : defaultReviews ?? []
  const upvotedReviews = useUIStore((s) => s.upvotedReviews)
  const toggleUpvote = useUIStore((s) => s.toggleUpvotePeerReview)
  const currentUser = useUIStore((s) => s.currentUser)

  const [filter, setFilter] = useState<"ALL" | PeerReviewDecision>("ALL")
  const [modalOpen, setModalOpen] = useState(false)

  const stats = calculatePeerReviewStats(reviews)

  const filteredReviews = reviews.filter((r) => {
    if (filter === "ALL") return true
    return r.decision === filter
  })

  const getDecisionBadge = (decision: PeerReviewDecision) => {
    switch (decision) {
      case "ENDORSED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Endorsed
          </span>
        )
      case "ACCEPTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-blue-500/15 text-blue-800 dark:text-blue-300 border border-blue-500/30">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            Accepted
          </span>
        )
      case "REVISIONS_REQUESTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            Revisions Requested
          </span>
        )
      case "DISPUTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-500/30">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            Disputed
          </span>
        )
    }
  }

  return (
    <section id="peer-reviews" className="mt-14 pt-10 border-t border-[var(--border)]">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[var(--accent)] mb-1">
            <Scale className="w-4 h-4" />
            <span>Open Scholarly Review</span>
          </div>
          <h2 className="display text-2xl sm:text-3xl text-[var(--fg)]">
            Peer Reviews & Verification
          </h2>
          <p className="text-sm text-[var(--fg-muted)] mt-1 max-w-xl">
            Structured critiques and reproducible evaluations authored by domain researchers and fellow practitioners.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full text-sm font-semibold bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--fg-secondary)] transition-all shadow-[var(--shadow-sm)] active:scale-95 shrink-0"
        >
          <Sparkles className="w-4 h-4" />
          <span>Submit a Review</span>
        </button>
      </div>

      {/* Aggregate Score Card */}
      {stats.totalReviews > 0 ? (
        <div className="p-6 sm:p-7 rounded-3xl panel border border-[var(--border)] shadow-[var(--shadow)] mb-8 bg-[var(--panel)]">
          <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_220px] gap-8 items-center">
            {/* Left: Overall rating */}
            <div className="flex flex-col items-center lg:items-start text-center lg:text-left border-b lg:border-b-0 lg:border-r border-[var(--border)] pb-6 lg:pb-0 lg:pr-6">
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--fg-muted)]">
                Peer Rigor Score
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="display text-5xl font-bold tracking-tight text-[var(--fg)]">
                  {stats.averageOverall.toFixed(1)}
                </span>
                <span className="text-sm font-mono text-[var(--fg-muted)]">/ 5.0</span>
              </div>
              <div className="flex items-center gap-1 mt-2 text-amber-500">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={cn(
                      "w-4 h-4",
                      star <= Math.round(stats.averageOverall) ? "fill-current" : "opacity-30"
                    )}
                  />
                ))}
              </div>
              <div className="mt-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  {stats.endorsementRate}% Peer Endorsed
                </span>
              </div>
              <p className="text-xs text-[var(--fg-muted)] mt-2">
                Based on {stats.totalReviews} {stats.totalReviews === 1 ? "evaluation" : "evaluations"}
              </p>
            </div>

            {/* Middle: Criteria bars */}
            <div className="space-y-3.5">
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--fg-muted)] block">
                Criteria Breakdown
              </span>
              {(
                [
                  { label: "Methodology & Soundness", score: stats.criteriaAverages.methodology },
                  { label: "Clarity & Exposition", score: stats.criteriaAverages.clarity },
                  { label: "Originality & Rigor", score: stats.criteriaAverages.rigor },
                  { label: "Citations & Evidence", score: stats.criteriaAverages.citations },
                ] as const
              ).map((crit) => {
                const percent = (crit.score / 5) * 100
                return (
                  <div key={crit.label} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-[var(--fg-secondary)]">{crit.label}</span>
                      <span className="font-mono font-semibold text-[var(--fg)]">
                        {crit.score.toFixed(1)} / 5.0
                      </span>
                    </div>
                    <div className="h-2 w-full bg-[var(--surface)] rounded-full overflow-hidden border border-[var(--border)]">
                      <div
                        className="h-full bg-[var(--accent)] rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Right: Verdict distribution */}
            <div className="border-t lg:border-t-0 lg:border-l border-[var(--border)] pt-6 lg:pt-0 lg:pl-6 space-y-2">
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--fg-muted)] block mb-1">
                Verdict Tally
              </span>
              <div className="flex items-center justify-between text-xs py-1">
                <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Endorsed
                </span>
                <span className="font-mono font-bold">{stats.decisions.endorsed}</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1">
                <span className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300 font-medium">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Accepted
                </span>
                <span className="font-mono font-bold">{stats.decisions.accepted}</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1">
                <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-medium">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Revisions
                </span>
                <span className="font-mono font-bold">{stats.decisions.revisions}</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1">
                <span className="flex items-center gap-1.5 text-rose-700 dark:text-rose-300 font-medium">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  Disputed
                </span>
                <span className="font-mono font-bold">{stats.decisions.disputed}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="p-8 rounded-3xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)] text-center mb-8">
          <div className="w-12 h-12 rounded-full bg-[var(--panel)] flex items-center justify-center mx-auto text-[var(--accent)] mb-3 shadow-sm">
            <Award className="w-6 h-6" />
          </div>
          <h3 className="display text-xl text-[var(--fg)]">No peer reviews published yet</h3>
          <p className="text-sm text-[var(--fg-muted)] max-w-md mx-auto mt-1 mb-5">
            This piece is open for review. Qualified practitioners and researchers are invited to evaluate its methodology and findings.
          </p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-full text-xs font-semibold bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)] transition-all shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Be the First Reviewer
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      {reviews.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 no-scrollbar">
          {(
            [
              { key: "ALL", label: `All Reviews (${reviews.length})` },
              { key: "ENDORSED", label: `Endorsed (${stats.decisions.endorsed})` },
              { key: "ACCEPTED", label: `Accepted (${stats.decisions.accepted})` },
              { key: "REVISIONS_REQUESTED", label: `Revisions (${stats.decisions.revisions})` },
              { key: "DISPUTED", label: `Disputed (${stats.decisions.disputed})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={cn(
                "h-8 px-3.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border",
                filter === tab.key
                  ? "bg-[var(--fg)] text-[var(--bg)] border-[var(--fg)]"
                  : "bg-[var(--panel)] text-[var(--fg-muted)] border-[var(--border)] hover:text-[var(--fg)] hover:border-[var(--border-strong)]"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* List of Review Dossiers */}
      <div className="space-y-6">
        <AnimatePresence mode="popLayout">
          {filteredReviews.map((review) => {
            const isUpvoted = upvotedReviews.has(review.id)
            return (
              <motion.article
                key={review.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="p-6 sm:p-7 rounded-3xl panel border border-[var(--border)] shadow-[var(--shadow-sm)] bg-[var(--panel)] relative overflow-hidden"
              >
                {/* Reviewer Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-[var(--border)]">
                  <div className="flex items-center gap-3.5">
                    <Avatar
                      src={review.author.avatarUrl}
                      alt={review.author.displayName}
                      size="lg"
                    />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-base text-[var(--fg)]">
                          {review.author.displayName}
                        </span>
                        {review.isVerifiedPeer && (
                          <span className="inline-flex items-center gap-1 text-[0.6875rem] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-500/30">
                            <ShieldCheck className="w-3 h-3" /> Verified Peer
                          </span>
                        )}
                      </div>

                      {review.affiliation && (
                        <p className="text-xs font-medium text-[var(--fg-secondary)] mt-0.5">
                          {review.affiliation}
                        </p>
                      )}

                      <p className="meta mt-1 text-[0.6875rem]">
                        Evaluated {formatRelativeDate(review.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-start sm:self-auto">
                    {getDecisionBadge(review.decision)}
                    <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-[var(--surface)] border border-[var(--border)] text-xs font-mono font-bold text-[var(--accent)]">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <span>{review.overallScore.toFixed(1)}</span>
                    </div>
                  </div>
                </div>

                {/* Quantitative criteria mini-tags */}
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-mono">
                  <span className="px-2.5 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--fg-secondary)]">
                    Methodology: <strong className="text-[var(--fg)]">{review.scores.methodology}/5</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--fg-secondary)]">
                    Clarity: <strong className="text-[var(--fg)]">{review.scores.clarity}/5</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--fg-secondary)]">
                    Rigor: <strong className="text-[var(--fg)]">{review.scores.rigor}/5</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--fg-secondary)]">
                    Citations: <strong className="text-[var(--fg)]">{review.scores.citations}/5</strong>
                  </span>
                </div>

                {/* Executive Summary */}
                <div className="mt-5">
                  <h4 className="text-xs font-mono uppercase tracking-wider text-[var(--fg-muted)] mb-1.5">
                    Executive Assessment
                  </h4>
                  <p className="text-sm sm:text-base leading-relaxed text-[var(--fg)] font-serif">
                    {review.summary}
                  </p>
                </div>

                {/* Key Strengths */}
                {review.strengths && review.strengths.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[var(--border)]">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-2">
                      Key Strengths & Merits
                    </h4>
                    <ul className="space-y-1.5">
                      {review.strengths.map((str, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-[var(--fg-secondary)]">
                          <span className="w-4 h-4 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 text-[0.625rem] font-bold">
                            ✓
                          </span>
                          <span>{str}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Critique & Observations */}
                {review.critique && (
                  <div className="mt-4 p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-[var(--fg-muted)] mb-1 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-[var(--accent)]" />
                      Critique & Observations
                    </h4>
                    <p className="text-xs sm:text-sm leading-relaxed text-[var(--fg-secondary)]">
                      {review.critique}
                    </p>
                  </div>
                )}

                {/* Review footer: Transparency & Helpful upvote */}
                <div className="mt-5 pt-4 border-t border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="text-[var(--fg-muted)] text-[0.6875rem]">
                    <span className="font-semibold text-[var(--fg-secondary)]">Transparency:</span>{" "}
                    {review.competingInterests || "None declared"}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      toggleUpvote(review.id)
                      toast(isUpvoted ? "Vote withdrawn" : "Marked peer review as helpful", { tone: "success" })
                    }}
                    className={cn(
                      "inline-flex items-center gap-1.5 h-8 px-3 rounded-full font-medium transition-all text-xs border self-start sm:self-auto",
                      isUpvoted
                        ? "bg-[var(--accent)] text-[var(--on-accent)] border-[var(--accent)]"
                        : "bg-[var(--surface)] text-[var(--fg-muted)] border-[var(--border)] hover:text-[var(--fg)] hover:border-[var(--border-strong)]"
                    )}
                    aria-label={`Mark review as helpful. Currently ${review.upvotes} helpful votes.`}
                  >
                    <ThumbsUp className={cn("w-3.5 h-3.5", isUpvoted ? "fill-current" : "")} />
                    <span>Helpful</span>
                    <span className="font-mono text-[0.6875rem] font-bold opacity-80">
                      ({review.upvotes})
                    </span>
                  </button>
                </div>
              </motion.article>
            )
          })}
        </AnimatePresence>
      </div>

      {/* Submission Modal */}
      <PeerReviewModal
        postId={postId}
        postTitle={postTitle}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </section>
  )
}

