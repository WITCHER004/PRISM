"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react"
import { dur, ease } from "@/lib/motion"
import { useUIStore, toast } from "@/lib/store"
import { useAuth } from "@/components/providers/AuthProvider"
import { NotificationsMenu } from "@/components/layout/NotificationsMenu"
import { Avatar } from "@/components/ui/Avatar"
import { Wordmark } from "@/components/ui/Wordmark"
import { useViewer } from "@/components/providers/useViewer"
import { canOpenReviewDashboard } from "@/lib/moderation/workflow"
import {
  Search,
  Feather,
  Sun,
  Moon,
  BookOpen,
  Menu,
  X,
  Bookmark,
  User,
  Settings,
  LogOut,
  FileText,
  Compass,
  MessageSquareReply,
  Wallet,
  Sparkles,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"

const THEMES = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "sepia", icon: BookOpen, label: "Reading" },
  { value: "dark", icon: Moon, label: "Dark" },
] as const

const iconButton =
  "grid place-items-center w-8 h-8 rounded-full text-[var(--nav-link)] hover:text-[var(--fg)] hover:bg-[var(--nav-control-hover)] transition-colors"

const menuItem =
  "flex items-center gap-2.5 h-9 px-2.5 rounded-[10px] text-[13.5px] text-[var(--fg-secondary)] hover:bg-[var(--surface)] hover:text-[var(--fg)] transition-colors"

export function SiteHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useUIStore()
  const { logout } = useAuth()
  const { viewer: user, loading, isElite } = useViewer()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [query, setQuery] = useState("")
  const searchRef = useRef<HTMLInputElement>(null)
  const isReviewer = canOpenReviewDashboard(user?.role)
  const isEditor = pathname?.startsWith("/editor")

  const navLinks = [
    { href: "/", label: "Feed", active: pathname === "/" },
    { href: "/explore", label: "Explore", icon: Compass, active: !!pathname?.startsWith("/explore") },
    isReviewer
      ? { href: "/review-dashboard", label: "Review Queue", active: !!pathname?.startsWith("/review-dashboard") }
      : { href: "/elite", label: "Elite", gold: true, active: !!pathname?.startsWith("/elite") },
  ]

  // ⌘K / Ctrl+K: focus the bar when it's on screen, otherwise open the search page
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        const input = searchRef.current
        if (input && input.offsetParent !== null) input.focus()
        else router.push("/search")
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

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search")
    searchRef.current?.blur()
  }

  const onSignOut = async () => {
    setUserMenuOpen(false)
    try {
      await logout()
      toast("Signed out")
    } catch (err) {
      console.warn("[auth] Sign-out failed:", err)
      toast("Couldn't sign out. Try again.", { tone: "error" })
    }
    router.push("/")
  }

  if (isEditor) return null

  return (
    <motion.header
      className="site-header sticky top-0 z-50 h-16 w-full bg-[var(--nav-bg)] backdrop-blur-md border-b border-[var(--nav-border)]"
      animate={{ y: hidden ? "-110%" : "0%" }}
      transition={{ duration: hidden ? dur.fast * 1.5 : dur.base, ease: hidden ? ease.in : ease.out }}
    >
      <div className="max-w-[1380px] mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-6">
        {/* ── Left: mark + sections ─────────────────────────────────────── */}
        <div className="flex items-center gap-3 min-w-0">
          <Wordmark />
          <span aria-hidden className="hidden md:block h-4 w-px bg-[var(--nav-divider)] mx-1" />
          <nav aria-label="Primary" className="hidden md:flex items-center gap-0.5">
            {navLinks.map(({ href, label, icon: Icon, gold, active }) => (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                  active
                    ? "text-[var(--fg)]"
                    : "text-[var(--nav-link)] hover:text-[var(--fg)] hover:bg-[var(--nav-control)]"
                )}
              >
                {Icon && <Icon className="w-[15px] h-[15px]" strokeWidth={1.75} />}
                {label}
                {gold && <span aria-hidden className="w-1 h-1 rounded-full bg-[var(--gold)]" />}
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    aria-hidden
                    className="absolute left-1/2 -bottom-[5px] -ml-[2px] w-1 h-1 rounded-full bg-[var(--fg)]"
                    transition={{ type: "spring", stiffness: 520, damping: 38 }}
                  />
                )}
              </Link>
            ))}
          </nav>
        </div>

        {/* ── Center: search ────────────────────────────────────────────── */}
        <form
          role="search"
          onSubmit={submitSearch}
          className="hidden lg:flex flex-1 min-w-0 max-w-[380px] h-9 px-3.5 items-center justify-between gap-2.5 rounded-full bg-[var(--nav-control)] hover:bg-[var(--nav-control-hover)] focus-within:bg-[var(--nav-control-focus)] focus-within:ring-2 focus-within:ring-[var(--nav-ring)] border border-[var(--nav-control-border)] transition-all"
        >
          <Search aria-hidden className="w-3.5 h-3.5 shrink-0 text-[var(--nav-placeholder)]" strokeWidth={2} />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search essays, authors, topics…"
            aria-label="Search essays, authors, topics"
            className="w-full min-w-0 bg-transparent outline-none focus-visible:outline-none text-[13.5px] text-[var(--fg-secondary)] placeholder:text-[var(--nav-placeholder)] [&::-webkit-search-cancel-button]:hidden"
          />
          <kbd className="shrink-0 px-1.5 py-0.5 text-[10px] font-mono font-medium leading-none text-[var(--nav-placeholder)] bg-[var(--nav-kbd)] rounded border border-[var(--nav-kbd-border)] shadow-[0_1px_0_rgba(0,0,0,0.04)]">
            ⌘K
          </kbd>
        </form>

        {/* ── Right: actions ────────────────────────────────────────────── */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Link href="/search" className={cn(iconButton, "lg:hidden")} aria-label="Search">
            <Search className="w-[15px] h-[15px]" strokeWidth={1.75} />
          </Link>

          <div
            role="radiogroup"
            aria-label="Theme"
            className="hidden md:flex items-center h-8 p-0.5 rounded-full bg-[var(--nav-control)] border border-[var(--nav-control-border)]"
          >
            {THEMES.map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                role="radio"
                aria-checked={theme === value}
                aria-label={`${label} theme`}
                title={label}
                onClick={(e) => switchTheme(value, e)}
                className={cn(
                  "relative w-7 h-7 rounded-full flex items-center justify-center transition-colors",
                  theme === value ? "text-[var(--fg)]" : "text-[var(--nav-placeholder)] hover:text-[var(--fg)]"
                )}
              >
                {theme === value && (
                  <motion.span
                    layoutId="theme-pill"
                    className="absolute inset-0 rounded-full bg-[var(--nav-control-focus)] shadow-xs"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <Icon className="relative w-[13px] h-[13px]" strokeWidth={2} />
              </button>
            ))}
          </div>

          {user ? (
            <>
              <NotificationsMenu buttonClassName={iconButton} />

              <Link
                href="/editor/new"
                className="hidden sm:flex h-9 px-4 items-center gap-1.5 rounded-full bg-[var(--nav-cta)] hover:bg-[var(--nav-cta-hover)] text-[var(--nav-cta-fg)] text-[13.5px] font-medium tracking-tight shadow-xs hover:shadow transition-all"
              >
                <Feather className="w-3.5 h-3.5" strokeWidth={1.75} />
                Write
              </Link>

              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                  aria-label={`Account menu for ${user.displayName}`}
                  className="h-9 pl-1.5 pr-2 xl:pr-3 rounded-full bg-[var(--nav-pill)] hover:bg-[var(--nav-pill-hover)] border border-[var(--nav-pill-border)] hover:border-[var(--nav-pill-border-hover)] shadow-2xs flex items-center gap-2 transition-all"
                >
                  <Avatar
                    src={user.avatarUrl}
                    alt={user.displayName}
                    size="xs"
                    className="bg-[var(--fg)] text-[var(--bg)] font-serif font-medium text-[10.5px] tracking-[0.02em]"
                  />
                  <span className="hidden xl:block text-[13px] font-medium text-[var(--fg-secondary)] truncate max-w-[110px]">
                    {user.displayName}
                  </span>
                  <ChevronDown
                    aria-hidden
                    className={cn(
                      "w-3 h-3 text-[var(--nav-placeholder)] transition-transform duration-200",
                      userMenuOpen && "rotate-180"
                    )}
                  />
                </button>

                <AnimatePresence>
                  {userMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                      <motion.div
                        role="menu"
                        initial={{ opacity: 0, y: -4, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: dur.fast * 1.4, ease: ease.out } }}
                        exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: dur.fast, ease: ease.in } }}
                        className="absolute right-0 top-full mt-2.5 w-56 p-1.5 origin-top-right rounded-2xl bg-[var(--panel)] border border-[var(--border)] shadow-xl z-50"
                      >
                        <div className="px-2.5 pt-2 pb-2.5 mb-1 border-b border-[var(--border)]">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[13.5px] font-semibold text-[var(--fg)] truncate">{user.displayName}</p>
                            <span
                              className={cn(
                                "shrink-0 inline-flex items-center gap-1 h-5 px-1.5 rounded-full text-[10.5px] font-medium tracking-wide border",
                                isElite
                                  ? "text-[var(--gold)] border-[var(--gold)]/35 bg-[var(--gold)]/10"
                                  : "text-[var(--fg-muted)] border-[var(--border)] bg-[var(--surface)]"
                              )}
                            >
                              {isElite && <span aria-hidden className="w-1 h-1 rounded-full bg-[var(--gold)]" />}
                              {isElite ? "Elite" : "Free"}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-[var(--fg-muted)] truncate">@{user.username}</p>
                          {user.email && <p className="text-xs text-[var(--fg-subtle)] truncate">{user.email}</p>}
                        </div>

                        {[
                          { href: "/profile", icon: User, label: "Profile Hub" },
                          { href: "/dashboard", icon: FileText, label: "My Articles" },
                          ...(isReviewer
                            ? [{ href: "/review-dashboard?tab=counters", icon: MessageSquareReply, label: "Writer Rebuttals" }]
                            : []),
                          { href: "/bookmarks", icon: Bookmark, label: "Library" },
                          isElite
                            ? { href: "/dashboard/earnings", icon: Wallet, label: "Earnings" }
                            : { href: "/elite", icon: Sparkles, label: "Upgrade to Elite" },
                          { href: "/settings", icon: Settings, label: "Settings" },
                        ].map(({ href, icon: Icon, label }) => (
                          <Link key={href} href={href} role="menuitem" onClick={() => setUserMenuOpen(false)} className={menuItem}>
                            <Icon className="w-[15px] h-[15px] text-[var(--fg-muted)]" strokeWidth={1.75} />
                            {label}
                          </Link>
                        ))}

                        <div className="my-1 h-px bg-[var(--border)]" />
                        <button
                          role="menuitem"
                          onClick={onSignOut}
                          className="w-full flex items-center gap-2.5 h-9 px-2.5 rounded-[10px] text-[13.5px] text-[var(--danger-ink)] hover:bg-[var(--danger-wash)] transition-colors"
                        >
                          <LogOut className="w-[15px] h-[15px]" strokeWidth={1.75} />
                          Sign out
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </>
          ) : loading ? (
            // Auth state not known yet: hold the space so the bar doesn't jump
            <div aria-hidden className="flex items-center gap-2.5">
              <span className="hidden sm:block h-9 w-[4.5rem] rounded-full bg-[var(--nav-control)] animate-pulse" />
              <span className="h-9 w-24 rounded-full bg-[var(--nav-control)] animate-pulse" />
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Link
                href="/auth/login"
                className="hidden sm:flex h-9 px-3.5 items-center rounded-full text-[13.5px] font-medium text-[var(--nav-link)] hover:text-[var(--fg)] hover:bg-[var(--nav-control)] transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/auth/signup"
                className="flex h-9 px-4 items-center rounded-full bg-[var(--nav-cta)] hover:bg-[var(--nav-cta-hover)] text-[var(--nav-cta-fg)] text-[13.5px] font-medium tracking-tight shadow-xs hover:shadow transition-all"
              >
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
            {mobileOpen ? <X className="w-[18px] h-[18px]" /> : <Menu className="w-[18px] h-[18px]" />}
          </button>
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
            className="md:hidden absolute inset-x-3 top-full mt-2 rounded-2xl bg-[var(--panel)] border border-[var(--border)] shadow-xl p-2"
            aria-label="Mobile"
          >
            {[...navLinks, { href: "/bookmarks", label: "Library", active: pathname === "/bookmarks" }].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                aria-current={link.active ? "page" : undefined}
                className={cn(
                  "flex items-center h-11 px-3 rounded-xl text-[15px]",
                  link.active ? "bg-[var(--surface)] font-medium text-[var(--fg)]" : "text-[var(--fg-secondary)]"
                )}
              >
                {link.label}
              </Link>
            ))}
            <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-[var(--border)]">
              <div role="radiogroup" aria-label="Theme" className="flex gap-1">
                {THEMES.map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    role="radio"
                    onClick={(e) => switchTheme(value, e)}
                    aria-label={`${label} theme`}
                    aria-checked={theme === value}
                    className={cn("grid place-items-center w-10 h-10 rounded-full text-[var(--nav-link)]", theme === value && "bg-[var(--surface)] text-[var(--fg)]")}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                ))}
              </div>
              {user && (
                <Link
                  href="/editor/new"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-[var(--nav-cta)] text-[var(--nav-cta-fg)] text-sm font-medium"
                >
                  <Feather className="w-3.5 h-3.5" strokeWidth={1.75} />
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
