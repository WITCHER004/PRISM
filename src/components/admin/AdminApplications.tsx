"use client"

import { useMemo, useState } from "react"
import { Check, ExternalLink, Inbox, X } from "lucide-react"
import { StudioDialog, DialogActions } from "@/components/studio/StudioDialog"
import { EliteNameBadge } from "@/components/elite/EliteBadges"
import { useAccess, useAdminActions } from "@/components/providers/useAccess"
import { Avatar } from "@/components/ui/Avatar"
import { Button } from "@/components/ui/Button"
import { EXPERTISE, type PanelApplication } from "@/lib/access"
import { findAccount } from "@/lib/data"
import { hueStyle } from "@/lib/topics"
import { useUIStore, toast } from "@/lib/store"
import { cn, formatRelativeDate } from "@/lib/utils"
import { AdminHeader } from "./AdminShell"
import { StatusChip } from "./AdminOverview"
import { safeHref } from "@/lib/sanitize"

type Filter = PanelApplication["status"]

export function AdminApplications() {
  const applications = useUIStore((s) => s.panelApplications)
  const [filter, setFilter] = useState<Filter>("pending")
  const list = useMemo(
    () =>
      Object.values(applications)
        .filter((a) => a.status === filter)
        .sort((a, b) => (filter === "pending" ? a.submittedAt.localeCompare(b.submittedAt) : (b.decidedAt ?? "").localeCompare(a.decidedAt ?? ""))),
    [applications, filter]
  )
  const count = (f: Filter) => Object.values(applications).filter((a) => a.status === f).length

  return (
    <>
      <AdminHeader eyebrow="Peer Review Panel" title="Panel applications" />
      <div className="px-5 sm:px-8 py-6">
        <div role="tablist" aria-label="Application status" className="inline-flex p-1 rounded-full bg-[var(--surface)] border border-[var(--border)]">
          {(["pending", "approved", "rejected"] as const).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "h-8 px-4 rounded-full text-sm capitalize transition-colors",
                filter === f ? "bg-[var(--panel)] text-[var(--fg)] font-medium shadow-xs" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
              )}
            >
              {f} <span className="ml-1 tabular-nums text-[var(--fg-muted)]">{count(f)}</span>
            </button>
          ))}
        </div>

        {list.length === 0 ? (
          <div className="mt-6 panel px-6 py-16 text-center">
            <Inbox className="mx-auto w-6 h-6 text-[var(--fg-subtle)]" />
            <p className="mt-3 font-semibold">{filter === "pending" ? "No applications waiting" : `No ${filter} applications`}</p>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">Elite members apply from the Elite page, their Profile Hub or their account menu.</p>
          </div>
        ) : (
          <ul className="mt-6 space-y-4">
            {list.map((a) => (
              <li key={a.id}>
                <ApplicationCard app={a} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

function ApplicationCard({ app }: { app: PanelApplication }) {
  const { decideApplication } = useAdminActions()
  const applicant = useAccess(app.username)
  const account = findAccount(app.username)
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState("")

  const decide = (decision: "approved" | "rejected", n?: string) => {
    const res = decideApplication(app.id, decision, n)
    if (!res.ok) return toast(res.error, { tone: "error" })
    toast(
      decision === "approved" ? `${app.displayName} is now a panel member. Their button reads “Access Review Panel”.` : `${app.displayName}'s application was rejected`,
      { tone: "success" }
    )
    setRejecting(false)
  }

  return (
    <article className="panel p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <Avatar src={account?.avatarUrl} alt={app.displayName} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-semibold">{app.displayName}</h2>
            {applicant.isElite && <EliteNameBadge />}
            <StatusChip status={app.status} />
          </div>
          <p className="text-sm text-[var(--fg-muted)]">
            @{app.username}
            {app.email && (
              <>
                {" · "}
                <a href={`mailto:${app.email}`} className="break-all hover:text-[var(--fg)] hover:underline underline-offset-2">{app.email}</a>
              </>
            )}
            {" · "}applied {formatRelativeDate(app.submittedAt)}
          </p>

          <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Expertise">
            {app.expertise.map((s) => (
              <span key={s} style={hueStyle(s)} className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full hue-wash hue-ink text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full hue-dot" />
                {EXPERTISE.find((e) => e.slug === s)?.name ?? s}
              </span>
            ))}
          </div>

          <a
            href={/^https?:/i.test(app.credentialsUrl) ? safeHref(app.credentialsUrl) : undefined}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="mt-4 inline-flex items-center gap-1.5 text-sm underline underline-offset-2 break-all"
          >
            {app.credentialsUrl.replace(/^https?:\/\//, "")} <ExternalLink className="w-3.5 h-3.5 shrink-0" />
          </a>

          <blockquote className="mt-4 pl-4 border-l-2 border-[var(--border-strong)] text-sm text-[var(--fg-secondary)] leading-relaxed whitespace-pre-line">
            {app.statement}
          </blockquote>

          {app.status !== "pending" && (
            <p className="mt-4 text-xs text-[var(--fg-muted)]">
              {app.status === "approved" ? "Approved" : "Rejected"} by {findAccount(app.decidedBy)?.displayName ?? app.decidedBy}
              {app.decidedAt ? ` · ${formatRelativeDate(app.decidedAt)}` : ""}
              {app.decisionNote ? ` · “${app.decisionNote}”` : ""}
            </p>
          )}
          {app.status === "pending" && !applicant.isElite && (
            <p className="mt-4 text-xs text-[var(--error)]">This applicant is no longer Elite; approving makes them a panel member anyway.</p>
          )}
        </div>

        {app.status === "pending" && (
          <div className="flex sm:flex-col gap-2 shrink-0">
            <Button size="md" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => decide("approved")}>
              <Check className="w-4 h-4" /> Approve as Panel Member
            </Button>
            <Button
              size="md"
              variant="outline"
              onClick={() => {
                setNote("")
                setRejecting(true)
              }}
            >
              <X className="w-4 h-4" /> Reject
            </Button>
          </div>
        )}
      </div>

      <StudioDialog
        open={rejecting}
        onOpenChange={setRejecting}
        title={`Reject ${app.displayName}?`}
        description="They see that the application wasn't approved, and can apply again later."
      >
        <label className="mt-5 block">
          <span className="text-sm font-medium">Note for the record (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={500}
            className="mt-2 w-full p-3 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-sm outline-none focus:border-[var(--fg)]"
          />
        </label>
        <DialogActions>
          <Button variant="secondary" size="lg" onClick={() => setRejecting(false)}>
            Cancel
          </Button>
          <Button size="lg" onClick={() => decide("rejected", note)}>
            Reject application
          </Button>
        </DialogActions>
      </StudioDialog>
    </article>
  )
}
