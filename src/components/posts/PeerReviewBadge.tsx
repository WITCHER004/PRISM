"use client"

import { useState } from "react"
import { useUIStore } from "@/lib/store"
import { calculatePeerReviewStats, type PeerReview } from "@/lib/data"
import { ShieldCheck, Award, ChevronRight, Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface PeerReviewBadgeProps {
  postId: string
  defaultReviews?: PeerReview[]
  className?: string
}

export function PeerReviewBadge({ postId, defaultReviews, className }: PeerReviewBadgeProps) {
  const storeReviews = useUIStore((s) => s.peerReviews[postId])
  const reviews = storeReviews !== undefined ? storeReviews : defaultReviews ?? []
  const stats = calculatePeerReviewStats(reviews)
  const [showTooltip, setShowTooltip] = useState(false)

  const hasReviews = stats.totalReviews > 0
  const isEndorsed = stats.endorsementRate >= 80

  const scrollToReviews = (e: React.MouseEvent) => {
    e.preventDefault()
    const target = document.getElementById("peer-reviews")
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  return (
    <div className={cn("relative inline-flex items-center", className)}>
      <a
        href="#peer-reviews"
        onClick={scrollToReviews}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        className={cn(
          "group inline-flex items-center gap-2 h-8 px-3 rounded-full text-xs font-medium transition-all duration-200 border",
          hasReviews
            ? isEndorsed
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300 hover:border-emerald-500/50"
              : "bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-300 hover:border-blue-500/50"
            : "bg-[var(--surface)] border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:text-[var(--fg)]"
        )}
        aria-label={
          hasReviews
            ? `Peer Reviewed: ${stats.averageOverall} out of 5 stars based on ${stats.totalReviews} reviews`
            : "No peer reviews yet. Click to review."
        }
      >
        <span className="flex items-center gap-1.5">
          {hasReviews ? (
            <ShieldCheck className="w-3.5 h-3.5 text-current" />
          ) : (
            <Award className="w-3.5 h-3.5 text-current opacity-70" />
          )}
          <span className="font-semibold uppercase tracking-wider text-[0.6875rem]">
            {hasReviews ? "Peer Reviewed" : "Peer Review"}
          </span>
        </span>

        {hasReviews ? (
          <>
            <span className="w-1 h-1 rounded-full bg-current opacity-40" />
            <span className="flex items-center gap-1 font-mono">
              <Star className="w-3 h-3 fill-current" />
              <span>{stats.averageOverall.toFixed(1)}</span>
            </span>
            <span className="opacity-70 font-mono text-[0.6875rem]">
              ({stats.totalReviews})
            </span>
          </>
        ) : (
          <span className="opacity-70 font-sans text-[0.6875rem]">Open for review</span>
        )}

        <ChevronRight className="w-3 h-3 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
      </a>

      {/* Hover preview tooltip */}
      {showTooltip && hasReviews && (
        <div className="absolute left-0 bottom-full mb-2 z-50 w-64 p-3.5 rounded-xl panel border border-[var(--border)] shadow-[var(--shadow-lift)] text-left pointer-events-none animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border)]">
            <span className="text-xs font-semibold text-[var(--fg)]">Evaluation Summary</span>
            <span className="text-[0.6875rem] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-medium">
              {stats.endorsementRate}% Endorsed
            </span>
          </div>

          <div className="space-y-1.5 text-xs text-[var(--fg-secondary)]">
            <div className="flex justify-between items-center">
              <span>Methodology:</span>
              <span className="font-mono font-medium text-[var(--fg)]">
                {stats.criteriaAverages.methodology} / 5
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Clarity:</span>
              <span className="font-mono font-medium text-[var(--fg)]">
                {stats.criteriaAverages.clarity} / 5
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Rigor:</span>
              <span className="font-mono font-medium text-[var(--fg)]">
                {stats.criteriaAverages.rigor} / 5
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Citations:</span>
              <span className="font-mono font-medium text-[var(--fg)]">
                {stats.criteriaAverages.citations} / 5
              </span>
            </div>
          </div>
          <p className="mt-2 text-[0.6875rem] text-[var(--fg-muted)]">
            Click to view full review dossiers and critique
          </p>
        </div>
      )}
    </div>
  )
}

