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
import { useUIStore } from "@/lib/store"
import { dur, ease, spring } from "@/lib/motion"
import { cn } from "@/lib/utils"

const TABS = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/earnings", label: "Earnings", icon: Wallet },
  { href: "/dashboard/newsletter", label: "Newsletter", icon: Mail },
] as const

// Shared shell for the four Studio pages. Lives in the dashboard layout, so it stays mounted
// between them and the active pill glides from tab to tab.
export function StudioFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/dashboard"
  const hydrated = useHydrated()
  const currentUser = useUIStore((s) => s.currentUser)
  const signedOut = hydrated && !currentUser
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
                {TABS.map((tab) => {
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
              {children}
            </motion.div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
