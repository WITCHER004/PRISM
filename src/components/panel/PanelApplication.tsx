"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Check, ExternalLink, Loader2, Lock } from "lucide-react"
import { StudioDialog, DialogActions } from "@/components/studio/StudioDialog"
import { openUpgrade } from "@/components/elite/UpgradeDialog"
import { useHydrated } from "@/components/studio/useHydrated"
import { useAccess, usePanelInbox, useRoleActions } from "@/components/providers/useAccess"
import { Button } from "@/components/ui/Button"
import { EXPERTISE, STATEMENT_MAX, STATEMENT_MIN, validateApplication } from "@/lib/access"
import { hueStyle } from "@/lib/topics"
import { useUIStore, toast } from "@/lib/store"
import { cn, formatRelativeDate } from "@/lib/utils"
import { safeHref } from "@/lib/sanitize"

const openApply = () => useUIStore.getState().setPanelDialog("apply")
const openPending = () => useUIStore.getState().setPanelDialog("pending")

type Variant = "button" | "menu"

const shape: Record<Variant, string> = {
  button: "h-10 px-4 rounded-full text-sm",
  menu: "w-full h-9 px-2.5 rounded-[10px] text-[13.5px]",
}

/**
 * One button, four states (it never sends you to a separate portal):
 *   Free      → locked: "Upgrade to Elite to apply…" (opens the upgrade in place)
 *   none      → "⚖️ Apply for Review Panel" (application modal)
 *   pending   → amber "⏳ Panel Application Pending" (details + demo approval)
 *   approved  → "⚖️ Access Review Panel" with the live count of papers waiting on you
 */
export function PanelApplyButton({ variant = "button", onNavigate, className }: { variant?: Variant; onNavigate?: () => void; className?: string }) {
  const hydrated = useHydrated()
  const access = useAccess()
  const inbox = usePanelInbox(access.username)
  if (!hydrated || !access.username) return null

  const base = cn("inline-flex items-center gap-2 font-medium transition-colors", shape[variant], className)

  if (access.isPanelMember)
    return (
      <Link
        href="/panel"
        onClick={onNavigate}
        role={variant === "menu" ? "menuitem" : undefined}
        className={cn(base, "bg-[var(--fg)] text-[var(--bg)] hover:opacity-90", variant === "menu" && "justify-between")}
      >
        <span className="inline-flex items-center gap-2">
          <span aria-hidden>⚖️</span> Access Review Panel
        </span>
        {inbox.total > 0 && <CountBadge n={inbox.total} />}
      </Link>
    )

  if (!access.isElite)
    return (
      <button
        type="button"
        role={variant === "menu" ? "menuitem" : undefined}
        onClick={() => {
          onNavigate?.()
          openUpgrade()
        }}
        className={cn(base, "border border-dashed border-[var(--border-strong)] text-[var(--fg-muted)] hover:text-[var(--fg)] hover:border-[var(--fg)] text-left")}
      >
        <Lock className="w-3.5 h-3.5 shrink-0" />
        <span className={variant === "menu" ? "truncate" : undefined}>Upgrade to Elite to apply for the Peer Review Panel</span>
      </button>
    )

  if (access.panelApplicationStatus === "pending")
    return (
      <button
        type="button"
        role={variant === "menu" ? "menuitem" : undefined}
        onClick={() => {
          onNavigate?.()
          openPending()
        }}
        className={cn(base, "border border-amber-300/70 bg-amber-50 text-amber-900 hover:bg-amber-100 theme-dark:bg-amber-400/10 theme-dark:text-amber-200 theme-dark:border-amber-400/30")}
      >
        <span aria-hidden>⏳</span> Panel Application Pending
      </button>
    )

  return (
    <button
      type="button"
      role={variant === "menu" ? "menuitem" : undefined}
      onClick={() => {
        onNavigate?.()
        openApply()
      }}
      className={cn(base, "border border-[var(--elite-line)] bg-[var(--elite-wash)] text-[var(--elite-ink)] hover:border-[var(--elite-ink)]")}
    >
      <span aria-hidden>⚖️</span> {access.panelApplicationStatus === "rejected" ? "Reapply for Review Panel" : "Apply for Review Panel"}
    </button>
  )
}

export function CountBadge({ n, className }: { n: number; className?: string }) {
  return (
    <span
      aria-label={`${n} waiting`}
      className={cn("inline-grid place-items-center min-w-5 h-5 px-1.5 rounded-full bg-[var(--gold)] text-[#141413] text-[11px] font-semibold tabular-nums", className)}
    >
      {n}
    </span>
  )
}

/** Mounted once (ThemeProvider): the application form and the pending-details view */
export function PanelDialogs() {
  const which = useUIStore((s) => s.panelDialog)
  const setWhich = useUIStore((s) => s.setPanelDialog)
  const close = () => setWhich(null)
  return (
    <>
      <ApplyDialog open={which === "apply"} onClose={close} />
      <PendingDialog open={which === "pending"} onClose={close} />
    </>
  )
}

function ApplyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { applyForPanel } = useRoleActions()
  const [expertise, setExpertise] = useState<string[]>([])
  const [credentialsUrl, setCredentialsUrl] = useState("")
  const [statement, setStatement] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) setError("")
  }, [open])

  const toggle = (slug: string) => setExpertise((xs) => (xs.includes(slug) ? xs.filter((x) => x !== slug) : [...xs, slug]))
  const left = STATEMENT_MIN - statement.trim().length

  const submit = () => {
    const input = { expertise, credentialsUrl, statement }
    const problem = validateApplication(input)
    if (problem) return setError(problem)
    setBusy(true)
    const res = applyForPanel(input)
    setBusy(false)
    if (!res.ok) return setError(res.error)
    toast("Application sent. An admin will review it.", { tone: "success" })
    setExpertise([])
    setCredentialsUrl("")
    setStatement("")
    onClose()
  }

  const field =
    "mt-2 w-full px-3.5 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-sm outline-none focus:border-[var(--fg)] placeholder:text-[var(--fg-subtle)] transition-colors"

  return (
    <StudioDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      className="max-w-xl"
      title="Apply for the Peer Review Panel"
      description="Ten Elite reviewers vote on every Elite paper; seven PASS votes publish it. Tell us what you can judge, and how rigorously."
    >
      <form
        className="mt-6 space-y-6"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <fieldset>
          <legend className="text-sm font-medium">Primary domain expertise</legend>
          <p className="mt-0.5 text-xs text-[var(--fg-muted)]">Pick every domain you could review a paper in.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {EXPERTISE.map((t) => {
              const on = expertise.includes(t.slug)
              return (
                <button
                  key={t.slug}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(t.slug)}
                  style={hueStyle(t.slug)}
                  className={cn(
                    "inline-flex items-center gap-1.5 h-9 pl-2.5 pr-3.5 rounded-full border text-sm transition-colors",
                    on ? "hue-wash hue-ink border-transparent font-medium" : "border-[var(--border)] text-[var(--fg-secondary)] hover:border-[var(--border-strong)]"
                  )}
                >
                  <span aria-hidden className={cn("grid place-items-center w-4 h-4 rounded-full", on ? "hue-dot text-white" : "border border-[var(--border-strong)]")}>
                    {on && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                  </span>
                  {t.name}
                </button>
              )
            })}
          </div>
        </fieldset>

        <label className="block">
          <span className="text-sm font-medium">Credentials, portfolio, Google Scholar or GitHub</span>
          <input
            type="url"
            inputMode="url"
            value={credentialsUrl}
            onChange={(e) => {
              setCredentialsUrl(e.target.value)
              setError("")
            }}
            placeholder="https://scholar.google.com/citations?user=…"
            className={cn(field, "h-11")}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Statement of editorial rigor</span>
          <span className="mt-0.5 block text-xs text-[var(--fg-muted)]">
            Why should you evaluate Elite submissions? What do you check first, and what makes you vote FAIL?
          </span>
          <textarea
            value={statement}
            onChange={(e) => {
              setStatement(e.target.value)
              setError("")
            }}
            rows={5}
            maxLength={STATEMENT_MAX}
            className={cn(field, "py-3 leading-relaxed resize-y")}
          />
          <span className="mt-1 block text-xs text-[var(--fg-muted)] tabular-nums">
            {left > 0 ? `${left} more characters needed` : `${statement.trim().length} / ${STATEMENT_MAX}`}
          </span>
        </label>

        {error && (
          <p role="alert" className="text-sm text-[var(--error)]">
            {error}
          </p>
        )}

        <DialogActions>
          <Button type="button" variant="secondary" size="lg" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="lg" disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Submit application
          </Button>
        </DialogActions>
      </form>
    </StudioDialog>
  )
}

function PendingDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const currentUser = useUIStore((s) => s.currentUser)
  const applications = useUIStore((s) => s.panelApplications)
  const app = useMemo(
    () =>
      Object.values(applications)
        .filter((a) => a.username === currentUser)
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0],
    [applications, currentUser]
  )
  const names = (app?.expertise ?? []).map((s) => EXPERTISE.find((e) => e.slug === s)?.name ?? s)

  return (
    <StudioDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      className="max-w-lg"
      title="Your panel application"
      description="An admin reads every application. When they approve it, this button becomes “Access Review Panel” and your first papers are waiting."
    >
      {app ? (
        <dl className="mt-6 divide-y divide-[var(--border)] rounded-[14px] border border-[var(--border)] text-sm">
          <div className="flex justify-between gap-4 px-4 py-3">
            <dt className="text-[var(--fg-muted)]">Status</dt>
            <dd className="font-medium text-amber-800 theme-dark:text-amber-200">⏳ Pending admin review</dd>
          </div>
          <div className="flex justify-between gap-4 px-4 py-3">
            <dt className="text-[var(--fg-muted)]">Submitted</dt>
            <dd>{formatRelativeDate(app.submittedAt)}</dd>
          </div>
          <div className="flex justify-between gap-4 px-4 py-3">
            <dt className="text-[var(--fg-muted)]">Expertise</dt>
            <dd className="text-right">{names.join(", ")}</dd>
          </div>
          <div className="flex justify-between gap-4 px-4 py-3">
            <dt className="text-[var(--fg-muted)]">Credentials</dt>
            <dd className="min-w-0">
              <a href={/^https?:/i.test(app.credentialsUrl) ? safeHref(app.credentialsUrl) : undefined} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 underline underline-offset-2 truncate max-w-[16rem]">
                {app.credentialsUrl.replace(/^https?:\/\//, "")} <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            </dd>
          </div>
          <div className="px-4 py-3">
            <dt className="text-[var(--fg-muted)]">Statement</dt>
            <dd className="mt-1.5 text-[var(--fg-secondary)] leading-relaxed whitespace-pre-line">{app.statement}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-6 text-sm text-[var(--fg-muted)]">No application on file.</p>
      )}


      <DialogActions>
        <Button variant="secondary" size="lg" onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </StudioDialog>
  )
}
