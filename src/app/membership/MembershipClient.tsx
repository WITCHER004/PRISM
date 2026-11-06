"use client"

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import { ArrowRight, Check, ChevronDown, CreditCard, FlaskConical, Loader2, Lock, Sparkles } from "lucide-react"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { Reveal } from "@/components/motion/Reveal"
import { useUIStore, type Plan } from "@/lib/store"
import { dur, ease, spring } from "@/lib/motion"
import { hueStyle } from "@/lib/topics"
import { cn } from "@/lib/utils"
import { Dialog } from "./_components/Dialog"

type TierId = Plan | "free"

interface Tier {
  id: TierId
  name: string
  price: number
  blurb: string
  features: string[]
  hue: string
}

const TIERS: Tier[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    blurb: "Everything that's free on Prism, for as long as you like.",
    features: ["Every free story, no limits", "A few member stories each month", "Follow, clap, respond and bookmark", "Publish your own writing"],
    hue: "science",
  },
  {
    id: "reader",
    name: "Reader",
    price: 8,
    blurb: "Unlimited reading. Your fee follows your attention.",
    features: [
      "Every member story, unlimited",
      "Your fee is split between the writers you read",
      "Listen mode on every story",
      "No ads, no tracking pixels",
    ],
    hue: "ai-ml",
  },
  {
    id: "patron",
    name: "Patron",
    price: 20,
    blurb: "For readers who want to fund independent writing seriously.",
    features: [
      "Everything in Reader",
      "A larger pool for the writers you read",
      "Patron mark on your responses",
      "Early access to new reading tools",
    ],
    hue: "design",
  },
]

const RANK: Record<TierId, number> = { free: 0, reader: 1, patron: 2 }
const tierOf = (id: TierId) => TIERS.find((t) => t.id === id)!

const FAQ = [
  {
    q: "Where does my membership money go?",
    a: "Most of your fee goes into a pool that's divided between the writers you actually read, weighted by active reading time. If you spend most of a month with two writers, they receive most of your share. The rest keeps Prism running.",
  },
  {
    q: "What counts as reading time?",
    a: "Time with a story open and in view while you're actively scrolling or listening. Idle tabs, background windows and bounces of a few seconds don't count, so clickbait gains nothing.",
  },
  {
    q: "Can I cancel any time?",
    a: "Yes. Switch back to Free from this page whenever you like. You keep your bookmarks, follows and reading history.",
  },
  {
    q: "Do writers still get tips if I'm a member?",
    a: "Tips are separate from membership and go straight to the writer you tip. Membership spreads support across your reading; tips let you say thank you for one story.",
  },
  {
    q: "Is this demo actually charging me?",
    a: "No. This is a demo build: checkout is simulated, no card details leave your browser, and your plan is saved only in this browser's storage.",
  },
]

function useHydrated() {
  return useSyncExternalStore(
    (cb) => useUIStore.persist.onFinishHydration(cb),
    () => useUIStore.persist.hasHydrated(),
    () => false
  )
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const money = (n: number) => `$${n.toFixed(2)}`

export function MembershipClient({ requestedPlan }: { requestedPlan: Plan | null }) {
  const router = useRouter()
  const hydrated = useHydrated()
  const currentUser = useUIStore((s) => s.currentUser)
  const plan = useUIStore((s) => s.plan)
  const current: TierId = plan ?? "free"

  const [checkout, setCheckout] = useState<Plan | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)

  // Arriving from signup with ?plan=… opens checkout once the session has loaded
  const handled = useRef(false)
  useEffect(() => {
    if (!hydrated || handled.current || !requestedPlan) return
    handled.current = true
    router.replace("/membership", { scroll: false })
    if (currentUser && requestedPlan !== plan) setCheckout(requestedPlan)
  }, [hydrated, requestedPlan, currentUser, plan, router])

  const choose = (id: TierId) => {
    if (id === current) return
    if (id === "free") setCancelOpen(true)
    else setCheckout(id)
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <SiteHeader />
      <main className="flex-1">
        {/* Head */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-10">
          <div className="max-w-3xl">
            <p className="meta">Membership</p>
            <h1 className="display mt-3 text-[2.5rem] sm:text-[3.5rem]">
              Pay writers, <span className="spectrum-text">not algorithms.</span>
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-[var(--fg-muted)] max-w-2xl">
              Reading on Prism is free. A membership unlocks every member story, and your fee is shared out between the
              writers you actually spend time with.
            </p>
          </div>

          <CurrentPlanBar
            hydrated={hydrated}
            signedIn={!!currentUser}
            current={current}
            onCancel={() => setCancelOpen(true)}
          />
        </section>

        {/* Plans */}
        <section aria-labelledby="plans-title" className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
          <h2 id="plans-title" className="sr-only">
            Plans
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {TIERS.map((tier, i) => (
              <Reveal key={tier.id} index={i}>
                <PlanCard
                  tier={tier}
                  isCurrent={!!currentUser && tier.id === current}
                  current={current}
                  signedIn={!!currentUser}
                  onChoose={() => choose(tier.id)}
                />
              </Reveal>
            ))}
          </div>
          <p className="mt-5 flex items-center gap-2 text-xs text-[var(--fg-muted)]">
            <FlaskConical className="w-3.5 h-3.5 text-[var(--accent)]" />
            Demo mode: checkout is simulated and no card is ever charged.
          </p>
        </section>

        {/* How the split works */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
          <Reveal>
            <div className="panel p-6 sm:p-10 grid lg:grid-cols-[1fr_1.1fr] gap-10 items-center">
              <div>
                <p className="meta">How your fee is shared</p>
                <h2 className="display mt-3 text-[2rem] sm:text-[2.5rem]">Your attention decides who gets paid.</h2>
                <p className="mt-4 text-[var(--fg-muted)] leading-relaxed">
                  At the end of each month, your share is divided by how long you actively read each writer. No
                  pageview games, no rewards for outrage. The writers who held your attention are the ones you fund.
                </p>
                <Link
                  href="/about#payouts"
                  className="mt-6 inline-flex items-center gap-1.5 h-10 px-4 -ml-4 rounded-full text-sm font-medium hover:bg-[var(--surface)] transition-colors"
                >
                  Read how payouts work <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <SplitIllustration />
            </div>
          </Reveal>
        </section>

        {/* FAQ */}
        <section aria-labelledby="faq-title" className="max-w-3xl mx-auto px-4 sm:px-6 pb-24">
          <Reveal>
            <p className="meta">Questions</p>
            <h2 id="faq-title" className="display mt-3 text-[2rem] sm:text-[2.5rem]">
              Good to know
            </h2>
          </Reveal>
          <Reveal className="mt-8">
            <Accordion items={FAQ} />
          </Reveal>
        </section>
      </main>
      <SiteFooter />

      <CheckoutDialog plan={checkout} from={current} onClose={() => setCheckout(null)} />
      <CancelDialog open={cancelOpen} current={current} onClose={() => setCancelOpen(false)} />
    </div>
  )
}

/* ── Current plan ─────────────────────────────────────────────────────── */

function CurrentPlanBar({
  hydrated,
  signedIn,
  current,
  onCancel,
}: {
  hydrated: boolean
  signedIn: boolean
  current: TierId
  onCancel: () => void
}) {
  const tier = tierOf(current)
  return (
    <div
      style={hueStyle(tier.hue)}
      className={cn(
        "mt-8 panel px-5 py-4 flex flex-wrap items-center gap-x-4 gap-y-3 transition-opacity duration-300",
        !hydrated && "opacity-60"
      )}
    >
      <span className="w-2.5 h-2.5 rounded-full hue-dot" />
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={signedIn ? current : "out"}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out } }}
          exit={{ opacity: 0, y: -4, transition: { duration: dur.fast, ease: ease.in } }}
          className="flex-1 min-w-[200px] text-sm"
        >
          {!signedIn ? (
            <>
              <span className="font-medium">You&apos;re browsing signed out.</span>{" "}
              <span className="text-[var(--fg-muted)]">Sign in to see or change your plan.</span>
            </>
          ) : current === "free" ? (
            <>
              <span className="font-medium">You&apos;re on Free.</span>{" "}
              <span className="text-[var(--fg-muted)]">Upgrade any time; nothing changes about what you&apos;ve saved.</span>
            </>
          ) : (
            <>
              <span className="font-medium">
                You&apos;re a {tier.name} member · {money(tier.price)}/month
              </span>{" "}
              <span className="text-[var(--fg-muted)]">Thank you for funding independent writing.</span>
            </>
          )}
        </motion.p>
      </AnimatePresence>
      {!signedIn ? (
        <Link
          href="/auth/login?redirectTo=/membership"
          className="h-10 px-5 inline-flex items-center rounded-full bg-[var(--fg)] text-[var(--bg)] text-sm font-medium hover:bg-[var(--fg-secondary)] transition-colors"
        >
          Sign in
        </Link>
      ) : current !== "free" ? (
        <button
          type="button"
          onClick={onCancel}
          className="h-10 px-5 inline-flex items-center rounded-full bg-[var(--panel)] border border-[var(--border-strong)] text-sm font-medium hover:border-[var(--fg)] transition-colors"
        >
          Cancel membership
        </button>
      ) : null}
    </div>
  )
}

function PlanCard({
  tier,
  isCurrent,
  current,
  signedIn,
  onChoose,
}: {
  tier: Tier
  isCurrent: boolean
  current: TierId
  signedIn: boolean
  onChoose: () => void
}) {
  const featured = tier.id === "reader"
  const ctaLabel = !signedIn
    ? tier.id === "free"
      ? "Start free"
      : `Choose ${tier.name}`
    : isCurrent
      ? "Your plan"
      : tier.id === "free"
        ? "Switch to Free"
        : RANK[tier.id] > RANK[current]
          ? `Upgrade to ${tier.name}`
          : `Switch to ${tier.name}`

  const ctaClass = cn(
    "mt-8 h-11 px-6 w-full inline-flex items-center justify-center gap-2 rounded-full font-medium transition-[background-color,border-color,transform] active:scale-[0.98]",
    isCurrent
      ? "bg-[var(--surface)] text-[var(--fg-muted)] cursor-default active:scale-100"
      : featured
        ? "bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--fg-secondary)]"
        : "bg-[var(--panel)] border border-[var(--border-strong)] hover:border-[var(--fg)]"
  )

  return (
    <div
      style={hueStyle(tier.hue)}
      className={cn(
        "relative h-full flex flex-col panel p-6 sm:p-7 transition-[box-shadow,border-color] duration-300",
        featured && "shadow-[var(--shadow-lift)]",
        isCurrent && "border-[var(--fg)]"
      )}
    >
      <div aria-hidden className="absolute inset-x-6 top-0 h-1 rounded-b-full hue-dot" />
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-xl font-semibold tracking-tight">{tier.name}</h3>
        <AnimatePresence initial={false} mode="wait">
          {isCurrent ? (
            <motion.span
              key="current"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1, transition: spring.snappy }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: dur.fast } }}
              className="inline-flex items-center gap-1 h-7 px-3 rounded-full bg-[var(--fg)] text-[var(--bg)] text-xs font-medium"
            >
              <Check className="w-3 h-3" /> Current
            </motion.span>
          ) : featured ? (
            <motion.span
              key="rec"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: dur.fast } }}
              className="inline-flex items-center gap-1 h-7 px-3 rounded-full hue-wash hue-ink text-xs font-medium"
            >
              <Sparkles className="w-3 h-3" /> Recommended
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="mt-5 flex items-baseline gap-1.5">
        <span className="display text-[3rem] tabular-nums">${tier.price}</span>
        <span className="text-sm text-[var(--fg-muted)]">{tier.price ? "/ month" : "forever"}</span>
      </div>
      <p className="mt-2 text-sm text-[var(--fg-muted)] leading-relaxed min-h-[2.75rem]">{tier.blurb}</p>

      <ul className="mt-6 space-y-3 flex-1">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-[var(--fg-secondary)]">
            <span className="mt-0.5 grid place-items-center w-4 h-4 rounded-full hue-wash hue-ink shrink-0">
              <Check className="w-2.5 h-2.5" strokeWidth={3} />
            </span>
            {f}
          </li>
        ))}
      </ul>

      {signedIn ? (
        <button type="button" onClick={onChoose} disabled={isCurrent} aria-disabled={isCurrent} className={ctaClass}>
          {ctaLabel}
          {!isCurrent && <ArrowRight className="w-4 h-4" />}
        </button>
      ) : (
        <Link href={tier.id === "free" ? "/auth/signup" : `/auth/signup?plan=${tier.id}`} className={ctaClass}>
          {ctaLabel} <ArrowRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  )
}

/* ── Illustration ─────────────────────────────────────────────────────── */

const EXAMPLE = [
  { topic: "climate", label: "A climate writer", share: 45 },
  { topic: "programming", label: "A programming writer", share: 30 },
  { topic: "philosophy", label: "A philosophy writer", share: 15 },
  { topic: "design", label: "Two others", share: 10 },
]

function SplitIllustration() {
  return (
    <figure className="rounded-[16px] bg-[var(--bg)] border border-[var(--border)] p-5 sm:p-6">
      <figcaption className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">One reader&apos;s month</span>
        <span className="meta">Illustration, not real data</span>
      </figcaption>
      <div className="mt-5 flex h-3 rounded-full overflow-hidden gap-0.5" aria-hidden>
        {EXAMPLE.map((e) => (
          <span key={e.topic} style={hueStyle(e.topic, { width: `${e.share}%` })} className="hue-dot first:rounded-l-full last:rounded-r-full" />
        ))}
      </div>
      <ul className="mt-5 space-y-2.5">
        {EXAMPLE.map((e) => (
          <li key={e.topic} style={hueStyle(e.topic)} className="flex items-center gap-3 text-sm">
            <span className="w-2.5 h-2.5 rounded-full hue-dot" />
            <span className="flex-1 text-[var(--fg-secondary)]">{e.label}</span>
            <span className="font-mono text-xs tabular-nums text-[var(--fg-muted)]">{e.share}% of reading time</span>
          </li>
        ))}
      </ul>
      <p className="mt-5 pt-4 border-t border-[var(--border)] text-xs text-[var(--fg-muted)] leading-relaxed">
        The writers&apos; pool from this reader&apos;s fee is divided in the same proportions.
      </p>
    </figure>
  )
}

/* ── FAQ ──────────────────────────────────────────────────────────────── */

function Accordion({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0)
  const base = useId()
  return (
    <div className="panel divide-y divide-[var(--border)]">
      {items.map((item, i) => {
        const isOpen = open === i
        const btnId = `${base}-q${i}`
        const panelId = `${base}-a${i}`
        return (
          <div key={item.q}>
            <h3>
              <button
                id={btnId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : i)}
                className="w-full flex items-center justify-between gap-4 px-5 sm:px-6 py-5 text-left font-medium hover:text-[var(--fg)] text-[var(--fg-secondary)] rounded-[var(--radius-card)] focus-visible:outline-offset-[-2px]"
              >
                <span className={cn("transition-colors", isOpen && "text-[var(--fg)]")}>{item.q}</span>
                <span
                  className={cn(
                    "grid place-items-center w-8 h-8 rounded-full shrink-0 transition-[background-color,transform] duration-300 ease-[cubic-bezier(0.2,0.7,0.2,1)]",
                    isOpen ? "bg-[var(--fg)] text-[var(--bg)] rotate-180" : "bg-[var(--surface)] text-[var(--fg-muted)]"
                  )}
                >
                  <ChevronDown className="w-4 h-4" />
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={btnId}
              className={cn(
                "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.2,0.7,0.2,1)]",
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              )}
            >
              <div className="overflow-hidden" inert={!isOpen}>
                <p
                  className={cn(
                    "px-5 sm:px-6 pb-6 pr-16 text-[var(--fg-muted)] leading-relaxed transition-opacity duration-300",
                    isOpen ? "opacity-100" : "opacity-0"
                  )}
                >
                  {item.a}
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Checkout ─────────────────────────────────────────────────────────── */

type Stage = "form" | "processing" | "success"

function CheckoutDialog({ plan, from, onClose }: { plan: Plan | null; from: TierId; onClose: () => void }) {
  // Keep the last plan while the dialog animates out
  const [shown, setShown] = useState<Plan | null>(plan)
  if (plan && plan !== shown) setShown(plan)
  const [stage, setStage] = useState<Stage>("form")
  const titleId = useId()

  const close = () => {
    onClose()
    setTimeout(() => setStage("form"), 250)
  }

  return (
    <Dialog open={!!plan} onClose={close} labelledBy={titleId} dismissible={stage !== "processing"}>
      {shown && (
        <CheckoutBody key={shown} plan={shown} from={from} titleId={titleId} stage={stage} setStage={setStage} onDone={close} />
      )}
    </Dialog>
  )
}

const fmtCard = (v: string) =>
  v
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, "$1 ")
const fmtExp = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 4)
  return d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d
}

function CheckoutBody({
  plan,
  from,
  titleId,
  stage,
  setStage,
  onDone,
}: {
  plan: Plan
  from: TierId
  titleId: string
  stage: Stage
  setStage: (s: Stage) => void
  onDone: () => void
}) {
  const tier = tierOf(plan)
  const setPlan = useUIStore((s) => s.setPlan)
  const toast = useUIStore((s) => s.toast)
  const displayName = useUIStore((s) => s.profile.displayName)

  const [name, setName] = useState(displayName)
  const [card, setCard] = useState("4242 4242 4242 4242")
  const [exp, setExp] = useState("12 / 29")
  const [cvc, setCvc] = useState("123")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const changing = from !== "free"

  const validate = () => {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = "Enter the name on the card."
    if (card.replace(/\D/g, "").length !== 16) e.card = "Card number should be 16 digits."
    const m = exp.match(/^(\d{2}) \/ (\d{2})$/)
    if (!m || +m[1] < 1 || +m[1] > 12) e.exp = "Use MM / YY."
    else {
      const now = new Date()
      const yy = now.getFullYear() % 100
      if (+m[2] < yy || (+m[2] === yy && +m[1] < now.getMonth() + 1)) e.exp = "This card has expired."
    }
    if (!/^\d{3,4}$/.test(cvc)) e.cvc = "3 or 4 digits."
    return e
  }

  const pay = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) return
    setStage("processing")
    await wait(1100)
    setPlan(plan)
    setStage("success")
    toast(changing ? `Switched to ${tier.name}` : `Welcome, ${tier.name} member`, { tone: "success" })
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {stage === "success" ? (
        <motion.div
          key="success"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out } }}
          className="text-center py-4"
          aria-live="polite"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, transition: { ...spring.snappy, delay: 0.05 } }}
            style={hueStyle(tier.hue)}
            className="mx-auto w-16 h-16 rounded-full hue-wash hue-ink grid place-items-center"
          >
            <Check className="w-8 h-8" strokeWidth={2.5} />
          </motion.div>
          <h2 id={titleId} className="display mt-5 text-[2rem]">
            You&apos;re a {tier.name} now.
          </h2>
          <p className="mt-2 text-sm text-[var(--fg-muted)] leading-relaxed max-w-xs mx-auto">
            Every member story is open to you, and this month&apos;s share will follow what you read.
          </p>
          <div className="mt-7 grid sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onDone}
              className="h-11 px-6 rounded-full bg-[var(--panel)] border border-[var(--border-strong)] font-medium hover:border-[var(--fg)] transition-colors"
            >
              Done
            </button>
            <Link
              href="/explore"
              ref={(el) => el?.focus({ preventScroll: true })}
              className="h-11 px-6 rounded-full bg-[var(--fg)] text-[var(--bg)] font-medium hover:bg-[var(--fg-secondary)] transition-colors inline-flex items-center justify-center gap-2"
            >
              Start reading <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>
      ) : (
        <motion.form
          key="form"
          onSubmit={pay}
          noValidate
          exit={{ opacity: 0, y: -6, transition: { duration: dur.fast, ease: ease.in } }}
        >
          <p className="meta">Checkout</p>
          <h2 id={titleId} className="display mt-2 text-[1.75rem] pr-10">
            {changing ? `Switch to ${tier.name}` : `Become a ${tier.name}`}
          </h2>

          <div style={hueStyle(tier.hue)} className="mt-5 rounded-[16px] hue-wash p-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-medium hue-ink">{tier.name} membership</p>
              <p className="text-xs text-[var(--fg-muted)]">Billed monthly · cancel any time</p>
            </div>
            <p className="display text-2xl tabular-nums">
              {money(tier.price)}
              <span className="text-sm font-sans font-normal text-[var(--fg-muted)] tracking-normal"> /mo</span>
            </p>
          </div>

          <fieldset disabled={stage === "processing"} className="mt-5 space-y-3 disabled:opacity-70 transition-opacity">
            <Input label="Name on card" value={name} onChange={setName} error={errors.name} autoComplete="cc-name" autofocus />
            <Input
              label="Card number"
              value={card}
              onChange={(v) => setCard(fmtCard(v))}
              error={errors.card}
              inputMode="numeric"
              autoComplete="cc-number"
              icon={<CreditCard className="w-4 h-4" />}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Expiry" value={exp} onChange={(v) => setExp(fmtExp(v))} error={errors.exp} inputMode="numeric" autoComplete="cc-exp" placeholder="MM / YY" />
              <Input label="CVC" value={cvc} onChange={(v) => setCvc(v.replace(/\D/g, "").slice(0, 4))} error={errors.cvc} inputMode="numeric" autoComplete="cc-csc" />
            </div>
          </fieldset>

          <p className="mt-4 flex items-start gap-2 text-xs text-[var(--fg-muted)] leading-relaxed">
            <FlaskConical className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[var(--accent)]" />
            Demo checkout with a test card. Nothing is charged and no card details leave this page.
          </p>

          <button
            type="submit"
            disabled={stage === "processing"}
            aria-busy={stage === "processing" || undefined}
            className="mt-5 w-full h-11 px-6 rounded-full bg-[var(--accent)] text-[var(--on-accent)] font-medium hover:bg-[var(--accent-hover)] active:scale-[0.98] transition-[background-color,transform] inline-flex items-center justify-center gap-2 disabled:cursor-wait"
          >
            {stage === "processing" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Processing payment…
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" /> Pay {money(tier.price)}
              </>
            )}
          </button>
        </motion.form>
      )}
    </AnimatePresence>
  )
}

function Input({
  label,
  value,
  onChange,
  error,
  icon,
  autofocus,
  ...rest
}: {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  icon?: React.ReactNode
  autofocus?: boolean
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          data-autofocus={autofocus || undefined}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          className={cn(
            "w-full h-11 px-4 rounded-[12px] bg-[var(--panel)] border outline-none transition-colors focus:border-[var(--fg)] tabular-nums",
            icon && "pr-10",
            error ? "border-[var(--error)]" : "border-[var(--border)]"
          )}
          {...rest}
        />
        {icon && <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)] pointer-events-none">{icon}</span>}
      </div>
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-1 text-xs text-[var(--error)]">
          {error}
        </p>
      )}
    </div>
  )
}

/* ── Cancel ───────────────────────────────────────────────────────────── */

function CancelDialog({ open, current, onClose }: { open: boolean; current: TierId; onClose: () => void }) {
  const setPlan = useUIStore((s) => s.setPlan)
  const toast = useUIStore((s) => s.toast)
  const [busy, setBusy] = useState(false)
  const titleId = useId()
  const [shownName, setShownName] = useState(tierOf(current).name)
  if (open && current !== "free" && tierOf(current).name !== shownName) setShownName(tierOf(current).name)

  const confirm = async () => {
    setBusy(true)
    await wait(700)
    setPlan(null)
    setBusy(false)
    onClose()
    toast("Membership cancelled. You're on Free.")
  }

  return (
    <Dialog open={open} onClose={onClose} labelledBy={titleId} dismissible={!busy}>
      <p className="meta">Change plan</p>
      <h2 id={titleId} className="display mt-2 text-[1.75rem] pr-10">
        Cancel your {shownName} membership?
      </h2>
      <p className="mt-3 text-sm text-[var(--fg-muted)] leading-relaxed">
        You&apos;ll go back to Free: free stories stay open, and a few member stories each month. Your bookmarks,
        follows and drafts stay exactly where they are.
      </p>
      <p className="mt-3 text-xs text-[var(--fg-subtle)] leading-relaxed">
        In this demo the change is immediate, and there&apos;s nothing to refund because nothing was charged.
      </p>
      <div className="mt-7 grid sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          data-autofocus
          className="h-11 px-6 rounded-full bg-[var(--fg)] text-[var(--bg)] font-medium hover:bg-[var(--fg-secondary)] transition-colors disabled:opacity-50"
        >
          Keep {shownName}
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={busy}
          className="h-11 px-6 rounded-full bg-[var(--panel)] border border-[var(--border-strong)] font-medium text-[var(--error)] hover:border-[var(--error)] transition-colors inline-flex items-center justify-center gap-2 disabled:cursor-wait"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {busy ? "Cancelling…" : "Cancel membership"}
        </button>
      </div>
    </Dialog>
  )
}
