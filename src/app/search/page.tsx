import { Suspense } from "react"
import type { Metadata } from "next"
import { Search } from "lucide-react"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { SearchClient } from "@/components/discovery/SearchClient"

export const metadata: Metadata = {
  title: "Search",
  description: "Search stories, writers and topics on Prism.",
  robots: { index: false, follow: true },
}

export default function SearchPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <SiteHeader />
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-20">
          <p className="meta">Search</p>
          <h1 className="display mt-3 text-[2.5rem] sm:text-[3.5rem]">Find your next read.</h1>
          <Suspense fallback={<SearchFallback />}>
            <SearchClient />
          </Suspense>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

// Same footprint as the live input so nothing jumps when the client island mounts
function SearchFallback() {
  return (
    <div className="mt-8 relative">
      <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--fg-muted)]" />
      <div className="w-full h-14 pl-13 rounded-full border border-[var(--border-strong)] bg-[var(--panel)] shadow-[var(--shadow)]" />
    </div>
  )
}
