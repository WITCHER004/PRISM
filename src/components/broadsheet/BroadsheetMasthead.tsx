"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { useUIStore } from "@/lib/store"
import { Search, Sun, Moon, BookOpen, PenLine, User } from "lucide-react"

export function BroadsheetMasthead() {
  const pathname = usePathname()
  const { theme, setTheme } = useUIStore()
  const [currentDate, setCurrentDate] = useState("")

  useEffect(() => {
    const now = new Date()
    setCurrentDate(
      now.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    )
  }, [])

  const sections = [
    { label: "Front Page", href: "/" },
    { label: "Investigations", href: "/explore/investigations" },
    { label: "Systems & Architecture", href: "/explore/technology" },
    { label: "Science & Climate", href: "/explore/science" },
    { label: "Engineering Craft", href: "/explore/programming" },
    { label: "Design Systems", href: "/explore/design" },
    { label: "Economics & Markets", href: "/explore/startups" },
    { label: "Membership", href: "/membership" },
  ]

  const nextTheme = theme === "light" ? "dark" : theme === "dark" ? "sepia" : "light"
  const ThemeIcon = theme === "light" ? Moon : theme === "dark" ? BookOpen : Sun

  return (
    <header className="site-header border-b border-[var(--border)] bg-[var(--bg)] transition-colors">
      {/* ── Top Utility Bar ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between text-xs font-mono text-[var(--fg-muted)] border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <span className="font-semibold uppercase tracking-wider text-[var(--fg)]">
            {currentDate || "Thursday, November 5, 2026"}
          </span>
          <span className="text-[var(--border)] hidden sm:inline">/</span>
          <span className="hidden sm:inline uppercase tracking-wider text-[11px] text-[var(--fg-subtle)]">
            Digital Edition
          </span>
          <span className="text-[var(--border)] hidden md:inline">/</span>
          <span className="hidden md:inline uppercase text-[11px] text-[var(--accent)] font-semibold">
            Independent Publishing
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/search"
            className="flex items-center gap-1.5 hover:text-[var(--fg)] transition-colors py-1 px-2 border border-[var(--border)] bg-[var(--panel)] text-[11px] uppercase"
          >
            <Search className="w-3 h-3 text-[var(--accent)]" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden sm:inline text-[9px] bg-[var(--surface)] px-1 border border-[var(--border)]">
              K
            </kbd>
          </Link>

          <button
            onClick={() => setTheme(nextTheme)}
            className="flex items-center gap-1.5 hover:text-[var(--fg)] transition-colors py-1 px-2 border border-[var(--border)] bg-[var(--panel)] text-[11px] uppercase cursor-pointer"
            title={`Switch to ${nextTheme} edition`}
          >
            <ThemeIcon className="w-3 h-3" />
            <span className="hidden sm:inline capitalize">{theme}</span>
          </button>

          <Link
            href="/editor/new"
            className="flex items-center gap-1.5 px-3 py-1 bg-[var(--fg)] text-[var(--bg)] font-mono uppercase text-[11px] font-bold tracking-wider hover:bg-[var(--accent)] hover:text-white transition-colors"
          >
            <PenLine className="w-3 h-3" />
            <span>Write</span>
          </Link>

          <Link
            href="/dashboard"
            className="hover:text-[var(--fg)] transition-colors p-1 border border-[var(--border)] bg-[var(--panel)]"
            title="Desk / Account"
          >
            <User className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* ── Modern Editorial Masthead ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-8">
        <div className="flex flex-col items-center justify-center text-center">
          <Link href="/" className="inline-block group">
            <h1 className="font-serif text-5xl sm:text-7xl md:text-8xl font-black tracking-[-0.03em] uppercase leading-none text-[var(--fg)] group-hover:text-[var(--accent)] transition-colors">
              The Prism
            </h1>
          </Link>
          <p className="text-xs font-mono tracking-[0.2em] uppercase text-[var(--fg-muted)] mt-2">
            Long-form Journalism, Critical Systems &amp; Independent Ideas
          </p>
        </div>

        {/* Crisp Hairline Rule Structure */}
        <div className="mt-5 border-t-2 border-[var(--border-strong)] border-b border-[var(--border-strong)] h-1" />
      </div>

      {/* ── Section Department Navigation ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <nav className="hidden md:flex items-center justify-between py-2 border-b border-[var(--border)] text-xs font-mono uppercase tracking-wider overflow-x-auto">
          {sections.map((section) => {
            const isActive = pathname === section.href
            return (
              <Link
                key={section.href}
                href={section.href}
                className={`py-1 px-2.5 transition-colors ${
                  isActive
                    ? "font-bold text-[var(--fg)] border-b-2 border-[var(--accent)] -mb-[9px]"
                    : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
                }`}
              >
                {section.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
