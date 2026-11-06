import type { Metadata } from "next"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { LibraryClient } from "@/components/discovery/LibraryClient"

export const metadata: Metadata = {
  title: "Library — Prism",
  description: "Stories you saved and the latest from writers you follow.",
}

export default function LibraryPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <SiteHeader />
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-20">
          <p className="meta">Library</p>
          <h1 className="display mt-3 text-[2.5rem] sm:text-[3.5rem]">Your reading, kept.</h1>
          <p className="mt-4 mb-8 max-w-lg text-lg leading-relaxed text-[var(--fg-muted)]">
            Saved stories and new work from the writers you follow, in one quiet place.
          </p>
          <LibraryClient />
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
