"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Scale } from "lucide-react"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { useHydrated } from "@/components/studio/useHydrated"
import { CountersTab, PanelTab } from "@/components/panel/ReviewerTabs"
import { PanelApplyButton } from "@/components/panel/PanelApplication"
import { useAccess, usePanelInbox } from "@/components/providers/useAccess"
import { PANEL_PASS_THRESHOLD, PANEL_SIZE } from "@/lib/elite/config"
import { REVIEW_CRITERIA } from "@/lib/elite/panel"
import { cn } from "@/lib/utils"

type Tab = "papers" | "counters"

export function PanelWorkspace() {
  const hydrated = useHydrated()
  const access = useAccess()

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <SiteHeader />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-24">
        {!hydrated ? (
          <div className="space-y-4" aria-busy="true" aria-label="Loading review panel">
            <div className="h-12 w-72 rounded-[14px] bg-[var(--surface)] animate-pulse" />
            <div className="h-64 rounded-[var(--radius-card)] bg-[var(--surface)] animate-pulse" />
          </div>
        ) : access.username && access.isPanelMember ? (
          <Workspace me={access.username} />
        ) : (
          <NotAMember signedIn={!!access.username} />
        )}
      </main>
      <SiteFooter />
    </div>
  )
}

function NotAMember({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="max-w-xl mx-auto text-center py-16">
      <span className="mx-auto grid place-items-center w-14 h-14 rounded-full border border-[var(--elite-line)] bg-[var(--elite-wash)] text-[var(--elite-ink)]">
        <Scale className="w-6 h-6" />
      </span>
      <p className="meta mt-6">Peer Review Panel</p>
      <h1 className="display mt-3 text-[2rem] sm:text-[2.5rem]">For approved panel members</h1>
      <p className="mt-3 text-[var(--fg-muted)] leading-relaxed">
        {PANEL_SIZE} Elite reviewers vote on every Elite paper; {PANEL_PASS_THRESHOLD} PASS votes publish it. Elite writers can apply, and an
        admin reviews each application.
      </p>
      <div className="mt-8 flex justify-center">
        {signedIn ? (
          <PanelApplyButton className="h-11 px-5" />
        ) : (
          <Link
            href="/auth/login?redirectTo=/panel"
            className="inline-flex items-center h-11 px-6 rounded-full text-sm font-medium bg-[var(--fg)] text-[var(--bg)] hover:opacity-90"
          >
            Sign in
          </Link>
        )}
      </div>
    </div>
  )
}

function Workspace({ me }: { me: string }) {
  const [tab, setTab] = useState<Tab>("papers")
  const inbox = usePanelInbox(me)

  // Deep links from notifications: /panel?tab=counters
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "counters") setTab("counters")
  }, [])

  const tabs: { value: Tab; label: string; count: number }[] = [
    { value: "papers", label: "Awaiting your vote", count: inbox.votes },
    { value: "counters", label: "Writer counter-rebuttals", count: inbox.counters },
  ]

  return (
    <>
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
        <div className="max-w-2xl">
          <p className="meta">⚖️ {PANEL_SIZE}-member peer review</p>
          <h1 className="display mt-3 text-[2.5rem] sm:text-[3.25rem]">Review workspace</h1>
          <p className="mt-4 text-[var(--fg-muted)] text-base sm:text-lg leading-relaxed">
            Elite papers that passed the AI check and employee review. Vote Approve or Reject on one criterion (
            {REVIEW_CRITERIA.join(", ")}), and rule on writers&apos; counter-rebuttals to your FAIL votes.
          </p>
        </div>
      </div>

      <div role="tablist" aria-label="Panel sections" className="mt-10 flex items-center gap-1 border-b border-[var(--border)] overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.value}
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              "relative h-11 px-4 text-sm font-medium whitespace-nowrap transition-colors",
              tab === t.value ? "text-[var(--fg)]" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
            )}
          >
            {t.label} <span className="ml-1 meta tabular-nums">{t.count}</span>
            {tab === t.value && <span className="absolute left-2 right-2 -bottom-px h-[2px] rounded-full bg-[var(--fg)]" />}
          </button>
        ))}
      </div>

      {tab === "papers" ? <PanelTab me={me} staff={false} /> : <CountersTab me={me} staff={false} />}
    </>
  )
}
