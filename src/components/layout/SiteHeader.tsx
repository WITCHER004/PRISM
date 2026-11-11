"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react"
import { dur, ease } from "@/lib/motion"
import { useUIStore, toast } from "@/lib/store"
import { NotificationsMenu } from "@/components/layout/NotificationsMenu"
import { Avatar } from "@/components/ui/Avatar"
import { Wordmark } from "@/components/ui/Wordmark"
import { findAccount } from "@/lib/data"
import { useSubscription } from "@/components/elite/hooks"
import { EliteTag } from "@/components/elite/EliteBadges"
import { canOpenReviewDashboard } from "@/lib/moderation/workflow"
import {
  Search,
  PenLine,
  Sun,
  Moon,
  BookOpen,
  Menu,
  X,
  Bookmark,
  User,
  Settings,
  LogOut,
  LayoutDashboard,
  Compass,
  ShieldCheck,
  Wallet,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"

const THEMES = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "sepia", icon: BookOpen, label: "Sepia" },
  { value: "dark", icon: Moon, label: "Dark" },
] as const

const iconButton =
  "grid place-items-center w-9 h-9 rounded-full text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)] transition-colors"

export function SiteHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme, currentUser, signOut, profile } = useUIStore()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const baseUser = findAccount(currentUser)
  const { isElite } = useSubscription()
  const user = baseUser && profile.avatarUrl ? { ...baseUser, avatarUrl: profile.avatarUrl } : baseUser
  const isReviewer = canOpenReviewDashboard(user?.role)
  const isEditor = pathname?.startsWith("/editor")

  // ⌘K / Ctrl+K jumps to search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        router.push("/search")
      }
      if (e.key === "Escape") {
        setUserMenuOpen(false)
        setMobileOpen(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [router])

  // Step out of the way while reading down the page; come back on any upward scroll
  const { scrollY } = useScroll()
  const [hidden, setHidden] = useState(false)
  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0
    setHidden(y > prev && y > 160 && !mobileOpen && !userMenuOpen)
  })

  // The new theme spreads out from the button that was pressed
  const switchTheme = (value: (typeof THEMES)[number]["value"], e: React.MouseEvent) => {
    const apply = () => {
      document.documentElement.setAttribute("data-theme", value)
      setTheme(value)
    }
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches
    if (!document.startViewTransition || reduce || value === theme) return apply()
    const root = document.documentElement
    root.style.setProperty("--vt-x", `${e.clientX}px`)
    root.style.setProperty("--vt-y", `${e.clientY}px`)
    document.startViewTransition(apply)
  }

  if (isEditor) return null

  return (
    <motion.header
      className="site-header sticky top-0 z-50 px-3 sm:px-5 pt-3 bg-[var(--bg)]/95 backdrop-blur-xl"
      animate={{ y: hidden ? "-110%" : "0%" }}
      transition={{ duration: hidden ? dur.fast * 1.5 : dur.base, ease: hidden ? ease.in : ease.out }}
    >
      <div
        className="max-w-7xl mx-auto"
      >
        <div className="flex items-center gap-3 h-14 pl-4 pr-2 sm:pl-5">
          <Wordmark />

          <Link
            href="/explore"
            className={cn(
              "hidden md:inline-flex items-center gap-1.5 ml-3 h-9 px-3 rounded-full text-sm transition-colors",
              pathname?.startsWith("/explore")
                ? "bg-[var(--surface)] text-[var(--fg)]"
                : "text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)]"
            )}
          >
            <Compass className="w-4 h-4" />
            Explore
          </Link>

          {/* Search trigger */}
          <Link
            href="/search"
            className="hidden sm:flex flex-1 max-w-sm mx-auto items-center gap-2 h-10 pl-3.5 pr-2 text-sm text-[var(--fg-subtle)] transition-colors hover:text-[var(--fg-muted)]"
          >
            <Search className="w-4 h-4" />
            <span className="flex-1">Search ideas, people, topics</span>
            <kbd className="meta normal-case tracking-normal px-1.5 py-0.5 rounded-md bg-[var(--panel)] border border-[var(--border)]">
              ⌘K
            </kbd>
          </Link>

          <div className="flex items-center gap-1 ml-auto sm:ml-0">
            <Link href="/search" className={cn(iconButton, "sm:hidden")} aria-label="Search">
              <Search className="w-[18px] h-[18px]" />
            </Link>

            {/* Theme switch */}
            <div role="radiogroup" aria-label="Theme" className="hidden md:flex items-center p-0.5 rounded-full bg-[var(--bg)] border border-[var(--border)]">
              {THEMES.map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  role="radio"
                  aria-checked={theme === value}
                  aria-label={`${label} theme`}
                  onClick={(e) => switchTheme(value, e)}
                  className="relative grid place-items-center w-8 h-8 rounded-full"
                >
                  {theme === value && (
                    <motion.span
                      layoutId="theme-pill"
                      className="absolute inset-0 rounded-full bg-[var(--panel)] shadow-[var(--shadow)]"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                  <Icon className={cn("relative w-3.5 h-3.5", theme === value ? "text-[var(--fg)]" : "text-[var(--fg-subtle)]")} />
                </button>
              ))}
            </div>

            {user ? (
              <>
                <NotificationsMenu buttonClassName={iconButton} />

                <Link
                  href="/editor/new"
                  className="hidden sm:inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-sm font-medium bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--fg-secondary)] transition-colors"
                >
                  <PenLine className="w-4 h-4" />
                  Write
                </Link>

                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    aria-haspopup="menu"
                    aria-expanded={userMenuOpen}
                    aria-label="Account menu"
                    className="grid place-items-center w-10 h-10 rounded-full hover:bg-[var(--surface)] transition-colors"
                  >
                    <Avatar src={user.avatarUrl} alt={user.displayName} size="sm" />
                  </button>

                  <AnimatePresence>
                    {userMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                        <motion.div
                          role="menu"
                          initial={{ opacity: 0, y: -6, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -6, scale: 0.97 }}
                          transition={{ duration: 0.16 }}
                          className="absolute right-0 top-full mt-3 w-64 origin-top-right panel shadow-[var(--shadow-lift)] z-50 p-2"
                        >
                          <div className="flex items-center gap-3 p-2.5 mb-1 rounded-[14px] bg-[var(--bg)]">
                            <Avatar src={user.avatarUrl} alt={user.displayName} size="md" />
                            <div className="min-w-0">
                              <p className="font-semibold text-sm truncate">{profile.displayName || user.displayName}</p>
                              <p className="meta normal-case tracking-normal flex items-center gap-1.5">
                                @{user.username} {isElite && <EliteTag />}
                              </p>
                            </div>
                          </div>
                          {[
                            { href: "/profile", icon: User, label: "Profile" },
                            { href: "/bookmarks", icon: Bookmark, label: "Library" },
                            { href: "/dashboard", icon: LayoutDashboard, label: "Studio" },
                            ...(isReviewer ? [{ href: "/review-dashboard", icon: ShieldCheck, label: "Review dashboard" }] : []),
                            isElite
                              ? { href: "/dashboard/earnings", icon: Wallet, label: "Earnings" }
                              : { href: "/elite", icon: Sparkles, label: "Upgrade to Elite" },
                            { href: "/settings", icon: Settings, label: "Settings" },
                          ].map(({ href, icon: Icon, label }) => (
                            <Link
                              key={href}
                              href={href}
                              role="menuitem"
                              onClick={() => setUserMenuOpen(false)}
                              className="flex items-center gap-3 px-2.5 py-2 rounded-[10px] text-sm text-[var(--fg-secondary)] hover:bg-[var(--surface)] hover:text-[var(--fg)] transition-colors"
                            >
                              <Icon className="w-4 h-4 text-[var(--fg-muted)]" />
                              {label}
                            </Link>
                          ))}
                          <div className="my-1 h-px bg-[var(--border)]" />
                          <button
                            role="menuitem"
                            onClick={() => {
                              setUserMenuOpen(false)
                              signOut()
                              toast("Signed out")
                              router.push("/")
                            }}
                            className="flex items-center gap-3 px-2.5 py-2 rounded-[10px] text-sm text-[var(--fg-muted)] hover:bg-[var(--surface)] hover:text-[var(--fg)] w-full transition-colors"
                          >
                            <LogOut className="w-4 h-4" />
                            Sign out
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-1">
                <Link href="/auth/login" className="hidden sm:inline-flex h-10 px-4 items-center rounded-full text-sm text-[var(--fg-secondary)] hover:bg-[var(--surface)]">
                  Sign in
                </Link>
                <Link href="/auth/signup" className="inline-flex h-10 px-4 items-center rounded-full text-sm font-medium bg-[var(--fg)] text-[var(--bg)]">
                  Join Prism
                </Link>
              </div>
            )}

            <button
              className={cn(iconButton, "md:hidden")}
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile sheet */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="md:hidden mt-2 panel shadow-[var(--shadow-lift)] p-3"
            aria-label="Mobile"
          >
            {[
              { href: "/", label: "Home" },
              { href: "/explore", label: "Explore" },
              { href: "/bookmarks", label: "Library" },
              { href: "/membership", label: "Membership" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "block px-3 py-2.5 rounded-[12px] text-base",
                  pathname === link.href ? "bg-[var(--surface)] font-medium" : "text-[var(--fg-secondary)]"
                )}
              >
                {link.label}
              </Link>
            ))}
            <div className="flex items-center justify-between gap-2 mt-2 pt-3 border-t border-[var(--border)]">
              <div className="flex gap-1">
                {THEMES.map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    onClick={(e) => switchTheme(value, e)}
                    aria-label={`${label} theme`}
                    aria-pressed={theme === value}
                    className={cn(iconButton, theme === value && "bg-[var(--surface)] text-[var(--fg)]")}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                ))}
              </div>
              {user && (
                <Link
                  href="/editor/new"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-full text-sm font-medium bg-[var(--fg)] text-[var(--bg)]"
                >
                  <PenLine className="w-4 h-4" />
                  Write
                </Link>
              )}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
