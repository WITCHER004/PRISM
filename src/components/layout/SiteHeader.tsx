"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { useUIStore, toast } from "@/lib/store"
import { NotificationsMenu } from "@/components/layout/NotificationsMenu"
import { Avatar } from "@/components/ui/Avatar"
import { Wordmark } from "@/components/ui/Wordmark"
import { MOCK_USERS } from "@/lib/data"
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
} from "lucide-react"
import { cn } from "@/lib/utils"

const THEMES = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "sepia", icon: BookOpen, label: "Sepia" },
  { value: "dark", icon: Moon, label: "Dark" },
] as const

export function SiteHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme, currentUser, signOut, profile } = useUIStore()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const user = MOCK_USERS.find((u) => u.username === currentUser)
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

  const switchTheme = (value: (typeof THEMES)[number]["value"]) => {
    document.documentElement.setAttribute("data-theme", value)
    setTheme(value)
  }

  if (isEditor) return null

  return (
    <header className="site-header sticky top-0 z-50 bg-[var(--bg)] border-b border-[var(--border)] transition-colors">
      {/* ── Broadsheet Top Wire Strip ── */}
      <div className="border-b border-[var(--border)] py-1 px-4 sm:px-6 hidden sm:block">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-[11px] font-mono text-[var(--fg-muted)]">
          <div className="flex items-center gap-3">
            <span className="font-bold uppercase tracking-wider text-[var(--fg)]">THE PRISM</span>
            <span>|</span>
            <span className="uppercase">VOL. CXXIV · ISSUE NO. 4,892</span>
            <span>|</span>
            <span className="text-[var(--accent)] font-semibold uppercase">● CONTINUOUS DISPATCH</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/membership" className="hover:text-[var(--fg)] uppercase tracking-wider">
              MEMBERSHIP
            </Link>
            <span>·</span>
            <Link href="/about" className="hover:text-[var(--fg)] uppercase tracking-wider">
              ETHICS &amp; CHARTER
            </Link>
          </div>
        </div>
      </div>

      {/* ── Main Navigation Bar ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        <div className="flex items-center gap-6">
          <Wordmark size="md" />

          <nav className="hidden md:flex items-center gap-1 font-mono text-xs uppercase tracking-wider">
            {[
              { href: "/explore", label: "Explore" },
              { href: "/explore/investigations", label: "Investigations" },
              { href: "/explore/technology", label: "Systems" },
              { href: "/explore/design", label: "Design" },
              { href: "/explore/science", label: "Science" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-2.5 py-1 transition-colors border border-transparent hover:border-[var(--border)]",
                  pathname === link.href
                    ? "font-bold text-[var(--fg)] border-[var(--border-strong)] bg-[var(--surface)]"
                    : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right Tools: Search, Theme, Write, Account */}
        <div className="flex items-center gap-2">
          {/* Search Trigger */}
          <Link
            href="/search"
            className="flex items-center gap-2 px-2.5 py-1 border border-[var(--border)] bg-[var(--panel)] text-xs font-mono text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:text-[var(--fg)] transition-colors"
          >
            <Search className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span className="hidden sm:inline">SEARCH</span>
            <kbd className="hidden sm:inline text-[10px] bg-[var(--surface)] px-1 py-0.2 border border-[var(--border)]">
              ⌘K
            </kbd>
          </Link>

          {/* Theme switcher */}
          <div className="hidden sm:flex items-center border border-[var(--border)] bg-[var(--panel)]">
            {THEMES.map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => switchTheme(value)}
                title={`${label} Edition`}
                className={cn(
                  "p-1.5 transition-colors cursor-pointer",
                  theme === value
                    ? "bg-[var(--fg)] text-[var(--bg)]"
                    : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>

          {/* Write Action Button (Crisp zero-radius) */}
          <Link
            href="/editor/new"
            className="flex items-center gap-1.5 px-3 py-1 bg-[var(--fg)] text-[var(--bg)] font-mono text-xs uppercase tracking-wider font-bold hover:bg-[var(--accent)] hover:text-white transition-colors"
          >
            <PenLine className="w-3 h-3" />
            <span className="hidden xs:inline">Write</span>
          </Link>

          {/* User menu or Sign in */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
                className="flex items-center gap-1.5 p-1 border border-[var(--border)] hover:border-[var(--border-strong)] transition-colors cursor-pointer"
              >
                <Avatar src={user.avatarUrl} alt={user.displayName} size="xs" />
                <span className="hidden md:inline font-mono text-xs uppercase font-medium text-[var(--fg)]">
                  {user.displayName.split(" ")[0]}
                </span>
              </button>

              <AnimatePresence>
                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                    <motion.div
                      role="menu"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.12 }}
                      className="absolute right-0 top-full mt-1.5 w-60 border border-[var(--border-strong)] bg-[var(--panel)] z-50 p-2 font-mono text-xs"
                    >
                      <div className="p-2 border-b border-[var(--border)] mb-2">
                        <p className="font-bold text-[var(--fg)] truncate">
                          {profile.displayName || user.displayName}
                        </p>
                        <p className="text-[10px] text-[var(--fg-muted)]">@{user.username}</p>
                      </div>

                      {[
                        { href: `/${user.username}`, icon: User, label: "Author Profile" },
                        { href: "/bookmarks", icon: Bookmark, label: "Archive / Saved" },
                        { href: "/dashboard", icon: LayoutDashboard, label: "Editorial Desk" },
                        { href: "/settings", icon: Settings, label: "Preferences" },
                      ].map(({ href, icon: Icon, label }) => (
                        <Link
                          key={href}
                          href={href}
                          role="menuitem"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-2 py-1.5 uppercase tracking-wider text-[var(--fg-secondary)] hover:bg-[var(--surface)] hover:text-[var(--fg)] transition-colors"
                        >
                          <Icon className="w-3.5 h-3.5 text-[var(--accent)]" />
                          <span>{label}</span>
                        </Link>
                      ))}

                      <div className="my-1 border-t border-[var(--border)]" />

                      <button
                        role="menuitem"
                        onClick={() => {
                          setUserMenuOpen(false)
                          signOut()
                          toast("Signed out")
                          router.push("/")
                        }}
                        className="flex items-center gap-2.5 px-2 py-1.5 uppercase tracking-wider text-[var(--fg-muted)] hover:bg-[var(--surface)] hover:text-[var(--fg)] w-full text-left transition-colors cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Link
                href="/auth/login"
                className="px-2.5 py-1 text-xs font-mono uppercase tracking-wider text-[var(--fg-secondary)] hover:text-[var(--fg)] border border-transparent hover:border-[var(--border)]"
              >
                Sign In
              </Link>
              <Link
                href="/auth/signup"
                className="px-2.5 py-1 text-xs font-mono uppercase tracking-wider font-bold bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--accent)] hover:text-white transition-colors"
              >
                Subscribe
              </Link>
            </div>
          )}

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-1.5 border border-[var(--border)] text-[var(--fg)] cursor-pointer"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-[var(--border)] bg-[var(--panel)] p-4 font-mono text-xs uppercase"
          >
            <div className="flex flex-col gap-2">
              {[
                { href: "/", label: "Front Page" },
                { href: "/explore", label: "Explore Index" },
                { href: "/explore/investigations", label: "Investigations" },
                { href: "/explore/technology", label: "Technology" },
                { href: "/bookmarks", label: "Archive Library" },
                { href: "/membership", label: "Membership Charter" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="py-1.5 px-2 border-b border-[var(--border)] text-[var(--fg-secondary)] hover:text-[var(--fg)]"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="mt-4 pt-3 flex items-center justify-between">
              <div className="flex items-center gap-1">
                {THEMES.map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    onClick={() => switchTheme(value)}
                    className={cn(
                      "p-1.5 border border-[var(--border)] text-xs",
                      theme === value ? "bg-[var(--fg)] text-[var(--bg)]" : "text-[var(--fg-muted)]"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>

              <Link
                href="/editor/new"
                onClick={() => setMobileOpen(false)}
                className="px-3 py-1 bg-[var(--fg)] text-[var(--bg)] font-bold text-xs uppercase"
              >
                Write Dispatch
              </Link>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  )
}
