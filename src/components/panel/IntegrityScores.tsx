"use client"

import { useMemo } from "react"
import { Bot, Copy } from "lucide-react"
import { AI_MAX_PERCENT, PLAGIARISM_MAX_PERCENT } from "@/lib/moderation/workflow"
import { overlapWithCorpus } from "@/lib/moderation/similarity"
import { useUIStore, type Draft } from "@/lib/store"
import { cn } from "@/lib/utils"


/**
 * The two integrity numbers reviewers see first: Phase 1's AI-detection score, and how much of the
 * text matches existing writing. The submission-time score (lexical + the engine's semantic paraphrase
 * search, when configured) is shown when stored; otherwise the lexical overlap is measured live.
 */
export function IntegrityScores({ draft, className }: { draft: Draft; className?: string }) {
  const drafts = useUIStore((s) => s.drafts)
  const html = draft.submitted?.contentHtml ?? draft.contentHtml
  const overlap = useMemo(() => {
    const corpus = [
      ...Object.values(drafts)
        .filter((d) => d.live)
        .map((d) => ({ id: d.id, title: d.live!.title, html: d.live!.contentHtml, url: `/${d.authorUsername}/${d.slug}` })),
    ]
    return overlapWithCorpus(html, corpus, draft.id)
  }, [drafts, html, draft.id])

  const ai = draft.phase1?.aiPercent
  const aiHigh = ai !== undefined && ai > AI_MAX_PERCENT
  const stored = draft.phase1?.plagiarismScore
  const plagiarism = stored ?? overlap.percent
  const overlapHigh = plagiarism > PLAGIARISM_MAX_PERCENT
  const domain = draft.phase1?.detectedDomain
  const confidence = draft.phase1?.confidenceLevel

  return (
    <section className={cn("panel p-5", className)} aria-label="Integrity scores">
      <h2 className="font-display text-lg font-semibold tracking-tight">Integrity</h2>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div className={cn("rounded-[12px] border p-3", aiHigh ? "border-rose-200 bg-rose-50/60" : "border-[var(--border)]")}>
          <dt className="meta flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5" /> AI detection
          </dt>
          <dd className="mt-1.5 font-display text-2xl font-semibold tabular-nums">{ai === undefined ? "–" : `${Math.round(ai)}%`}</dd>
          <dd className="text-xs text-[var(--fg-muted)]">
            Limit {AI_MAX_PERCENT}%{confidence ? ` · ${confidence}` : ""}
          </dd>
        </div>
        <div className={cn("rounded-[12px] border p-3", overlapHigh ? "border-amber-300 bg-amber-50/60" : "border-[var(--border)]")}>
          <dt className="meta flex items-center gap-1.5">
            <Copy className="w-3.5 h-3.5" /> Plagiarism
          </dt>
          <dd className="mt-1.5 font-display text-2xl font-semibold tabular-nums">{Math.round(plagiarism * 10) / 10}%</dd>
          <dd className="text-xs text-[var(--fg-muted)]">Limit {PLAGIARISM_MAX_PERCENT}% · {stored !== undefined ? "at submission" : "overlap with Prism stories"}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-[var(--fg-muted)] leading-relaxed">
        {overlap.closest
          ? `Closest match: “${overlap.closest.title}” (${overlap.closest.percent}% of phrases). `
          : "No shared phrasing with any published Prism story. "}
        Compared against {overlap.compared} stories on Prism{domain ? `; scored with the ${domain} calibration profile` : ""}.
      </p>
    </section>
  )
}
