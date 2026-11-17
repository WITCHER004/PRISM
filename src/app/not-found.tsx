import Link from "next/link"
import type { Metadata } from "next"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
}

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <SiteHeader />
      <main className="flex-1 grid place-items-center px-4 py-24">
        <div className="max-w-md text-center">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--fg-muted)]">404</p>
          <h1 className="display mt-3 text-4xl sm:text-5xl text-[var(--fg)]">This page didn&apos;t refract.</h1>
          <p className="mt-4 text-[var(--fg-secondary)]">
            There&apos;s no story, writer or page at this address. It may have moved, or the link has a typo.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center h-11 px-5 rounded-full bg-[var(--fg)] text-[var(--bg)] text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Back to the feed
            </Link>
            <Link
              href="/explore"
              className="inline-flex items-center h-11 px-5 rounded-full border border-[var(--border)] text-sm text-[var(--fg)] hover:bg-[var(--panel)] transition-colors"
            >
              Explore topics
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
