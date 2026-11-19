"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react"
import { dur, ease } from "@/lib/motion"
import { useUIStore, toast } from "@/lib/store"
import { useAuth } from "@/components/providers/AuthProvider"
import { NotificationsMenu } from "@/components/layout/NotificationsMenu"
import { Wordmark } from "@/components/ui/Wordmark"
import { useViewer } from "@/components/providers/useViewer"
import { useAccess, usePanelInbox } from "@/components/providers/useAccess"
import { EliteNameBadge } from "@/components/elite/EliteBadges"
import { openUpgrade } from "@/components/elite/UpgradeDialog"
import { CountBadge, PanelApplyButton } from "@/components/panel/PanelApplication"
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
  Wallet,
  Sparkles,
  ChevronDown,
  History,
  Highlighter,
} from "lucide-react"
import { cn } from "@/lib/utils"

const THEMES = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "sepia", icon: BookOpen, label: "Reading" },
  { value: "dark", icon: Moon, label: "Dark" },
] as const

const iconButton =
  "grid place-items-center w-8 h-8 rounded-full text-[var(--nav-link)] hover:text-[var(--fg)] hover:bg-[var(--nav-control-hover)] transition-colors"

// Primary CTA: solid obsidian in light/reading, paper in dark. Literal values + `!` so nothing can wash it out.
const ctaButton =
  "items-center gap-1.5 h-9 px-4 rounded-full border-0 text-[13.5px] font-medium tracking-tight bg-[#141413]! text-[#FAF8F5]! theme-dark:bg-[#FAF8F5]! theme-dark:text-[#141413]! shadow-[0_1px_2px_rgba(0,0,0,0.12)] hover:opacity-90 transition-opacity"

const menuItem =
  "flex items-center gap-2.5 h-9 px-2.5 rounded-[10px] text-[13.5px] text-[var(--fg-secondary)] hover:bg-[var(--surface)] hover:text-[var(--fg)] transition-colors"

export function SiteHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useUIStore()
  const { logout } = useAuth()
  const { viewer: user, loading, isElite: viewerElite } = useViewer()
  const access = useAccess()
  const isElite = viewerElite || access.isElite
  const inbox = usePanelInbox(access.isPanelMember ? access.username : null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [query, setQuery] = useState("")
  const searchRef = useRef<HTMLInputElement>(null)
  const isEditor = pathname?.startsWith("/editor")

  // Same sections for every member; staff tools live only in the separate /admin portal
  const navLinks: { href: string; label: string; active: boolean; gold?: boolean; count?: number }[] = [
    { href: "/", label: "Feed", active: pathname === "/" },
    { href: "/explore", label: "Explore", active: !!pathname?.startsWith("/explore") },
    { href: "/forum", label: "Discussions", active: !!pathname?.startsWith("/forum") },
    { href: "/elite", label: "Elite", gold: true, active: !!pathname?.startsWith("/elite") },
    ...(user && access.isPanelMember
      ? [{ href: "/panel", label: "Review Panel", active: !!pathname?.startsWith("/panel"), count: inbox.total }]
      : []),
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
      className="site-header sticky top-0 z-50 h-16 w-full bg-[var(--nav-bg)] backdrop-blur-md border-b border-[rgba(20,20,19,0.08)] theme-dark:border-white/[0.08]"
      animate={{ y: hidden ? "-110%" : "0%" }}
      transition={{ duration: hidden ? dur.fast * 1.5 : dur.base, ease: hidden ? ease.in : ease.out }}
    >
      <div className="max-w-[1380px] mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-6">
        {/* ── Left: mark + sections ─────────────────────────────────────── */}
        <div className="flex items-center gap-3 min-w-0">
          <Wordmark />
          <span aria-hidden className="hidden md:block h-4 w-px bg-[var(--nav-divider)] mx-1" />
          <nav aria-label="Primary" className="hidden md:flex items-center gap-1">
            {navLinks.map(({ href, label, gold, active, count }) => (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1 px-[14px] py-[6px] rounded-full text-sm leading-5 whitespace-nowrap transition-colors",
                  active
                    ? "bg-[rgba(20,20,19,0.06)] text-[#141413] font-semibold theme-dark:bg-white/[0.08] theme-dark:text-[#F1F0EC]"
                    : "text-[#686662] font-medium hover:bg-black/[0.04] hover:text-[#141413] theme-dark:text-[#A1A1AA] theme-dark:hover:bg-white/[0.06] theme-dark:hover:text-[#F1F0EC]"
                )}
              >
                {gold && <span aria-hidden className="text-[10px] text-[#C27C0E] theme-dark:text-[#E0A53A]">✦</span>}
                {label}
                {!!count && <CountBadge n={count} className="ml-0.5 h-[18px] min-w-[18px] text-[10.5px]" />}
              </Link>
            ))}
          </nav>
        </div>

        {/* ── Center: search ────────────────────────────────────────────── */}
        <form
          role="search"
          onSubmit={submitSearch}
          className="hidden lg:flex w-[340px] min-w-0 shrink h-[38px] px-[14px] items-center justify-between gap-2.5 rounded-full bg-[rgba(20,20,19,0.045)] border border-[rgba(20,20,19,0.08)] focus-within:bg-[#FFFFFF] focus-within:border-[rgba(20,20,19,0.22)] focus-within:shadow-[0_2px_8px_rgba(0,0,0,0.04)] theme-dark:bg-white/[0.05] theme-dark:border-white/[0.08] theme-dark:focus-within:bg-[#18181B] theme-dark:focus-within:border-white/[0.22] transition-all"
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
          <kbd className="shrink-0 px-[6px] py-[1px] text-[11px] font-mono font-medium text-[#78756F] bg-[rgba(255,255,255,0.85)] rounded-[6px] border border-[rgba(20,20,19,0.10)] theme-dark:bg-white/[0.06] theme-dark:border-white/10 theme-dark:text-[#8B8B94]">
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
            className="hidden md:flex items-center p-[2px] rounded-full bg-[rgba(20,20,19,0.05)] border border-[rgba(20,20,19,0.06)] theme-dark:bg-white/[0.05] theme-dark:border-white/[0.06]"
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
                    className="absolute inset-0 rounded-full bg-[#FFFFFF] shadow-[0_1px_2px_rgba(0,0,0,0.08)] theme-dark:bg-[#27272A]"
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
                className={cn(ctaButton, "hidden sm:flex")}
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
                  className="h-9 py-[3px] pl-1 pr-3 rounded-full bg-[#FFFFFF] border border-[rgba(20,20,19,0.09)] hover:border-[rgba(20,20,19,0.16)] shadow-[0_1px_2px_rgba(0,0,0,0.03)] theme-dark:bg-[#18181B] theme-dark:border-white/10 theme-dark:hover:border-white/20 flex items-center gap-2 transition-colors"
                >
                  {/* Editorial monogram, not the provider photo (Google's default is a bright letter tile) */}
                  <span
                    aria-hidden
                    className="grid place-items-center w-7 h-7 shrink-0 rounded-full bg-[#1C1B18] text-[#FAF8F5] font-serif font-semibold text-[12.5px] leading-none theme-dark:bg-[#FAF8F5] theme-dark:text-[#141413]"
                  >
                    {(user.displayName?.trim()[0] || "?").toUpperCase()}
                  </span>
                  <span className="hidden xl:block text-[13px] font-medium text-[var(--fg-secondary)] truncate max-w-[110px]">
                    {user.displayName}
                  </span>
                  {isElite && (
                    <span aria-label="Elite member" className="text-[11px] leading-none text-[#C27C0E] theme-dark:text-[#E0A53A]">
                      ✦
                    </span>
                  )}
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
                        className="absolute right-0 top-full mt-2.5 w-72 p-1.5 origin-top-right rounded-2xl bg-[var(--panel)] border border-[var(--border)] shadow-xl z-50"
                      >
                        <div className="px-2.5 pt-2 pb-2.5 mb-1 border-b border-[var(--border)]">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[13.5px] font-semibold text-[var(--fg)] truncate">{user.displayName}</p>
                            {isElite ? (
                              <EliteNameBadge />
                            ) : (
                              <span className="shrink-0 inline-flex items-center h-5 px-1.5 rounded-full text-[10.5px] font-medium tracking-wide border text-[var(--fg-muted)] border-[var(--border)] bg-[var(--surface)]">
                                Free
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-[var(--fg-muted)] truncate">@{user.username}</p>
                          {user.email && <p className="text-xs text-[var(--fg-subtle)] truncate">{user.email}</p>}
                        </div>

                        {[
                          { href: "/profile", icon: User, label: "Profile Hub" },
                          { href: "/dashboard", icon: FileText, label: "My Articles" },
                          { href: "/bookmarks", icon: Bookmark, label: "Library" },
                          { href: "/profile#history", icon: History, label: "Reading History" },
                          { href: "/profile#highlights", icon: Highlighter, label: "Private Highlights" },
                          ...(isElite ? [{ href: "/dashboard/earnings", icon: Wallet, label: "Earnings" }] : []),
                          { href: "/settings", icon: Settings, label: "Settings" },
                        ].map(({ href, icon: Icon, label }) => (
                          <Link key={href} href={href} role="menuitem" onClick={() => setUserMenuOpen(false)} className={menuItem}>
                            <Icon className="w-[15px] h-[15px] text-[var(--fg-muted)]" strokeWidth={1.75} />
                            {label}
                          </Link>
                        ))}

                        {/* Progressive capabilities: upgrade in place, then the panel button's own states */}
                        <div className="my-1 h-px bg-[var(--border)]" />
                        {!isElite && (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setUserMenuOpen(false)
                              openUpgrade()
                            }}
                            className={cn(menuItem, "w-full font-medium text-[var(--elite-ink)]")}
                          >
                            <Sparkles className="w-[15px] h-[15px]" strokeWidth={1.75} />
                            Upgrade to Prism Elite
                          </button>
                        )}
                        <PanelApplyButton variant="menu" onNavigate={() => setUserMenuOpen(false)} className="mt-0.5" />

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
                className={cn(ctaButton, "flex")}
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
                  className={cn(ctaButton, "inline-flex h-10")}
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
