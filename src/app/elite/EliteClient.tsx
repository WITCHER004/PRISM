"use client"

import { useState } from "react"
import Link from "next/link"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { ArrowRight, Check, CreditCard, Loader2, Lock, Minus, PartyPopper } from "lucide-react"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { StudioDialog, DialogActions } from "@/components/studio/StudioDialog"
import { useHydrated } from "@/components/studio/useHydrated"
import { BadgePill, EliteTag } from "@/components/elite/EliteBadges"
import { useSubscription } from "@/components/elite/hooks"
import { Button } from "@/components/ui/Button"
import { BADGE_ORDER, BADGES } from "@/lib/elite/badges"
import { ELITE_PERIOD_DAYS, ELITE_PRICE_USD, PANEL_PASS_THRESHOLD, PANEL_SIZE, PAYOUT_RPM_USD } from "@/lib/elite/config"
import { TIER_FEATURES } from "@/lib/elite/subscription"
import { useUIStore, toast } from "@/lib/store"
import { cn, formatDate } from "@/lib/utils"

type Phase = null | "form" | "processing" | "done"

export function EliteClient() {
  const hydrated = useHydrated()
  const currentUser = useUIStore((s) => s.currentUser)
  const { isElite, subscription } = useSubscription()
  const [phase, setPhase] = useState<Phase>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const cancelElite = useUIStore((s) => s.cancelElite)
  const lapsed = subscription.tier === "ELITE" && !isElite

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <SiteHeader />
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-24">
        <section className="max-w-3xl">
          <p className="meta">For writers</p>
          <h1 className="display mt-3 text-[2.75rem] sm:text-[4rem] leading-[0.98]">
            Prism Elite
          </h1>
          <p className="mt-5 text-lg sm:text-xl text-[var(--fg-muted)] leading-relaxed">
            Earn ${PAYOUT_RPM_USD.toFixed(2)} for every 1,000 unique readers, put your work in front of a {PANEL_SIZE}-member
            peer panel, and carry badges that show how it was earned.
          </p>
        </section>

        {/* Plans */}
        <section className="mt-12 grid md:grid-cols-2 gap-5 items-stretch" aria-label="Plans">
          <div className="panel p-6 sm:p-8 flex flex-col">
            <h2 className="font-display text-xl font-semibold">Free</h2>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">Publish, get read, get rated.</p>
            <p className="mt-6 display text-[2.75rem] leading-none tabular-nums">
              $0<span className="text-base font-normal text-[var(--fg-muted)]"> / month</span>
            </p>
            <ul className="mt-6 space-y-2.5 text-sm flex-1">
              {TIER_FEATURES.filter((f) => f.free).map((f) => (
                <li key={f.label} className="flex gap-2.5">
                  <Check className="w-4 h-4 mt-0.5 shrink-0 text-[var(--fg-muted)]" />
                  {f.label}
                </li>
              ))}
            </ul>
            <p className="mt-8 h-11 grid place-items-center rounded-full border border-[var(--border)] text-sm text-[var(--fg-muted)]">
              {hydrated && currentUser && !isElite ? "Your current plan" : "Included with every account"}
            </p>
          </div>

          <div className="relative rounded-[var(--radius-card)] border-2 border-indigo-500 bg-white p-6 sm:p-8 flex flex-col shadow-[var(--shadow)]">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl font-semibold">Elite</h2>
              <EliteTag />
            </div>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">Everything in Free, plus earnings, the panel and badges.</p>
            <p className="mt-6 display text-[2.75rem] leading-none tabular-nums">
              ${ELITE_PRICE_USD}
              <span className="text-base font-normal text-[var(--fg-muted)]"> / month</span>
            </p>
            <ul className="mt-6 space-y-2.5 text-sm flex-1">
              {TIER_FEATURES.filter((f) => !f.free).map((f) => (
                <li key={f.label} className="flex gap-2.5">
                  <Check className="w-4 h-4 mt-0.5 shrink-0 text-indigo-600" />
                  <span>
                    <span className="font-medium">{f.label}</span>
                    <span className="block text-[var(--fg-muted)]">{f.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              {!hydrated ? (
                <div className="h-11 rounded-full bg-[var(--surface)] animate-pulse" />
              ) : !currentUser ? (
                <Link
                  href="/auth/login?redirectTo=/elite"
                  className="flex h-11 items-center justify-center gap-2 rounded-full bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  Sign in to upgrade <ArrowRight className="w-4 h-4" />
                </Link>
              ) : isElite ? (
                <div className="rounded-[14px] border border-indigo-100 bg-indigo-50 p-4 text-sm">
                  <p className="font-semibold text-indigo-900">You&apos;re on Elite</p>
                  <p className="mt-1 text-indigo-800/80">
                    Active since {formatDate(subscription.subscribedAt!)}
                    {subscription.expiresAt ? ` · renews ${formatDate(subscription.expiresAt)}` : ""}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href="/dashboard/earnings" className="inline-flex h-9 items-center px-3.5 rounded-full bg-indigo-600 text-white font-medium hover:bg-indigo-700">
                      Earnings
                    </Link>
                    <button
                      type="button"
                      onClick={() => setCancelOpen(true)}
                      className="inline-flex h-9 items-center px-3.5 rounded-full border border-indigo-200 bg-white text-indigo-800 hover:border-indigo-400"
                    >
                      Cancel subscription
                    </button>
                  </div>
                </div>
              ) : (
                <Button size="lg" className="w-full bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => setPhase("form")}>
                  {lapsed ? "Renew Elite" : "Upgrade to Elite"} <ArrowRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* Comparison */}
        <section className="mt-16" aria-labelledby="compare-title">
          <h2 id="compare-title" className="display text-[1.75rem]">
            Free and Elite, side by side
          </h2>
          <div className="mt-5 panel overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="border-b border-[var(--border)] text-left">
                  <th className="px-5 py-3 font-medium text-[var(--fg-muted)]">Feature</th>
                  <th className="px-5 py-3 font-medium text-[var(--fg-muted)] w-24 text-center">Free</th>
                  <th className="px-5 py-3 font-medium text-indigo-700 w-24 text-center">Elite</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {TIER_FEATURES.map((f) => (
                  <tr key={f.label}>
                    <td className="px-5 py-3.5">
                      <p className="font-medium">{f.label}</p>
                      <p className="text-[var(--fg-muted)]">{f.detail}</p>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {f.free ? <Check className="w-4 h-4 mx-auto text-slate-600" aria-label="Included" /> : <Minus className="w-4 h-4 mx-auto text-slate-300" aria-label="Not included" />}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <Check className="w-4 h-4 mx-auto text-indigo-600" aria-label="Included" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* How it works */}
        <section className="mt-16 grid md:grid-cols-3 gap-5" aria-label="How Elite works">
          <div className="panel p-6">
            <p className="meta">Monetization</p>
            <h3 className="mt-2 font-display text-lg font-semibold">Paid per unique view</h3>
            <p className="mt-2 text-sm text-[var(--fg-muted)] leading-relaxed">
              Each reader counts once per article per 24 hours. ${PAYOUT_RPM_USD.toFixed(2)} RPM goes to your balance, and you can
              withdraw it from your earnings dashboard.
            </p>
          </div>
          <div className="panel p-6">
            <p className="meta">Peer panel</p>
            <h3 className="mt-2 font-display text-lg font-semibold">
              {PANEL_SIZE} reviewers, {PANEL_PASS_THRESHOLD} to pass
            </h3>
            <p className="mt-2 text-sm text-[var(--fg-muted)] leading-relaxed">
              After the AI check and employee review, every article goes to the panel. Every FAIL vote comes with a reason. Disagree? Submit a counter-reason and the reviewer reconsiders it.
            </p>
          </div>
          <div className="panel p-6">
            <p className="meta">Badges</p>
            <h3 className="mt-2 font-display text-lg font-semibold">Shown while you&apos;re Elite</h3>
            <TooltipPrimitive.Provider>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {BADGE_ORDER.map((id) => (
                  <BadgePill key={id} id={id} />
                ))}
              </div>
            </TooltipPrimitive.Provider>
            <p className="mt-3 text-xs text-[var(--fg-muted)]">Badges hide if your subscription lapses and return when you renew.</p>
          </div>
        </section>
      </main>
      <SiteFooter />

      <CheckoutDialog phase={phase} setPhase={setPhase} />

      <StudioDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel Elite?"
        description="Paid features lock right away: per-view earnings stop, the peer panel closes to new submissions, and your badges are hidden. Your balance and earned badges are kept for when you come back."
      >
        <DialogActions>
          <Button variant="secondary" size="lg" onClick={() => setCancelOpen(false)}>
            Keep Elite
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              cancelElite()
              setCancelOpen(false)
              toast("Elite cancelled. Badges are hidden until you renew.")
            }}
          >
            Cancel subscription
          </Button>
        </DialogActions>
      </StudioDialog>
    </div>
  )
}

function CheckoutDialog({ phase, setPhase }: { phase: Phase; setPhase: (p: Phase) => void }) {
  const upgradeToElite = useUIStore((s) => s.upgradeToElite)
  const [card, setCard] = useState({ number: "4242 4242 4242 4242", expiry: "12 / 30", cvc: "123", name: "" })
  const [error, setError] = useState("")

  const pay = async () => {
    setError("")
    setPhase("processing")
    try {
      // Mock checkout handler; with a database + ELITE_PAYMENT_PROVIDER this creates a Stripe/Razorpay session
      const res = await fetch("/api/elite/checkout", { method: "POST" })
      const body = (await res.json()) as { reference?: string; status?: string; error?: string }
      if (!res.ok || !body.reference) throw new Error(body.error ?? "Checkout failed.")
      const done = upgradeToElite(body.reference)
      if (!done.ok) throw new Error(done.error)
      setPhase("done")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed.")
      setPhase("form")
    }
  }

  const input = "mt-1.5 w-full h-11 px-3.5 rounded-[12px] bg-white border border-slate-200 text-sm outline-none focus:border-indigo-500 tabular-nums"

  return (
    <StudioDialog
      open={phase !== null}
      onOpenChange={(o) => !o && phase !== "processing" && setPhase(null)}
      dismissable={phase !== "processing"}
      title={phase === "done" ? "Welcome to Elite" : "Upgrade to Elite"}
      description={
        phase === "done"
          ? "Your Elite Author badge is live, new views of your articles now earn money, and the peer panel is open to you."
          : `$${ELITE_PRICE_USD}.00 every ${ELITE_PERIOD_DAYS} days. Cancel any time.`
      }
    >
      {phase === "done" ? (
        <div className="mt-6">
          <div className="flex items-center gap-3 rounded-[14px] border border-emerald-200 bg-emerald-50 p-4">
            <PartyPopper className="w-5 h-5 text-emerald-700" />
            <TooltipPrimitive.Provider>
              <BadgePill id="ELITE_AUTHOR" />
            </TooltipPrimitive.Provider>
            <span className="text-sm text-emerald-900">{BADGES.ELITE_AUTHOR.howEarned}</span>
          </div>
          <DialogActions>
            <Link
              href="/editor/new"
              className="inline-flex items-center justify-center h-11 px-6 rounded-full text-sm font-medium border border-[var(--border-strong)] hover:border-[var(--fg)]"
            >
              Write for the panel
            </Link>
            <Link
              href="/dashboard/earnings"
              className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700"
            >
              Open earnings <ArrowRight className="w-4 h-4" />
            </Link>
          </DialogActions>
        </div>
      ) : (
        <form
          className="mt-6"
          onSubmit={(e) => {
            e.preventDefault()
            void pay()
          }}
        >
          <p className="flex items-center gap-2 rounded-[12px] border border-dashed border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
            <Lock className="w-3.5 h-3.5" /> Test checkout — no card is charged. The test card is prefilled.
          </p>
          <label className="mt-4 block text-sm font-medium">
            Name on card
            <input
              className={input}
              value={card.name}
              onChange={(e) => setCard({ ...card, name: e.target.value })}
              placeholder="Your name"
              autoComplete="cc-name"
            />
          </label>
          <label className="mt-3 block text-sm font-medium">
            Card number
            <span className="relative block">
              <input className={cn(input, "pr-10")} value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} inputMode="numeric" />
              <CreditCard className="absolute right-3 top-1/2 mt-[3px] -translate-y-1/2 w-4 h-4 text-slate-400" />
            </span>
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium">
              Expiry
              <input className={input} value={card.expiry} onChange={(e) => setCard({ ...card, expiry: e.target.value })} />
            </label>
            <label className="block text-sm font-medium">
              CVC
              <input className={input} value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value })} inputMode="numeric" />
            </label>
          </div>
          {error && (
            <p role="alert" className="mt-3 text-sm text-[var(--error)]">
              {error}
            </p>
          )}
          <DialogActions>
            <Button type="button" variant="secondary" size="lg" onClick={() => setPhase(null)} disabled={phase === "processing"}>
              Not now
            </Button>
            <Button type="submit" size="lg" className="bg-indigo-600 text-white hover:bg-indigo-700" disabled={phase === "processing"}>
              {phase === "processing" && <Loader2 className="w-4 h-4 animate-spin" />}
              Pay ${ELITE_PRICE_USD}.00
            </Button>
          </DialogActions>
        </form>
      )}
    </StudioDialog>
  )
}
