"use client"

import Link from "next/link"
import { ArrowRight, Lock } from "lucide-react"
import { useHydrated } from "@/components/studio/useHydrated"
import { useSubscription } from "./hooks"
import { openUpgrade } from "./UpgradeDialog"
import { EliteComingSoon } from "@/components/elite/EliteComingSoon"
import { ELITE_OPEN } from "@/lib/elite/config"

/** Renders children only for active Elite members; everyone else gets an upgrade prompt */
export function EliteGate({
  feature,
  description,
  children,
}: {
  feature: string
  description: string
  children: React.ReactNode
}) {
  const hydrated = useHydrated()
  const { isElite, subscription } = useSubscription()
  if (!hydrated) return <div className="h-64 rounded-[var(--radius-card)] bg-[var(--surface)] animate-pulse" aria-busy="true" />
  if (isElite) return <>{children}</>
  const lapsed = subscription.tier === "ELITE"
  return (
    <div className="max-w-xl mx-auto text-center py-14">
      <span className="mx-auto grid place-items-center w-14 h-14 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700">
        <Lock className="w-6 h-6" />
      </span>
      <p className="meta mt-6">Elite feature</p>
      <h1 className="display mt-3 text-[2rem] sm:text-[2.5rem]">{feature}</h1>
      <p className="mt-3 text-[var(--fg-muted)] leading-relaxed">{description}</p>
      {lapsed && (
        <p className="mt-3 text-sm text-[var(--fg-muted)]">
          Your Elite subscription is inactive. Your earnings and badges are kept and come back when you renew.
        </p>
      )}
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {ELITE_OPEN ? (
          <button
            type="button"
            onClick={openUpgrade}
            className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full text-sm font-medium bg-[var(--fg)] text-[var(--bg)] hover:opacity-90 transition-opacity"
          >
            <Lock className="w-4 h-4 text-[var(--gold)]" /> {lapsed ? "Renew Prism Elite" : "Upgrade to Prism Elite"}
          </button>
        ) : (
          <EliteComingSoon />
        )}
        <Link
          href="/elite"
          className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full text-sm font-medium border border-[var(--border-strong)] hover:border-[var(--fg)] transition-colors"
        >
          Compare plans <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}
