import type { Metadata } from "next"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { ForumClient } from "@/components/forum/ForumClient"

export const metadata: Metadata = {
  title: "Discussions",
  description: "Open threads between Prism readers and writers: questions, arguments and follow-ups on the ideas in our stories.",
  alternates: { canonical: "/forum" },
}

export default function ForumPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <SiteHeader />
      <main className="flex-1">
        <ForumClient />
      </main>
      <SiteFooter />
    </div>
  )
}
