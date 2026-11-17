"use client"

import { useMemo } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Avatar } from "@/components/ui/Avatar"
import { EXPERTISE } from "@/lib/access"
import { useUIStore } from "@/lib/store"
import { formatRelativeDate } from "@/lib/utils"
import { AdminHeader } from "./AdminShell"
import { useDirectory } from "./useDirectory"

export function AdminOverview() {
  const directory = useDirectory()
  const drafts = useUIStore((s) => s.drafts)
  const applications = useUIStore((s) => s.panelApplications)

  const stats = useMemo(() => {
    const all = Object.values(drafts)
    const apps = Object.values(applications)
    return {
      users: directory.length,
      free: directory.filter((r) => !r.access.isElite && !r.access.suspended).length,
      elite: directory.filter((r) => r.access.isElite).length,
      panel: directory.filter((r) => r.access.isPanelMember).length,
      suspended: directory.filter((r) => r.access.suspended).length,
      pendingApps: apps.filter((a) => a.status === "pending").length,
      verification: all.filter((d) => d.status === "PENDING_EMPLOYEE_REVIEW").length,
      onPanel: all.filter((d) => d.status === "PENDING_PEER_PANEL").length,
      appeals: all.filter((d) => d.status === "COUNTER_SUBMITTED").length,
      published: all.filter((d) => d.live).length,
    }
  }, [directory, drafts, applications])

  const recent = useMemo(
    () => Object.values(applications).sort((a, b) => (b.decidedAt ?? b.submittedAt).localeCompare(a.decidedAt ?? a.submittedAt)).slice(0, 5),
    [applications]
  )

  const mix = [
    { label: "Free", n: stats.free, cls: "bg-[var(--fg-subtle)]" },
    { label: "Elite", n: stats.elite - stats.panel, cls: "bg-[var(--gold)]" },
    { label: "Panel", n: stats.panel, cls: "bg-[var(--fg)]" },
    { label: "Suspended", n: stats.suspended, cls: "bg-rose-500" },
  ].filter((m) => m.n > 0)
  const mixTotal = mix.reduce((s, m) => s + m.n, 0) || 1

  return (
    <>
      <AdminHeader eyebrow="Admin" title="Overview" />
      <div className="px-5 sm:px-8 py-8 space-y-8">
        <section aria-label="Work waiting" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Panel applications" value={stats.pendingApps} href="/admin/applications" hint="waiting for a decision" />
          <Kpi label="Article verification" value={stats.verification} href="/admin/verification" hint="passed the AI check" />
          <Kpi label="With the peer panel" value={stats.onPanel} href="/admin/verification?tab=panel" hint="votes in progress" />
          <Kpi label="Open appeals" value={stats.appeals} href="/admin/verification?tab=counters" hint="counter-reasons" />
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="panel p-5 sm:p-6" aria-labelledby="mix-title">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="mix-title" className="font-display text-lg font-semibold">
                Accounts by tier
              </h2>
              <span className="meta tabular-nums">{stats.users} accounts</span>
            </div>
            <div className="mt-5 flex h-3 rounded-full overflow-hidden bg-[var(--surface)]" role="img" aria-label={mix.map((m) => `${m.label} ${m.n}`).join(", ")}>
              {mix.map((m) => (
                <span key={m.label} className={m.cls} style={{ width: `${(m.n / mixTotal) * 100}%` }} />
              ))}
            </div>
            <dl className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                ["Free", stats.free],
                ["Elite", stats.elite],
                ["Panel members", stats.panel],
                ["Published stories", stats.published],
              ].map(([label, n]) => (
                <div key={label} className="flex flex-col-reverse">
                  <dt className="meta mt-1">{label}</dt>
                  <dd className="font-display text-2xl font-semibold tabular-nums">{n}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="panel p-5 sm:p-6" aria-labelledby="recent-title">
            <div className="flex items-center justify-between">
              <h2 id="recent-title" className="font-display text-lg font-semibold">
                Recent applications
              </h2>
              <Link href="/admin/applications" className="text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
                All
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--fg-muted)]">No applications yet.</p>
            ) : (
              <ul className="mt-4 divide-y divide-[var(--border)]">
                {recent.map((a) => (
                  <li key={a.id} className="py-3 flex items-center gap-3">
                    <Avatar src={directory.find((r) => r.username === a.username)?.avatarUrl} alt={a.displayName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{a.displayName}</p>
                      <p className="text-xs text-[var(--fg-muted)] truncate">
                        {a.expertise.map((s) => EXPERTISE.find((e) => e.slug === s)?.name ?? s).join(", ")} ·{" "}
                        {formatRelativeDate(a.decidedAt ?? a.submittedAt)}
                      </p>
                    </div>
                    <StatusChip status={a.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  )
}

function Kpi({ label, value, hint, href }: { label: string; value: number; hint: string; href: string }) {
  return (
    <Link href={href} className="group panel p-5 hover:border-[var(--border-strong)] transition-colors">
      <p className="meta">{label}</p>
      <p className="mt-2 font-display text-[2.25rem] leading-none font-semibold tabular-nums">{value}</p>
      <p className="mt-2 flex items-center justify-between text-xs text-[var(--fg-muted)]">
        {hint} <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
      </p>
    </Link>
  )
}

export function StatusChip({ status }: { status: "pending" | "approved" | "rejected" }) {
  const map = {
    pending: "border-amber-300/70 bg-amber-50 text-amber-900 theme-dark:bg-amber-400/10 theme-dark:text-amber-200",
    approved: "border-emerald-200 bg-emerald-50 text-emerald-800 theme-dark:bg-emerald-400/10 theme-dark:text-emerald-200",
    rejected: "border-rose-200 bg-rose-50 text-rose-800 theme-dark:bg-rose-400/10 theme-dark:text-rose-200",
  }
  return (
    <span className={`shrink-0 inline-flex items-center h-6 px-2.5 rounded-full border text-xs font-medium capitalize ${map[status]}`}>{status}</span>
  )
}
