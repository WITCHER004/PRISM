"use client"

import { MOCK_POSTS, MOCK_USERS, type Post } from "@/lib/data"
import { useUIStore } from "@/lib/store"
import { cn } from "@/lib/utils"

/** The signed-in writer (demo: one of the sample users, defaulting to the first) */
export function useWriter() {
  const currentUser = useUIStore((s) => s.currentUser)
  const displayName = useUIStore((s) => s.profile.displayName)
  const user = MOCK_USERS.find((u) => u.username === currentUser) ?? MOCK_USERS[0]
  return { user, displayName: displayName || user.displayName }
}

export function samplePostsFor(username: string): Post[] {
  return MOCK_POSTS.filter((p) => p.author.username === username)
}

/** Strip tags so word counts and excerpts work from stored HTML */
export function htmlToText(html: string) {
  return html
    .replace(/<\/(p|h[1-6]|li|blockquote|pre)>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

export function wordCount(html: string) {
  const t = htmlToText(html)
  return t ? t.split(" ").length : 0
}

/** True when the HTML has any readable text or an image */
export function hasBody(html: string) {
  return wordCount(html) > 0 || /<img\s/i.test(html)
}

export const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 })

/** Deterministic pseudo-random numbers so sample charts look the same on every visit */
export function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function PageHead({
  title,
  lede,
  actions,
}: {
  title: React.ReactNode
  lede?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
      <div className="max-w-2xl">
        <p className="meta">Studio</p>
        <h1 className="display mt-3 text-[2.5rem] sm:text-[3.25rem]">{title}</h1>
        {lede && <p className="mt-4 text-[var(--fg-muted)] text-base sm:text-lg leading-relaxed">{lede}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Small mono pill marking numbers that come from the demo data set */
export function SampleBadge({ className, label = "Sample data" }: { className?: string; label?: string }) {
  return (
    <span
      className={cn(
        "meta inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border border-dashed border-[var(--border-strong)] text-[var(--fg-muted)] normal-case tracking-normal",
        className
      )}
    >
      <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-[var(--fg-subtle)]" />
      {label}
    </span>
  )
}

export function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  sample,
  className,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  sample?: boolean
  className?: string
}) {
  return (
    <div className={cn("panel p-5 flex flex-col", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="meta">{label}</p>
        {Icon && <Icon className="w-4 h-4 text-[var(--fg-subtle)]" />}
      </div>
      <p className="display mt-4 text-[2rem] tabular-nums">{value}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--fg-muted)]">
        {sub}
        {sample && <SampleBadge label="Sample" />}
      </div>
    </div>
  )
}

export const inputClass =
  "w-full h-11 px-4 rounded-[12px] bg-[var(--panel)] border border-[var(--border)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:border-[var(--fg)] outline-none transition-colors"
