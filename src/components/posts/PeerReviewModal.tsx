"use client"

import { useState } from "react"
import { DialogShell } from "@/components/posts/DialogShell"
import { useUIStore, toast } from "@/lib/store"
import { MOCK_USERS, type PeerReviewDecision, type PeerReviewCriteriaScores, type User } from "@/lib/data"
import { Avatar } from "@/components/ui/Avatar"
import { CheckCircle2, AlertCircle, HelpCircle, Star, Sparkles, Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface PeerReviewModalProps {
  postId: string
  postTitle: string
  open: boolean
  onClose: () => void
}

const DECISIONS: {
  value: PeerReviewDecision
  title: string
  desc: string
  color: string
}[] = [
  {
    value: "ENDORSED",
    title: "Endorse",
    desc: "Rigorous, sound methodology, highly recommended contribution",
    color: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  },
  {
    value: "ACCEPTED",
    title: "Accept",
    desc: "Methodologically sound with minor suggestions",
    color: "border-blue-500/40 bg-blue-500/10 text-blue-800 dark:text-blue-300",
  },
  {
    value: "REVISIONS_REQUESTED",
    title: "Revisions Requested",
    desc: "Requires empirical clarification, missing citations or proofs",
    color: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  },
  {
    value: "DISPUTED",
    title: "Dispute",
    desc: "Critical methodological flaws, inaccuracies, or unsubstantiated claims",
    color: "border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-300",
  },
]

export function PeerReviewModal({ postId, postTitle, open, onClose }: PeerReviewModalProps) {
  const currentUser = useUIStore((s) => s.currentUser)
  const profile = useUIStore((s) => s.profile)
  const addPeerReview = useUIStore((s) => s.addPeerReview)

  const [decision, setDecision] = useState<PeerReviewDecision>("ENDORSED")
  const [affiliation, setAffiliation] = useState("")
  const [scores, setScores] = useState<PeerReviewCriteriaScores>({
    methodology: 5,
    clarity: 5,
    rigor: 5,
    citations: 5,
  })
  const [summary, setSummary] = useState("")
  const [strengthInputs, setStrengthInputs] = useState<string[]>([
    "",
    "",
  ])
  const [critique, setCritique] = useState("")
  const [competingInterests, setCompetingInterests] = useState("None declared")
  const [submitting, setSubmitting] = useState(false)

  const matchedUser = MOCK_USERS.find((u) => u.username === currentUser)
  const reviewerUser: User = {
    id: matchedUser?.id || "u_cur",
    username: currentUser || "anonymous_peer",
    displayName: profile.displayName || matchedUser?.displayName || "Peer Reviewer",
    bio: profile.bio || "Independent Researcher & Reader",
    avatarUrl:
      matchedUser?.avatarUrl ||
      `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser || "peer"}&backgroundColor=b6e3f4`,
    role: "WRITER",
    isVerifiedHuman: true,
    followerCount: matchedUser?.followerCount || 120,
    followingCount: matchedUser?.followingCount || 45,
    postCount: matchedUser?.postCount || 3,
    createdAt: new Date().toISOString(),
  }

  const handleScoreChange = (key: keyof PeerReviewCriteriaScores, val: number) => {
    setScores((prev) => ({ ...prev, [key]: val }))
  }

  const handleStrengthChange = (index: number, val: string) => {
    setStrengthInputs((prev) => {
      const copy = [...prev]
      copy[index] = val
      return copy
    })
  }

  const addStrengthField = () => {
    if (strengthInputs.length < 5) {
      setStrengthInputs((prev) => [...prev, ""])
    }
  }

  const removeStrengthField = (index: number) => {
    setStrengthInputs((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!summary.trim() || !critique.trim()) {
      toast("Please complete both the executive summary and critique sections", { tone: "error" })
      return
    }

    setSubmitting(true)
    const validStrengths = strengthInputs.map((s) => s.trim()).filter(Boolean)
    const overall = Number(
      ((scores.methodology + scores.clarity + scores.rigor + scores.citations) / 4).toFixed(1)
    )

    try {
      addPeerReview({
        postId,
        author: reviewerUser,
        affiliation: affiliation.trim() || "Independent Peer Reviewer",
        decision,
        scores,
        overallScore: overall,
        summary: summary.trim(),
        strengths: validStrengths.length > 0 ? validStrengths : ["Sound premise and clear presentation"],
        critique: critique.trim(),
        competingInterests: competingInterests.trim() || "None declared",
        isVerifiedPeer: true,
      })

      toast("Peer review submitted and recorded on PRISM", { tone: "success" })
      onClose()
      // Reset form
      setSummary("")
      setCritique("")
      setStrengthInputs(["", ""])
    } catch {
      toast("Failed to submit peer review", { tone: "error" })
    } finally {
      setSubmitting(false)
    }
  }

  const averageScore = Number(
    ((scores.methodology + scores.clarity + scores.rigor + scores.citations) / 4).toFixed(1)
  )

  return (
    <DialogShell open={open} onClose={onClose} label="Submit Peer Review" className="max-w-2xl">
      <div className="max-h-[85vh] overflow-y-auto px-1 sm:px-2 py-1 pr-3">
        {/* Header */}
        <div className="border-b border-[var(--border)] pb-4 mb-6">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[var(--accent)]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Scholarly Evaluation Dossier</span>
          </div>
          <h2 className="display text-2xl sm:text-3xl mt-1 text-[var(--fg)]">
            Submit a Peer Review
          </h2>
          <p className="text-sm text-[var(--fg-muted)] mt-1 truncate">
            Evaluating: <span className="text-[var(--fg)] font-medium font-serif italic">{postTitle}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Reviewer identity & affiliation */}
          <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar src={reviewerUser.avatarUrl} alt={reviewerUser.displayName} size="md" />
              <div>
                <div className="flex items-center gap-1.5 font-semibold text-sm text-[var(--fg)]">
                  <span>{reviewerUser.displayName}</span>
                  <span className="text-[0.6875rem] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-medium">
                    Verified Peer
                  </span>
                </div>
                <p className="text-xs text-[var(--fg-muted)]">@{reviewerUser.username}</p>
              </div>
            </div>

            <div className="w-full sm:w-64">
              <label htmlFor="pr-affiliation" className="block text-xs font-medium text-[var(--fg-muted)] mb-1">
                Domain / Institutional Affiliation
              </label>
              <input
                id="pr-affiliation"
                type="text"
                value={affiliation}
                onChange={(e) => setAffiliation(e.target.value)}
                placeholder="e.g. Distributed Systems Lab / Fellow"
                className="w-full h-9 px-3 rounded-xl bg-[var(--panel)] border border-[var(--border)] text-xs text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
          </div>

          {/* Verdict selection */}
          <div>
            <label className="block text-sm font-semibold text-[var(--fg)] mb-2">
              Review Recommendation & Verdict
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {DECISIONS.map((d) => {
                const isSelected = decision === d.value
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setDecision(d.value)}
                    className={cn(
                      "p-3 rounded-2xl text-left border transition-all duration-150 flex flex-col justify-between",
                      isSelected
                        ? `${d.color} ring-2 ring-current`
                        : "bg-[var(--panel)] border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:text-[var(--fg)]"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs uppercase tracking-wide">
                        {d.title}
                      </span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-current" />}
                    </div>
                    <p className="text-xs mt-1.5 opacity-80 leading-snug">{d.desc}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Quantitative Rubric (1-5 scale) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-[var(--fg)]">
                Evaluation Criteria (1 to 5)
              </label>
              <span className="text-xs font-mono font-medium text-[var(--accent)]">
                Calculated Score: {averageScore} / 5.0
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
              {(
                [
                  { key: "methodology", label: "Methodology & Soundness", hint: "Empirical rigor & logical proof" },
                  { key: "clarity", label: "Clarity & Exposition", hint: "Readability, prose & structure" },
                  { key: "rigor", label: "Novelty & Depth", hint: "Original contribution to field" },
                  { key: "citations", label: "Citations & Evidence", hint: "Attribution and primary references" },
                ] as const
              ).map((crit) => (
                <div key={crit.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[var(--fg)]">{crit.label}</span>
                    <span className="font-mono font-bold text-[var(--accent)]">
                      {scores[crit.key]} / 5
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => handleScoreChange(crit.key, star)}
                        className={cn(
                          "flex-1 h-8 rounded-lg flex items-center justify-center transition-all text-xs font-mono font-medium border",
                          scores[crit.key] >= star
                            ? "bg-[var(--accent)] text-[var(--on-accent)] border-[var(--accent)]"
                            : "bg-[var(--panel)] text-[var(--fg-muted)] border-[var(--border)] hover:bg-[var(--surface)]"
                        )}
                      >
                        {star}
                      </button>
                    ))}
                  </div>
                  <p className="text-[0.6875rem] text-[var(--fg-muted)]">{crit.hint}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Executive Summary */}
          <div>
            <label htmlFor="pr-summary" className="block text-sm font-semibold text-[var(--fg)] mb-1">
              Executive Assessment / Summary <span className="text-rose-500">*</span>
            </label>
            <p className="text-xs text-[var(--fg-muted)] mb-2">
              Concise synthesis of the paper’s thesis, theoretical validity, and impact.
            </p>
            <textarea
              id="pr-summary"
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="State the core merits, reproducibility, and architectural significance of this piece..."
              required
              className="w-full p-3 rounded-2xl bg-[var(--panel)] border border-[var(--border)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          {/* Key Strengths */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-semibold text-[var(--fg)]">
                Key Strengths & Contributions
              </label>
              {strengthInputs.length < 5 && (
                <button
                  type="button"
                  onClick={addStrengthField}
                  className="inline-flex items-center gap-1 text-xs text-[var(--accent)] hover:underline font-medium"
                >
                  <Plus className="w-3.5 h-3.5" /> Add highlight
                </button>
              )}
            </div>
            <div className="space-y-2">
              {strengthInputs.map((str, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-center font-mono">
                    ✓
                  </span>
                  <input
                    type="text"
                    value={str}
                    onChange={(e) => handleStrengthChange(idx, e.target.value)}
                    placeholder={`Strength point #${idx + 1} (e.g. Concrete error-handling patterns)`}
                    className="flex-1 h-9 px-3 rounded-xl bg-[var(--panel)] border border-[var(--border)] text-xs text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                  {strengthInputs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeStrengthField(idx)}
                      className="p-1.5 text-[var(--fg-muted)] hover:text-rose-500 transition-colors"
                      aria-label="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Detailed Critique & Recommendations */}
          <div>
            <label htmlFor="pr-critique" className="block text-sm font-semibold text-[var(--fg)] mb-1">
              Constructive Critique & Limitations <span className="text-rose-500">*</span>
            </label>
            <p className="text-xs text-[var(--fg-muted)] mb-2">
              Highlight areas requiring edge-case analysis, additional citations, or technical clarifications.
            </p>
            <textarea
              id="pr-critique"
              rows={3}
              value={critique}
              onChange={(e) => setCritique(e.target.value)}
              placeholder="What could be improved? Note potential unhandled edge cases, latency boundaries, or missing proofs..."
              required
              className="w-full p-3 rounded-2xl bg-[var(--panel)] border border-[var(--border)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          {/* Competing Interests */}
          <div>
            <label htmlFor="pr-competing" className="block text-xs font-medium text-[var(--fg-muted)] mb-1">
              Transparency & Competing Interests
            </label>
            <input
              id="pr-competing"
              type="text"
              value={competingInterests}
              onChange={(e) => setCompetingInterests(e.target.value)}
              placeholder="Declare any commercial, corporate or personal affiliations, or 'None declared'"
              className="w-full h-9 px-3 rounded-xl bg-[var(--panel)] border border-[var(--border)] text-xs text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="h-10 px-5 rounded-full text-sm font-medium border border-[var(--border)] hover:bg-[var(--surface)] transition-colors text-[var(--fg)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-10 px-6 rounded-full text-sm font-semibold bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--fg-secondary)] transition-colors disabled:opacity-50"
            >
              {submitting ? "Publishing Review..." : "Publish Peer Review"}
            </button>
          </div>
        </form>
      </div>
    </DialogShell>
  )
}

