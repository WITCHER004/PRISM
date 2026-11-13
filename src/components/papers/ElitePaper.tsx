"use client"

import { createContext, useContext } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowRight, BadgeCheck, LogIn } from "lucide-react"
import { useViewer } from "@/components/providers/useViewer"
import { DEV_TOOLS } from "@/lib/devtools"
import { depthLabel, type AdvancedPaper } from "@/lib/papers"
import { useUIStore, toast } from "@/lib/store"
import { cn } from "@/lib/utils"

/* ── Mark & badge ──────────────────────────────────────────────────────────── */

/** Four-point spark: the Elite mark */
export function EliteSpark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={cn("w-3 h-3 shrink-0", className)}>
      <path
        fill="currentColor"
        d="M8 0c.55 4.4 3.05 6.9 8 8-4.95 1.1-7.45 3.6-8 8-.55-4.4-3.05-6.9-8-8 4.95-1.1 7.45-3.6 8-8Z"
      />
    </svg>
  )
}

export function ElitePaperBadge({ onDark, className, label = "Advanced Paper · Elite" }: { onDark?: boolean; className?: string; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border text-[0.6875rem] font-semibold tracking-[0.01em] whitespace-nowrap",
        onDark
          ? "border-amber-300/35 bg-amber-400/15 text-amber-100 backdrop-blur"
          : "border-[var(--elite-line)] bg-[var(--elite-wash)] text-[var(--elite-ink)]",
        className
      )}
    >
      <EliteSpark className="w-2.5 h-2.5" />
      {label}
    </span>
  )
}

/* ── Access ────────────────────────────────────────────────────────────────── */

type Scope = { author: string; paper: AdvancedPaper }
const PaperScopeContext = createContext<Scope | null>(null)

/**
 * Wrap an Advanced Paper's page in this. Inside it, the paywall hooks (usePostUnlocked and the
 * components built on it) switch to Elite rules: Elite members, the author, or the dev demo view.
 */
export function PaperScope({ author, paper, children }: Scope & { children: React.ReactNode }) {
  return <PaperScopeContext.Provider value={{ author, paper }}>{children}</PaperScopeContext.Provider>
}

export type PaperAccess = { scoped: boolean; canRead: boolean; via: "elite" | "author" | "demo" | null }

export function usePaperAccess(): PaperAccess {
  const scope = useContext(PaperScopeContext)
  const { viewer, isElite, demoElite } = useViewer()
  if (!scope) return { scoped: false, canRead: true, via: null }
  const via = isElite ? "elite" : viewer && viewer.username === scope.author ? "author" : demoElite ? "demo" : null
  return { scoped: true, canRead: via !== null, via }
}

/* ── Reader pieces ─────────────────────────────────────────────────────────── */

/** The abstract every reader sees: depth and the writer's three takeaways */
export function PaperAbstract({ paper, className }: { paper: AdvancedPaper; className?: string }) {
  const points = paper.takeaways.filter((t) => t.trim())
  if (!points.length) return null
  return (
    <section
      aria-labelledby="paper-abstract"
      className={cn("rounded-[20px] border border-[var(--border)] bg-[var(--panel)] p-6 sm:p-7 shadow-[var(--shadow)]", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="paper-abstract" className="font-display font-semibold text-lg tracking-tight">
          Abstract
        </h2>
        <span className="text-xs font-medium text-[var(--elite-ink)]">{depthLabel(paper.depth)}</span>
      </div>
      <ul className="mt-4 space-y-3.5">
        {points.map((t, i) => (
          <li key={i} className="flex gap-3">
            <EliteSpark className="mt-[0.55em] w-2.5 h-2.5 text-[var(--elite-ink)]" />
            <span className="font-serif text-[1.0625rem] leading-relaxed text-[var(--fg-secondary)]">{t}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Shown above the body once the reader has access */
export function PaperRibbon({ paper, className }: { paper: AdvancedPaper; className?: string }) {
  const { scoped, canRead, via } = usePaperAccess()
  const setDemoEliteView = useUIStore((s) => s.setDemoEliteView)
  if (!scoped || !canRead) return null
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 min-h-11 py-1.5 pl-3.5 pr-1.5 rounded-full border border-[var(--elite-line)] bg-[var(--elite-wash)] text-[var(--elite-ink)] text-sm",
        className
      )}
    >
      <span className="flex items-center gap-2 min-w-0">
        <EliteSpark className="w-3.5 h-3.5" />
        <strong className="font-semibold whitespace-nowrap">
          {via === "author" ? "Your Advanced Paper" : "Unlocked with Prism Elite"}
        </strong>
        <span className="hidden sm:inline truncate opacity-80">
          · {via === "author" ? "readers need Elite past the opening" : depthLabel(paper.depth)}
        </span>
      </span>
      {via === "demo" && (
        <button
          type="button"
          onClick={() => {
            setDemoEliteView(false)
            toast("Back to the free reader's view")
          }}
          className="shrink-0 h-8 px-3 rounded-full text-xs font-medium bg-[var(--panel)] border border-[var(--elite-line)] hover:bg-[var(--bg)] transition-colors"
        >
          Exit demo view
        </button>
      )}
    </div>
  )
}

interface PaperGateProps {
  wordCount: number
  deepReadMin: number
  /** e.g. "Peer-reviewed" or "Editor-reviewed" */
  review: string
}

/** Sits over the faded end of the preview for readers without Elite */
export function PaperGate({ wordCount, deepReadMin, review }: PaperGateProps) {
  const pathname = usePathname()
  const { viewer } = useViewer()
  const demoEliteView = useUIStore((s) => s.demoEliteView)
  const setDemoEliteView = useUIStore((s) => s.setDemoEliteView)

  return (
    <section
      aria-labelledby="paper-gate-title"
      className="relative -mt-20 overflow-hidden rounded-[24px] border border-[var(--elite-line)] bg-[var(--panel)]/80 backdrop-blur-xl shadow-[var(--shadow-lift)]"
    >
      {/* Warm light from above, as if the paper underneath were lit */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(70%_100%_at_50%_0%,var(--elite-glow),transparent)]"
      />
      <div className="relative p-6 sm:p-9">
        <ElitePaperBadge />
        <h2 id="paper-gate-title" className="display mt-5 max-w-[24ch] text-[1.75rem] sm:text-[2.125rem] leading-[1.06]">
          This Advanced Paper is reserved for Prism Elite members.
        </h2>
        <p className="mt-3 max-w-[54ch] text-[var(--fg-muted)] leading-relaxed">
          You&apos;ve read the abstract and the opening quarter. Elite opens the full paper, its sources, and every
          Advanced Paper on Prism.
        </p>

        <dl className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-px overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--border)]">
          <div className="bg-[var(--bg)] px-4 py-3.5">
            <dt className="meta">Length</dt>
            <dd className="mt-1 font-display text-xl font-semibold tracking-tight tabular-nums">
              {wordCount.toLocaleString("en-US")} <span className="text-sm font-normal text-[var(--fg-muted)]">words</span>
            </dd>
          </div>
          <div className="bg-[var(--bg)] px-4 py-3.5">
            <dt className="meta">Deep read</dt>
            <dd className="mt-1 font-display text-xl font-semibold tracking-tight tabular-nums">
              ~{deepReadMin} <span className="text-sm font-normal text-[var(--fg-muted)]">min</span>
            </dd>
          </div>
          <div className="bg-[var(--bg)] px-4 py-3.5">
            <dt className="meta">Verification</dt>
            <dd className="mt-1.5 flex items-center gap-1.5 text-[0.9375rem] font-medium">
              <BadgeCheck className="w-4 h-4 text-[var(--elite-ink)]" />
              {review}
            </dd>
          </div>
        </dl>

        <div className="mt-7 flex flex-wrap items-center gap-2.5">
          <Link
            href="/elite"
            className="inline-flex items-center gap-2 h-12 px-6 rounded-full bg-[var(--nav-cta)] hover:bg-[var(--nav-cta-hover)] text-[var(--nav-cta-fg)] text-[0.9375rem] font-medium tracking-tight shadow-xs hover:shadow transition-all"
          >
            <EliteSpark className="w-3.5 h-3.5 text-[var(--gold)]" />
            Unlock with Prism Elite
            <ArrowRight className="w-4 h-4" />
          </Link>
          {!viewer && (
            <Link
              href={`/auth/login?redirectTo=${encodeURIComponent(pathname)}`}
              className="inline-flex items-center gap-2 h-12 px-5 rounded-full border border-[var(--border-strong)] bg-[var(--panel)] text-[0.9375rem] font-medium hover:border-[var(--fg)] transition-colors"
            >
              <LogIn className="w-4 h-4" /> Sign in
            </Link>
          )}
        </div>

        {DEV_TOOLS && (
          <label className="mt-6 pt-5 border-t border-dashed border-[var(--border-strong)] flex items-center justify-between gap-4 cursor-pointer">
            <span>
              <span className="block text-sm font-medium">Demo: Switch to Elite View</span>
              <span className="block text-xs text-[var(--fg-muted)] mt-0.5">
                Development builds only. Reads this paper as an Elite member would.
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={demoEliteView}
              onClick={() => setDemoEliteView(!demoEliteView)}
              className={cn(
                "relative shrink-0 w-11 h-6 rounded-full border transition-colors",
                demoEliteView ? "bg-[var(--gold)] border-[var(--gold)]" : "bg-[var(--surface)] border-[var(--border-strong)]"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-xs transition-transform",
                  demoEliteView && "translate-x-5"
                )}
              />
            </button>
          </label>
        )}
      </div>
    </section>
  )
}

/** PaperScope when the story is an Advanced Paper; otherwise renders children as-is */
export function MaybePaperScope({ paper, author, children }: { paper?: AdvancedPaper; author: string; children: React.ReactNode }) {
  return paper ? <PaperScope paper={paper} author={author}>{children}</PaperScope> : <>{children}</>
}
