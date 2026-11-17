"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { CreditCard, Loader2, Lock, PartyPopper } from "lucide-react"
import { StudioDialog, DialogActions } from "@/components/studio/StudioDialog"
import { BadgePill } from "@/components/elite/EliteBadges"
import { useRoleActions } from "@/components/providers/useAccess"
import { Button } from "@/components/ui/Button"
import { BADGES } from "@/lib/elite/badges"
import { ELITE_PERIOD_DAYS, ELITE_PRICE_USD } from "@/lib/elite/config"
import { useUIStore } from "@/lib/store"
import { cn } from "@/lib/utils"

type Phase = "form" | "processing" | "done"

/** Open the in-place upgrade from anywhere (nav, paywall, editor, profile) */
export const openUpgrade = () => useUIStore.getState().setUpgradeOpen(true)

/**
 * The one Elite checkout, mounted once for the whole site. Upgrading flips the tier in the store,
 * AuthContext and Firestore, and every Elite surface unlocks where you are: no redirect.
 */
export function UpgradeDialog() {
  const open = useUIStore((s) => s.upgradeOpen)
  const setOpen = useUIStore((s) => s.setUpgradeOpen)
  const currentUser = useUIStore((s) => s.currentUser)
  const pathname = usePathname()
  const { upgrade } = useRoleActions()
  const [phase, setPhase] = useState<Phase>("form")
  const [card, setCard] = useState({ number: "4242 4242 4242 4242", expiry: "12 / 30", cvc: "123", name: "" })
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      setPhase("form")
      setError("")
    }
  }, [open])

  const close = () => phase !== "processing" && setOpen(false)

  const pay = async () => {
    setError("")
    setPhase("processing")
    try {
      // Mock checkout handler; with a database + ELITE_PAYMENT_PROVIDER this creates a Stripe/Razorpay session
      const res = await fetch("/api/elite/checkout", { method: "POST" })
      const body = (await res.json()) as { reference?: string; error?: string }
      if (!res.ok || !body.reference) throw new Error(body.error ?? "Checkout failed.")
      const done = upgrade(body.reference)
      if (!done.ok) throw new Error(done.error)
      setPhase("done")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed.")
      setPhase("form")
    }
  }

  const input =
    "mt-1.5 w-full h-11 px-3.5 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-sm outline-none focus:border-[var(--fg)] tabular-nums"

  return (
    <StudioDialog
      open={open}
      onOpenChange={(o) => (o ? setOpen(true) : close())}
      dismissable={phase !== "processing"}
      title={!currentUser ? "Sign in to upgrade" : phase === "done" ? "Welcome to Prism Elite" : "Upgrade to Prism Elite"}
      description={
        !currentUser
          ? "Elite is attached to your writer account, so sign in first."
          : phase === "done"
            ? "Everything unlocked right here: your ✦ Elite badge, full Advanced Papers, per-view earnings, and the Peer Review Panel."
            : `$${ELITE_PRICE_USD}.00 every ${ELITE_PERIOD_DAYS} days. Cancel any time.`
      }
    >
      {!currentUser ? (
        <DialogActions>
          <Button variant="secondary" size="lg" onClick={() => setOpen(false)}>
            Not now
          </Button>
          <Link
            href={`/auth/login?redirectTo=${encodeURIComponent(pathname ?? "/")}`}
            onClick={() => setOpen(false)}
            className="inline-flex items-center justify-center h-11 px-6 rounded-full text-sm font-medium bg-[var(--fg)] text-[var(--bg)] hover:opacity-90"
          >
            Sign in
          </Link>
        </DialogActions>
      ) : phase === "done" ? (
        <div className="mt-6">
          <div className="flex items-center gap-3 rounded-[14px] border border-[var(--elite-line)] bg-[var(--elite-wash)] p-4">
            <PartyPopper className="w-5 h-5 text-[var(--elite-ink)] shrink-0" />
            <TooltipPrimitive.Provider>
              <BadgePill id="ELITE_AUTHOR" />
            </TooltipPrimitive.Provider>
            <span className="text-sm">{BADGES.ELITE_AUTHOR.howEarned}</span>
          </div>
          <DialogActions>
            <Button variant="secondary" size="lg" onClick={() => setOpen(false)}>
              Keep reading
            </Button>
            <Link
              href="/profile#capabilities"
              onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center h-11 px-6 rounded-full text-sm font-medium bg-[var(--fg)] text-[var(--bg)] hover:opacity-90"
            >
              See what&apos;s unlocked
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
          <p className="flex items-center gap-2 rounded-[12px] border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2.5 text-xs text-[var(--fg-muted)]">
            <Lock className="w-3.5 h-3.5 shrink-0" /> Test checkout — no card is charged. The test card is prefilled.
          </p>
          <label className="mt-4 block text-sm font-medium">
            Name on card
            <input className={input} value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} placeholder="Your name" autoComplete="cc-name" />
          </label>
          <label className="mt-3 block text-sm font-medium">
            Card number
            <span className="relative block">
              <input className={cn(input, "pr-10")} value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} inputMode="numeric" />
              <CreditCard className="absolute right-3 top-1/2 mt-[3px] -translate-y-1/2 w-4 h-4 text-[var(--fg-subtle)]" />
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
            <Button type="button" variant="secondary" size="lg" onClick={close} disabled={phase === "processing"}>
              Not now
            </Button>
            <Button type="submit" size="lg" disabled={phase === "processing"}>
              {phase === "processing" && <Loader2 className="w-4 h-4 animate-spin" />}
              Pay ${ELITE_PRICE_USD}.00
            </Button>
          </DialogActions>
        </form>
      )}
    </StudioDialog>
  )
}
