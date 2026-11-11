"use client"

import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { BadgeCheck, Coins, Fingerprint, GraduationCap } from "lucide-react"
import { BADGES, type BadgeId } from "@/lib/elite/badges"
import { cn } from "@/lib/utils"
import { useBadges } from "./hooks"

const ICON: Record<BadgeId, typeof BadgeCheck> = {
  ELITE_AUTHOR: BadgeCheck,
  PEER_REVIEWED_SCHOLAR: GraduationCap,
  TOP_MONETIZED_WRITER: Coins,
  HUMAN_VERIFIED_95: Fingerprint,
}

// Light pill styling; deliberately no gold/yellow.
const TONE = {
  indigo: "border-indigo-200 bg-indigo-50 text-indigo-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  blue: "border-sky-200 bg-sky-50 text-sky-700",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
} as const

/** One badge. `compact` = icon-only chip (bylines, review cards); otherwise icon + label. */
export function BadgePill({ id, compact, className }: { id: BadgeId; compact?: boolean; className?: string }) {
  const b = BADGES[id]
  const Icon = ICON[id]
  return (
    <TooltipPrimitive.Root delayDuration={200}>
      <TooltipPrimitive.Trigger asChild>
        <span
          tabIndex={0}
          aria-label={`${b.label}: ${b.howEarned}`}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-indigo-300",
            compact ? "h-5 w-5 justify-center" : "h-6 px-2.5 text-xs",
            TONE[b.tone],
            className
          )}
        >
          <Icon className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} aria-hidden />
          {!compact && b.label}
        </span>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="top"
          sideOffset={6}
          className="z-[90] max-w-[240px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-lg"
        >
          <p className="font-semibold text-slate-900">{b.label}</p>
          <p className="mt-0.5 leading-relaxed">{b.howEarned}</p>
          <TooltipPrimitive.Arrow className="fill-white" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

/** Every badge a user can currently display. Renders nothing for Free or lapsed accounts. */
export function UserBadges({ username, compact, className }: { username: string; compact?: boolean; className?: string }) {
  const badges = useBadges(username)
  if (!badges.length) return null
  return (
    <TooltipPrimitive.Provider>
      <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
        {badges.map((id) => (
          <BadgePill key={id} id={id} compact={compact} />
        ))}
      </span>
    </TooltipPrimitive.Provider>
  )
}

/** Small "Elite" tier tag */
export function EliteTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center h-5 px-2 rounded-full border border-indigo-200 bg-indigo-50 text-[11px] font-semibold tracking-wide uppercase text-indigo-700",
        className
      )}
    >
      Elite
    </span>
  )
}
