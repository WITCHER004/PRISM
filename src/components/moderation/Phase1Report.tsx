"use client"

import { CircleAlert, CircleCheck, Code2, Copy, Quote } from "lucide-react"
import type { ArticleStatus, FlaggedSentence, Phase1Report as Report } from "@/lib/moderation/types"
import { PLAGIARISM_MAX_PERCENT, STATUS_META } from "@/lib/moderation/workflow"
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

/** Site-relative paths and http(s) only (match links come from the engine and other authors' stories) */
const safeLink = (u?: string | null) => {
  if (!u) return undefined
  const t = u.trim()
  if (t.startsWith("/") && !t.startsWith("//") && !t.startsWith("/\\")) return t
  return /^https?:\/\//i.test(t) ? t : undefined
}

const DOMAIN_LABEL: Record<string, string> = {
  programming: "Programming",
  infrastructure: "Infrastructure",
  academic: "Academic / science",
  essay: "Essay / long-form",
  journalism: "Policy / journalism",
  general: "General",
}

export function Phase1Verdict({ report }: { report: Report }) {
  const plagLimit = report.plagiarismThreshold ?? PLAGIARISM_MAX_PERCENT
  const aiFailed = report.aiPassed === undefined ? !report.passed : !report.aiPassed
  const plagFailed = report.plagiarismPassed === false
  if (report.manualReview)
    return (
      <p className="flex items-start gap-2 text-sm text-[var(--fg-secondary)]">
        <CircleAlert className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
        <span>
          <span className="font-semibold text-[var(--fg)]">Sent to manual review.</span> {pct(report.aiPercent)} reads as
          AI-generated, above the {report.threshold}% limit but within the range where careful human writing is sometimes
          misread (formal, technical or second-language prose). A Prism reviewer will read it instead of an automatic
          rejection. Reviewing the flagged sentences below can still help.
        </span>
      </p>
    )
  if (!report.passed && plagFailed && !aiFailed)
    return (
      <p className="flex items-start gap-2 text-sm text-[var(--fg-secondary)]">
        <CircleAlert className="w-4 h-4 mt-0.5 shrink-0 text-[var(--error)]" />
        <span>
          <span className="font-semibold text-[var(--error)]">Didn&apos;t pass Phase 1.</span> {pct(report.plagiarismScore ?? 0)} of the
          text matches existing writing; the limit is {plagLimit}%. Put borrowed passages in a blockquote with attribution, or
          rewrite them in your own words, then submit again.
        </span>
      </p>
    )
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
        AI-generated; the limit is {report.threshold}%.
        {plagFailed ? ` ${pct(report.plagiarismScore ?? 0)} also matches existing writing (limit ${plagLimit}%).` : ""} Rewrite the
        flagged sentences in your own words and submit again.
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
      <IntegrityFacts report={report} />

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

      {report.flaggedSentences ? (
        <FlaggedSentences items={report.flaggedSentences} compact={compact} />
      ) : report.flagged.length > 0 && (
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

/** Plagiarism score, detected domain, confidence and what was excluded from scoring */
function IntegrityFacts({ report }: { report: Report }) {
  if (report.plagiarismScore === undefined && !report.detectedDomain) return null
  const limit = report.plagiarismThreshold ?? PLAGIARISM_MAX_PERCENT
  const plagHigh = (report.plagiarismScore ?? 0) > limit
  const excluded = report.excluded
  return (
    <div className="space-y-2.5">
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div className={cn("rounded-[12px] border p-2.5", plagHigh ? "border-[var(--error)]/40" : "border-[var(--border)]")}>
          <dt className="meta">Plagiarism</dt>
          <dd className={cn("mt-1 font-semibold tabular-nums", plagHigh && "text-[var(--error)]")}>
            {report.plagiarismScore === undefined ? "–" : pct(report.plagiarismScore)}
          </dd>
          <dd className="text-[11px] text-[var(--fg-muted)]">limit {limit}%</dd>
        </div>
        <div className="rounded-[12px] border border-[var(--border)] p-2.5">
          <dt className="meta">Domain</dt>
          <dd className="mt-1 font-semibold">{DOMAIN_LABEL[report.detectedDomain ?? "general"] ?? report.detectedDomain}</dd>
          <dd className="text-[11px] text-[var(--fg-muted)]">calibration profile</dd>
        </div>
        <div className={cn("rounded-[12px] border p-2.5", report.confidenceLevel === "Borderline" ? "border-amber-400/50" : "border-[var(--border)]")}>
          <dt className="meta">Confidence</dt>
          <dd className="mt-1 font-semibold">{report.confidenceLevel ?? "–"}</dd>
          <dd className="text-[11px] text-[var(--fg-muted)]">{report.confidenceLevel === "Borderline" ? "read it closely" : "of the AI score"}</dd>
        </div>
      </dl>
      {report.plagiarismMatches && report.plagiarismMatches.length > 0 && (
        <ul className="text-xs text-[var(--fg-muted)] space-y-0.5">
          {report.plagiarismMatches.slice(0, 3).map((m, i) => {
            const href = safeLink(m.url)
            return (
              <li key={i}>
                {pct(m.percent)} matches{" "}
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2">
                    {m.title}
                  </a>
                ) : (
                  m.title
                )}
              </li>
            )
          })}
        </ul>
      )}
      {(!!excluded?.codeBlocks || !!excluded?.quotes || !!report.craftAdjustment) && (
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--fg-subtle)]">
          {!!excluded?.codeBlocks && (
            <span className="inline-flex items-center gap-1">
              <Code2 className="w-3 h-3" /> {excluded.codeBlocks} code block{excluded.codeBlocks === 1 ? "" : "s"} not scored
            </span>
          )}
          {!!excluded?.quotes && (
            <span className="inline-flex items-center gap-1">
              <Quote className="w-3 h-3" /> {excluded.quotes} attributed quote{excluded.quotes === 1 ? "" : "s"} excluded
            </span>
          )}
          {!!report.craftAdjustment && (
            <span>
              Proof of Craft {report.craftAdjustment < 0 ? "lowered" : "raised"} a borderline score by {Math.abs(report.craftAdjustment)} pts
            </span>
          )}
        </p>
      )}
    </div>
  )
}

/** Exact sentences behind the scores, so authors can fix phrasing or add citations */
export function FlaggedSentences({ items, compact = false }: { items: FlaggedSentence[]; compact?: boolean }) {
  if (!items.length) return <p className="text-sm text-[var(--fg-muted)]">No individual sentences were flagged.</p>
  const shown = compact ? items.slice(0, 8) : items
  return (
    <div>
      <p className="meta mb-2">Flagged sentences ({items.length})</p>
      <ul className="space-y-2">
        {shown.map((f, i) => {
          const copied = !!(f.plagiarismMatchUrl || f.matchType)
          const href = safeLink(f.plagiarismMatchUrl)
          const title = f.plagiarismMatchTitle ?? "matched source"
          return (
            <li key={i} className={cn("rounded-[12px] border bg-[var(--panel)] p-3", copied ? "border-amber-400/50" : "border-[var(--error)]/25")}>
              <p className={cn("text-sm leading-relaxed text-[var(--fg-secondary)]", compact && "line-clamp-3")}>
                <mark className={cn("rounded px-0.5 text-inherit", copied ? "bg-amber-200/40" : "bg-[var(--error)]/10")}>{f.text}</mark>
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                {f.aiProbability >= 0.5 && <span className="font-medium text-[var(--error)] tabular-nums">{Math.round(f.aiProbability * 100)}% AI-like</span>}
                {copied && (
                  <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400">
                    <Copy className="w-3 h-3" />
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2">
                        {title}
                      </a>
                    ) : (
                      title
                    )}
                    {f.plagiarismSimilarity !== undefined && <span className="tabular-nums">· {Math.round(f.plagiarismSimilarity * 100)}%</span>}
                  </span>
                )}
              </div>
              {!compact && <p className="mt-1 text-xs text-[var(--fg-muted)] leading-relaxed">{f.reason}</p>}
            </li>
          )
        })}
      </ul>
      {shown.length < items.length && <p className="mt-2 text-xs text-[var(--fg-subtle)]">+{items.length - shown.length} more</p>}
    </div>
  )
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
      <span aria-hidden className={cn("w-1.5 h-1.5 shrink-0 rounded-full", DOT[meta.tone])} />
      <span className="min-w-0 truncate leading-tight">{tracker ? meta.tracker : meta.label}</span>
    </span>
  )
}
