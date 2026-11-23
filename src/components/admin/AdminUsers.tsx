"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import { EliteNameBadge } from "@/components/elite/EliteBadges"
import { useAdminActions } from "@/components/providers/useAccess"
import { Avatar } from "@/components/ui/Avatar"
import { managedRoleOf, type ManagedRole } from "@/lib/access"
import { toast } from "@/lib/store"
import { cn, formatDate } from "@/lib/utils"
import { AdminHeader } from "./AdminShell"
import { useDirectory, type DirectoryRow } from "./useDirectory"

const ROLES: { value: ManagedRole; label: string }[] = [
  { value: "free", label: "Free" },
  { value: "elite", label: "Elite" },
  { value: "panel", label: "Panel Member" },
  { value: "suspended", label: "Suspended" },
]

type Filter = "all" | ManagedRole | "admin"

export function AdminUsers() {
  const directory = useDirectory()
  const [q, setQ] = useState("")
  const [filter, setFilter] = useState<Filter>("all")

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return directory
      .filter((r) => (filter === "all" ? true : filter === "admin" ? r.access.isAdmin : managedRoleOf(r.access) === filter))
      .filter((r) => !needle || r.username.toLowerCase().includes(needle) || r.displayName.toLowerCase().includes(needle))
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
  }, [directory, q, filter])

  const count = (f: Filter) =>
    f === "all" ? directory.length : f === "admin" ? directory.filter((r) => r.access.isAdmin).length : directory.filter((r) => managedRoleOf(r.access) === f).length

  return (
    <>
      <AdminHeader eyebrow="Accounts" title="Users & tiers">
        <label className="relative block w-full sm:w-72">
          <span className="sr-only">Search users</span>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--fg-subtle)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or @username"
            className="w-full h-10 pl-9 pr-3 rounded-full bg-[var(--panel)] border border-[var(--border)] text-sm outline-none focus:border-[var(--fg)]"
          />
        </label>
      </AdminHeader>

      <div className="px-5 sm:px-8 py-6">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by role">
          {(["all", "free", "elite", "panel", "suspended", "admin"] as const).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "h-8 px-3.5 rounded-full border text-sm transition-colors",
                filter === f ? "border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)]" : "border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)]"
              )}
            >
              {f === "all" ? "All" : f === "panel" ? "Panel" : f === "admin" ? "Admins" : f[0].toUpperCase() + f.slice(1)}{" "}
              <span className="tabular-nums opacity-70">{count(f)}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 panel overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[var(--fg-muted)]">
                <th className="px-5 py-3 font-medium">User</th>
                <th className="px-5 py-3 font-medium">Tier</th>
                <th className="px-5 py-3 font-medium">Panel</th>
                <th className="px-5 py-3 font-medium">Access</th>
                <th className="px-5 py-3 font-medium w-48">Set role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((r) => (
                <UserRow key={r.username} row={r} />
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="px-5 py-10 text-center text-sm text-[var(--fg-muted)]">No users match.</p>}
        </div>
        <p className="mt-3 text-xs text-[var(--fg-muted)]">
          Admin access isn&apos;t set here: it belongs to the accounts listed in <code className="font-mono">ADMIN_EMAILS</code> (src/lib/admin.ts and the security rules).
        </p>
      </div>
    </>
  )
}

function UserRow({ row }: { row: DirectoryRow }) {
  const { actor, setRole } = useAdminActions()
  const a = row.access
  const current = managedRoleOf(a)
  const self = row.username === actor

  return (
    <tr className={cn(a.suspended && "bg-rose-50/40 theme-dark:bg-rose-500/[0.06]")}>
      <td className="px-5 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar src={row.avatarUrl} alt={row.displayName} size="sm" />
          <div className="min-w-0">
            <p className="font-medium truncate">{row.displayName}</p>
            <p className="text-xs text-[var(--fg-muted)] truncate">
              @{row.username}
              {row.email && (
                <>
                  {" · "}
                  <a href={`mailto:${row.email}`} className="hover:text-[var(--fg)] hover:underline underline-offset-2">{row.email}</a>
                </>
              )}
            </p>
          </div>
        </div>
      </td>
      <td className="px-5 py-3">
        {a.isElite ? (
          <span className="inline-flex flex-col gap-0.5">
            <EliteNameBadge />
            {row.eliteSince && <span className="text-[11px] text-[var(--fg-muted)]">since {formatDate(row.eliteSince)}</span>}
          </span>
        ) : (
          <span className="text-[var(--fg-muted)]">Free</span>
        )}
      </td>
      <td className="px-5 py-3 text-[var(--fg-secondary)]">
        {a.isPanelMember ? "Member" : a.panelApplicationStatus === "none" ? "–" : a.panelApplicationStatus[0].toUpperCase() + a.panelApplicationStatus.slice(1)}
      </td>
      <td className="px-5 py-3">
        {a.suspended ? (
          <span className="text-rose-700 theme-dark:text-rose-300 font-medium">Suspended</span>
        ) : a.isAdmin ? (
          <span className="font-medium">Admin</span>
        ) : (
          <span className="text-[var(--fg-subtle)]">–</span>
        )}
      </td>
      <td className="px-5 py-3">
        <label className="sr-only" htmlFor={`role-${row.username}`}>
          Role for {row.displayName}
        </label>
        <select
          id={`role-${row.username}`}
          value={current}
          disabled={self}
          title={self ? "You can't change your own role here" : undefined}
          onChange={(e) => {
            const next = e.target.value as ManagedRole
            const res = setRole(row.username, next)
            if (!res.ok) return toast(res.error, { tone: "error" })
            toast(`${row.displayName} is now ${ROLES.find((r) => r.value === next)!.label}`, { tone: "success" })
          }}
          className="w-full h-9 px-2.5 rounded-[10px] border border-[var(--border)] bg-[var(--panel)] text-sm disabled:opacity-50"
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </td>
    </tr>
  )
}
