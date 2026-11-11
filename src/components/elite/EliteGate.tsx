"use client"

import Link from "next/link"
import { ArrowRight, Lock } from "lucide-react"
import { useHydrated } from "@/components/studio/useHydrated"
import { useSubscription } from "./hooks"

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
      <Link
        href="/elite"
        className="mt-8 inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
      >
        {lapsed ? "Renew Elite" : "See Elite plans"} <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  )
}
