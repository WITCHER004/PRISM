"use client"

import { useEffect, useMemo } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ArrowUpRight, ClipboardCheck, LayoutDashboard, LogOut, Scale, Users } from "lucide-react"
import { useAuth } from "@/components/providers/AuthProvider"
import { isAdminUser } from "@/lib/admin"
import { findAccount } from "@/lib/data"
import { useUIStore, toast } from "@/lib/store"
import { cn } from "@/lib/utils"

/**
 * The isolated admin portal. Nothing on the public site links here and it never renders the site
 * header. Only a signed-in Firebase user whose verified email is in ADMIN_EMAILS (src/lib/admin.ts)
 * gets in; everyone else is sent to /admin/login. Firestore rules enforce the same list.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const pathname = usePathname() ?? "/admin"
  const router = useRouter()
  const session = useUIStore((s) => s.adminSession)
  const onLogin = pathname === "/admin/login"
  const allowed = isAdminUser(user) && !!session

  useEffect(() => {
    if (!loading && !onLogin && !isAdminUser(user)) router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`)
  }, [loading, onLogin, user, pathname, router])

  if (onLogin) return <div className="min-h-screen bg-[#0B0B0D] text-[#EDEDEF]">{children}</div>
  if (loading || !allowed)
    return <div className="min-h-screen bg-[#0B0B0D]" aria-busy="true" aria-label="Checking admin access" />

  return (
    <div className="min-h-screen bg-[var(--bg)] lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <Sidebar session={session!} pathname={pathname} />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function Sidebar({ session, pathname }: { session: string; pathname: string }) {
  const drafts = useUIStore((s) => s.drafts)
  const applications = useUIStore((s) => s.panelApplications)
  const { logout } = useAuth()
  const router = useRouter()
  const me = findAccount(session)

  const counts = useMemo(
    () => ({
      applications: Object.values(applications).filter((a) => a.status === "pending").length,
      verification: Object.values(drafts).filter((d) => d.status === "PENDING_EMPLOYEE_REVIEW").length,
    }),
    [applications, drafts]
  )

  const items = [
    { href: "/admin", label: "Overview", icon: LayoutDashboard, count: 0 },
    { href: "/admin/applications", label: "Panel applications", icon: Scale, count: counts.applications },
    { href: "/admin/verification", label: "Article verification", icon: ClipboardCheck, count: counts.verification },
    { href: "/admin/users", label: "Users & tiers", icon: Users, count: 0 },
  ]

  return (
    <aside className="lg:sticky lg:top-0 lg:h-screen flex flex-col bg-[#0E0E10] text-[#EDEDEF] border-r border-white/[0.06]">
      <div className="px-5 h-16 flex items-center justify-between border-b border-white/[0.06]">
        <Link href="/admin" className="flex items-center gap-2.5">
          <svg viewBox="0 0 32 32" aria-hidden className="w-5 h-5">
            <path d="M16 3.5 L3.5 27.5 H19.5 Z" fill="currentColor" />
            <path d="M16 3.5 L28.5 27.5 H19.5 Z" fill="currentColor" fillOpacity="0.38" />
          </svg>
          <span className="font-display font-semibold tracking-[-0.03em] text-lg">prism</span>
          <span className="ml-1 h-5 px-1.5 rounded-[6px] bg-white/[0.08] text-[10px] font-mono uppercase tracking-[0.14em] grid place-items-center text-[#A1A1AA]">
            Admin
          </span>
        </Link>
      </div>

      <nav aria-label="Admin" className="p-3 flex lg:flex-col gap-1 overflow-x-auto">
        {items.map(({ href, label, icon: Icon, count }) => {
          const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 h-10 px-3 rounded-[10px] text-sm whitespace-nowrap transition-colors",
                active ? "bg-white/[0.08] text-white font-medium" : "text-[#A1A1AA] hover:text-white hover:bg-white/[0.04]"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
              <span className="flex-1">{label}</span>
              {count > 0 && (
                <span className="min-w-5 h-5 px-1.5 grid place-items-center rounded-full bg-[#E0A53A] text-[#141413] text-[11px] font-semibold tabular-nums">
                  {count}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto hidden lg:block p-4 border-t border-white/[0.06] space-y-3">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{me?.displayName ?? session}</p>
          <p className="text-xs text-[#71717A] truncate">@{session} · admin session</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/"
            target="_blank"
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-[10px] border border-white/10 text-xs text-[#D4D4D8] hover:border-white/25"
          >
            Open site <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
          <button
            type="button"
            onClick={async () => {
              await logout()
              toast("Signed out")
              router.replace("/admin/login")
            }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-[10px] border border-white/10 text-xs text-[#D4D4D8] hover:border-white/25"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </div>
    </aside>
  )
}

/** Page heading inside the portal */
export function AdminHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="px-5 sm:px-8 pt-8 pb-6 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div>
        <p className="meta">{eyebrow}</p>
        <h1 className="mt-2 font-display text-[1.75rem] sm:text-[2rem] font-semibold tracking-tight">{title}</h1>
      </div>
      {children}
    </header>
  )
}
