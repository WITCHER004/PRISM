"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"
import { motion } from "motion/react"
import { BarChart3, LayoutGrid, Mail, PenLine, Wallet } from "lucide-react"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { SignInGate } from "@/components/studio/SignInGate"
import { useHydrated } from "@/components/studio/useHydrated"
import { EliteGate } from "@/components/elite/EliteGate"
import { useSubscription } from "@/components/elite/hooks"
import { useUIStore } from "@/lib/store"
import { dur, ease, spring } from "@/lib/motion"
import { cn } from "@/lib/utils"

// Free writers only get Overview; the other tabs are Elite features.
// `gate` is the upgrade prompt shown if a Free user opens the page by URL
// (Earnings carries its own EliteGate, so it has none here).
const TABS: { href: string; label: string; icon: typeof LayoutGrid; elite?: boolean; gate?: { feature: string; description: string } }[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid },
  {
    href: "/dashboard/analytics",
    label: "Analytics",
    icon: BarChart3,
    elite: true,
    gate: { feature: "See how readers find your work", description: "Elite writers get daily reads, top stories and traffic sources for everything they publish." },
  },
  { href: "/dashboard/earnings", label: "Earnings", icon: Wallet, elite: true },
  {
    href: "/dashboard/newsletter",
    label: "Newsletter",
    icon: Mail,
    elite: true,
    gate: { feature: "Send a newsletter to your readers", description: "Elite writers can collect subscribers and email new issues straight from the Studio." },
  },
]

// Shared shell for the four Studio pages. Lives in the dashboard layout, so it stays mounted
// between them and the active pill glides from tab to tab.
export function StudioFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/dashboard"
  const hydrated = useHydrated()
  const currentUser = useUIStore((s) => s.currentUser)
  const signedOut = hydrated && !currentUser
  const { isElite } = useSubscription()
  const tabs = TABS.filter((t) => !t.elite || isElite)
  const gate = TABS.find((t) => t.href !== "/dashboard" && pathname.startsWith(t.href))?.gate
  const firstMount = useRef(true)
  useEffect(() => {
    firstMount.current = false
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <SiteHeader />
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-20">
          <div className="flex items-center justify-between gap-3">
            <nav aria-label="Studio" className="min-w-0 overflow-x-auto scrollbar-none -mx-1 px-1">
              <ul className="flex items-center gap-1 p-1 rounded-full bg-[var(--panel)] border border-[var(--border)] w-max">
                {tabs.map((tab) => {
                  const active = tab.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(tab.href)
                  const Icon = tab.icon
                  return (
                    <li key={tab.href}>
                      <Link
                        href={tab.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "relative flex items-center gap-2 h-10 px-4 rounded-full text-sm font-medium transition-colors",
                          active ? "text-[var(--bg)]" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
                        )}
                      >
                        {active && (
                          <motion.span
                            layoutId="studio-tab"
                            className="absolute inset-0 rounded-full bg-[var(--fg)]"
                            transition={spring.snappy}
                          />
                        )}
                        <Icon className="relative w-4 h-4" aria-hidden />
                        <span className="relative">{tab.label}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>
            <Link
              href="/editor/new"
              className="hidden sm:inline-flex shrink-0 items-center gap-2 h-11 px-5 rounded-full text-sm font-medium bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)] transition-colors"
            >
              <PenLine className="w-4 h-4" />
              Write a story
            </Link>
          </div>

          {signedOut ? (
            <SignInGate redirectTo={pathname} className="mt-10" />
          ) : (
            // Switching Studio tabs fades the new page in (the first load renders visible)
            <motion.div
              key={pathname}
              initial={firstMount.current ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: dur.base, ease: ease.out }}
              className="mt-8 sm:mt-10"
            >
              {gate ? (
                <EliteGate feature={gate.feature} description={gate.description}>
                  {children}
                </EliteGate>
              ) : (
                children
              )}
            </motion.div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
