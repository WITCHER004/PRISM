"use client"

import { CircleAlert, CircleCheck } from "lucide-react"
import type { ArticleStatus, Phase1Report as Report } from "@/lib/moderation/types"
import { STATUS_META } from "@/lib/moderation/workflow"
import { cn, formatRelativeDate } from "@/lib/utils"

const pct = (n: number) => `${Math.round(n)}%`

/** Split bar: human share vs AI share, with the 20% AI limit marked */
export function AIHumanGauge({ aiPercent, threshold, className }: { aiPercent: number; threshold: number; className?: string }) {
  const human = Math.max(0, 100 - aiPercent)
  const passed = aiPercent <= threshold
  return (
    <div className={className}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="meta">Human-written</p>
          <p className="display text-[2.25rem] leading-none mt-1 tabular-nums">{pct(human)}</p>
        </div>
        <div className="text-right">
          <p className="meta">AI-generated</p>
          <p
            className={cn(
              "display text-[2.25rem] leading-none mt-1 tabular-nums",
              passed ? "text-[var(--fg-muted)]" : "text-[var(--error)]"
            )}
          >
            {pct(aiPercent)}
          </p>
        </div>
      </div>

      <div
        role="meter"
        aria-label="Share of the text judged AI-generated"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(aiPercent)}
        aria-valuetext={`${pct(aiPercent)} AI-generated, ${pct(human)} human-written; the limit is ${threshold}% AI`}
        className="relative mt-4 h-3 rounded-full bg-[var(--surface)] overflow-hidden flex"
      >
        <span className="h-full bg-[var(--accent)] transition-[width] duration-500" style={{ width: `${human}%` }} />
        <span
          className={cn("h-full transition-[width] duration-500", passed ? "bg-[var(--fg-subtle)]" : "bg-[var(--error)]")}
          style={{ width: `${aiPercent}%` }}
        />
      </div>
      {/* Limit marker, measured from the right edge (AI side) */}
      <div className="relative h-5 mt-1" aria-hidden>
        <span className="absolute top-0 h-2 w-px bg-[var(--fg)]" style={{ right: `${threshold}%` }} />
        <span className="absolute top-2 text-[11px] text-[var(--fg-muted)] translate-x-1/2 whitespace-nowrap" style={{ right: `${threshold}%` }}>
          {threshold}% AI limit
        </span>
      </div>
    </div>
  )
}

export function Phase1Verdict({ report }: { report: Report }) {
  return report.passed ? (
    <p className="flex items-start gap-2 text-sm text-[var(--fg-secondary)]">
      <CircleCheck className="w-4 h-4 mt-0.5 shrink-0 text-[var(--accent)]" />
      <span>
        <span className="font-semibold text-[var(--fg)]">Passed Phase 1.</span> At most {report.threshold}% may read as
        AI-generated; this came in at {pct(report.aiPercent)}.
      </span>
    </p>
  ) : (
    <p className="flex items-start gap-2 text-sm text-[var(--fg-secondary)]">
      <CircleAlert className="w-4 h-4 mt-0.5 shrink-0 text-[var(--error)]" />
      <span>
        <span className="font-semibold text-[var(--error)]">Didn&apos;t pass Phase 1.</span> {pct(report.aiPercent)} reads as
        AI-generated; the limit is {report.threshold}%. Rewrite the flagged passages in your own words and submit again.
      </span>
    </p>
  )
}

/** Full Phase 1 breakdown: gauge, verdict, per-signal scores and flagged passages */
export function Phase1Breakdown({ report, compact = false }: { report: Report; compact?: boolean }) {
  return (
    <div className="space-y-5">
      <AIHumanGauge aiPercent={report.aiPercent} threshold={report.threshold} />
      <Phase1Verdict report={report} />

      <div>
        <p className="meta mb-2">Signals</p>
        <ul className="divide-y divide-[var(--border)] rounded-[14px] border border-[var(--border)]">
          {report.signals.map((s) => (
            <li key={s.key} className="px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">{s.label}</span>
                <span className="tabular-nums text-xs text-[var(--fg-muted)]">{Math.round(s.aiLikelihood * 100)}% AI-like</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-[var(--surface)] overflow-hidden" aria-hidden>
                <span
                  className={cn("block h-full rounded-full", s.aiLikelihood >= 0.5 ? "bg-[var(--error)]" : "bg-[var(--fg-subtle)]")}
                  style={{ width: `${Math.max(2, s.aiLikelihood * 100)}%` }}
                />
              </div>
              {!compact && <p className="mt-1.5 text-xs text-[var(--fg-muted)] leading-relaxed">{s.detail}</p>}
            </li>
          ))}
        </ul>
      </div>

      {report.flagged.length > 0 && (
        <div>
          <p className="meta mb-2">Passages that read as machine-written</p>
          <ul className="space-y-2">
            {report.flagged.map((f, i) => (
              <li key={i} className="rounded-[12px] border border-[var(--error)]/25 bg-[var(--panel)] p-3">
                <p className="text-sm leading-relaxed text-[var(--fg-secondary)] line-clamp-4">{f.excerpt}</p>
                <p className="mt-1.5 text-xs font-medium text-[var(--error)] tabular-nums">{Math.round(f.aiLikelihood * 100)}% AI-like</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-[var(--fg-subtle)]">
        {report.wordCount} words · {report.confidence} confidence · detector: {report.provider} · checked{" "}
        {formatRelativeDate(report.analyzedAt)}
      </p>
    </div>
  )
}

const TONE: Record<(typeof STATUS_META)[ArticleStatus]["tone"], string> = {
  neutral: "border-[var(--border-strong)] text-[var(--fg-muted)] bg-[var(--panel)]",
  info: "border-[var(--accent)]/30 text-[var(--accent)] bg-[var(--panel)]",
  ok: "border-transparent bg-[var(--accent-subtle)] text-[var(--accent)]",
  warn: "border-[var(--error)]/30 text-[var(--error)] bg-[var(--panel)]",
  error: "border-transparent bg-[var(--error)]/10 text-[var(--error)]",
}
const DOT: Record<(typeof STATUS_META)[ArticleStatus]["tone"], string> = {
  neutral: "bg-[var(--fg-subtle)]",
  info: "bg-[var(--accent)]",
  ok: "bg-[var(--accent)]",
  warn: "bg-[var(--error)]",
  error: "bg-[var(--error)]",
}

export function StatusPill({ status, tracker = false, className }: { status: ArticleStatus; tracker?: boolean; className?: string }) {
  const meta = STATUS_META[status]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border text-xs font-medium whitespace-nowrap",
        TONE[meta.tone],
        className
      )}
    >
      <span aria-hidden className={cn("w-1.5 h-1.5 rounded-full", DOT[meta.tone])} />
      {tracker ? meta.tracker : meta.label}
    </span>
  )
}
