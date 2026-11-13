"use client"

import { useEffect, useId, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { BadgeCheck, Fingerprint, Keyboard, ScanSearch, Timer } from "lucide-react"
import { formatDuration, type CraftCertificate } from "@/lib/craft"
import { AI_MAX_PERCENT } from "@/lib/moderation/workflow"
import { dur, ease } from "@/lib/motion"
import { cn } from "@/lib/utils"

// "✓ Verified Human Craft" pill by the byline; opens the Proof-of-Craft timeline
export function CraftBadge({ certificate, authorName, className }: { certificate: CraftCertificate; authorName: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const c = certificate

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("pointerdown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          "inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[0.8125rem] font-medium transition-colors",
          c.verified
            ? "border-[var(--craft-line)] bg-[var(--craft-wash)] text-[var(--craft-ink)] hover:border-[var(--craft-ink)]"
            : "border-[var(--border)] bg-[var(--panel)] text-[var(--fg-muted)] hover:border-[var(--border-strong)]"
        )}
      >
        {c.verified ? <BadgeCheck className="w-4 h-4" strokeWidth={2} /> : <Fingerprint className="w-4 h-4" />}
        {c.verified ? "Verified Human Craft" : "Craft record"}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={panelId}
            role="dialog"
            aria-label="Proof of Craft"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: dur.fast * 1.4, ease: ease.out } }}
            exit={{ opacity: 0, y: -6, scale: 0.98, transition: { duration: dur.fast, ease: ease.in } }}
            className="absolute left-0 top-full mt-2 z-40 w-[min(372px,calc(100vw-2rem))] origin-top-left rounded-[20px] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-lift)] p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display font-semibold text-[1.0625rem] tracking-tight">Proof of Craft</h3>
                <p className="mt-0.5 text-xs text-[var(--fg-muted)]">How {authorName} wrote this, recorded by the Prism editor.</p>
              </div>
              <span
                className={cn(
                  "shrink-0 inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] font-semibold",
                  c.verified ? "bg-[var(--craft-wash)] text-[var(--craft-ink)]" : "bg-[var(--surface)] text-[var(--fg-muted)]"
                )}
              >
                {c.verified ? <BadgeCheck className="w-3.5 h-3.5" /> : null}
                {c.verified ? "Verified" : "Not verified"}
              </span>
            </div>

            <GrowthSparkline certificate={c} className="mt-4" />

            <ol className="mt-2 grid grid-cols-4 gap-1 text-center">
              {c.revisionSnapshots.map((s) => (
                <li key={s.label} className="min-w-0">
                  <p className="text-[11px] font-medium text-[var(--fg-secondary)] truncate">{s.label}</p>
                  <p className="text-[11px] leading-snug text-[var(--fg-muted)] tabular-nums">
                    {s.words.toLocaleString("en-US")} words
                    <span className="block">{formatDuration(s.minute)}</span>
                  </p>
                </li>
              ))}
            </ol>

            <dl className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--border)]">
              <Stat icon={Timer} label="Drafting">
                {formatDuration(c.writingDurationMinutes)}
                <span className="block text-[11px] font-normal text-[var(--fg-muted)]">
                  {c.sessions} {c.sessions === 1 ? "sitting" : "sittings"}
                </span>
              </Stat>
              <Stat icon={Keyboard} label="Authenticity">
                {c.authenticityScore}
                <span className="text-[11px] font-normal text-[var(--fg-muted)]">/100</span>
                <span className="block text-[11px] font-normal text-[var(--fg-muted)]">
                  {c.typedVsPastedRatio === null ? "not recorded" : `${Math.round(c.typedVsPastedRatio * 100)}% typed`}
                </span>
              </Stat>
              <Stat icon={ScanSearch} label="AI check">
                {c.aiCheckScore === null ? "—" : `${c.aiCheckScore}%`}
                <span
                  className={cn(
                    "block text-[11px] font-normal",
                    c.aiCheckScore !== null && c.aiCheckScore <= AI_MAX_PERCENT ? "text-[var(--craft-ink)]" : "text-[var(--fg-muted)]"
                  )}
                >
                  {c.aiCheckScore === null ? "not run" : c.aiCheckScore <= AI_MAX_PERCENT ? `passes ≤${AI_MAX_PERCENT}%` : `over ${AI_MAX_PERCENT}%`}
                </span>
              </Stat>
            </dl>

            <p className="mt-3.5 text-[11px] leading-relaxed text-[var(--fg-subtle)]">
              Only counts and timings are recorded, never the keystrokes or pasted text themselves. Verified means the
              AI check passed and most of the text was typed in Prism.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Stat({ icon: Icon, label, children }: { icon: typeof Timer; label: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--bg)] px-3 py-2.5 min-w-0">
      <dt className="flex items-center gap-1 text-[11px] text-[var(--fg-muted)]">
        <Icon className="w-3 h-3" />
        {label}
      </dt>
      <dd className="mt-1 font-display text-base font-semibold tracking-tight tabular-nums leading-tight">{children}</dd>
    </div>
  )
}

/** Word count over active writing time, with the four milestones marked */
function GrowthSparkline({ certificate, className }: { certificate: CraftCertificate; className?: string }) {
  const W = 320
  const H = 72
  const pad = 4
  const pts = certificate.growth
  const maxMs = Math.max(1, ...pts.map((p) => p.ms))
  const maxWords = Math.max(1, ...pts.map((p) => p.words))
  const x = (ms: number) => pad + (ms / maxMs) * (W - pad * 2)
  const y = (w: number) => H - pad - (w / maxWords) * (H - pad * 2 - 6)
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.ms).toFixed(1)},${y(p.words).toFixed(1)}`).join(" ")
  const area = `${line} L${x(pts[pts.length - 1].ms).toFixed(1)},${H - pad} L${x(pts[0].ms).toFixed(1)},${H - pad} Z`
  const marks = certificate.revisionSnapshots.map((s) => {
    const near = pts.reduce((a, b) => (Math.abs(b.ms / 60_000 - s.minute) < Math.abs(a.ms / 60_000 - s.minute) ? b : a), pts[0])
    return { label: s.label, cx: x(near.ms), cy: y(s.words) }
  })
  const gid = useId()

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Draft grew from ${pts[0]?.words ?? 0} to ${certificate.revisionSnapshots[3]?.words ?? 0} words over ${formatDuration(certificate.writingDurationMinutes)} of writing`}
      className={cn("w-full h-auto text-[var(--craft-ink)]", className)}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={pad} x2={W - pad} y1={H - pad} y2={H - pad} stroke="var(--border)" strokeWidth="1" />
      <path d={area} fill={`url(#${CSS.escape(gid)})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {marks.map((m) => (
        <circle key={m.label} cx={m.cx} cy={m.cy} r="3.25" fill="var(--panel)" stroke="currentColor" strokeWidth="1.75" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  )
}
