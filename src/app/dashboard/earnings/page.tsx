"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { ArrowUpRight, Banknote, CalendarClock, CircleCheck, Coffee, Download, Info, Landmark, Loader2, Wallet } from "lucide-react"
import { useUIStore, toast } from "@/lib/store"
import { Button } from "@/components/ui/Button"
import { Reveal } from "@/components/motion/Reveal"
import { StudioDialog, DialogActions } from "@/components/studio/StudioDialog"
import { PageHead, SampleBadge, StatTile, money, useWriter } from "@/components/studio/studio-ui"
import { dur, ease } from "@/lib/motion"
import { cn, formatRelativeDate } from "@/lib/utils"

interface Payout {
  id: string
  date: string
  amount: number
  status: "Paid" | "Processing"
  readMinutes: number
  tips: number
}

// Sample history (demo mode has no Stripe account behind it)
const SAMPLE_PAYOUTS: Payout[] = [
  { id: "po_8KQ2", date: "2026-10-28", amount: 384.2, status: "Paid", readMinutes: 42100, tips: 45 },
  { id: "po_7JD9", date: "2026-09-30", amount: 312.5, status: "Paid", readMinutes: 36400, tips: 20 },
  { id: "po_6HX1", date: "2026-08-31", amount: 289.1, status: "Paid", readMinutes: 31800, tips: 35 },
  { id: "po_5GW4", date: "2026-07-31", amount: 241.75, status: "Paid", readMinutes: 27300, tips: 15 },
  { id: "po_4FV7", date: "2026-06-30", amount: 198.4, status: "Paid", readMinutes: 22900, tips: 10 },
  { id: "po_3EU2", date: "2026-05-31", amount: 162.9, status: "Paid", readMinutes: 19100, tips: 5 },
]
const SAMPLE_UNPAID = 124.8
const MIN_PAYOUT = 10

const fmtDate = (iso: string) =>
  new Date(iso + (iso.length === 10 ? "T12:00:00Z" : "")).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })

export default function EarningsPage() {
  const tips = useUIStore((s) => s.tips)
  const { user } = useWriter()
  const [requested, setRequested] = useState<Payout[]>([])
  const [payoutPhase, setPayoutPhase] = useState<null | "confirm" | "processing" | "done">(null)
  const [stripeOpen, setStripeOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const myTips = useMemo(() => tips.filter((t) => t.authorUsername === user.username), [tips, user.username])
  const tipsTotal = myTips.reduce((a, t) => a + t.amount, 0)
  const paidOut = requested.reduce((a, p) => a + p.amount, 0)
  const available = Math.max(0, SAMPLE_UNPAID + tipsTotal - paidOut)
  const payouts = [...requested, ...SAMPLE_PAYOUTS]
  const lifetime = SAMPLE_PAYOUTS.reduce((a, p) => a + p.amount, 0) + SAMPLE_UNPAID + tipsTotal

  const months = [...SAMPLE_PAYOUTS].reverse()
  const maxMonth = Math.max(...months.map((m) => m.amount))

  const exportCsv = () => {
    const rows = [
      ["type", "id", "date", "amount_usd", "status", "read_minutes", "tips_usd"],
      ...payouts.map((p) => ["payout", p.id, p.date, p.amount.toFixed(2), p.status, String(p.readMinutes), p.tips.toFixed(2)]),
      ...myTips.map((t, i) => ["tip", `tip_${i + 1}`, t.at.slice(0, 10), t.amount.toFixed(2), "Received", "", t.amount.toFixed(2)]),
    ]
    const csv = rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `prism-earnings-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast(`Exported ${rows.length - 1} rows to CSV`, { tone: "success" })
  }

  const startPayout = () => {
    setPayoutPhase("processing")
    timer.current = window.setTimeout(() => {
      setRequested((r) => [
        {
          id: "po_" + Math.random().toString(36).slice(2, 6).toUpperCase(),
          date: new Date().toISOString().slice(0, 10),
          amount: Math.round(available * 100) / 100,
          status: "Processing",
          readMinutes: 13200,
          tips: tipsTotal,
        },
        ...r,
      ])
      setPayoutPhase("done")
    }, 1800)
  }

  return (
    <>
      <PageHead
        title="Earnings"
        lede="What your writing earns from member reading time and reader tips, and when it lands in your bank."
        actions={
          <>
            <Button variant="secondary" size="lg" onClick={exportCsv}>
              <Download className="w-4 h-4" /> Export CSV
            </Button>
            <Button variant="outline" size="lg" onClick={() => setStripeOpen(true)}>
              <Landmark className="w-4 h-4" /> Payout settings
            </Button>
          </>
        }
      />

      {/* Balance */}
      <section className="mt-10 relative overflow-hidden panel p-6 sm:p-8">
        <div aria-hidden className="absolute inset-x-0 top-0 h-1 spectrum-bg" />
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="meta">Available balance</p>
              <SampleBadge label="Sample + your tips" />
            </div>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.p
                key={available.toFixed(2)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out } }}
                exit={{ opacity: 0, y: -12, transition: { duration: dur.fast, ease: ease.in } }}
                className="display mt-4 text-[3.5rem] sm:text-[4.5rem] tabular-nums"
              >
                {money(available)}
              </motion.p>
            </AnimatePresence>
            <p className="mt-3 text-sm text-[var(--fg-muted)]">
              {available >= MIN_PAYOUT
                ? "Paid automatically every month, or request it now. Bank account •••• 4242."
                : requested.length
                  ? "Payout on its way — it usually arrives in 1–2 business days."
                  : `Payouts unlock at ${money(MIN_PAYOUT)}.`}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="accent" size="lg" onClick={() => setPayoutPhase("confirm")} disabled={available < MIN_PAYOUT}>
              <Banknote className="w-4 h-4" /> Request payout
            </Button>
          </div>
        </div>
      </section>

      <section aria-label="Totals" className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatTile label="Lifetime earnings" icon={Wallet} value={money(lifetime)} sub={<span>Since May 2026</span>} sample />
        <StatTile
          label="Tips received"
          icon={Coffee}
          value={money(tipsTotal)}
          sub={<span>{myTips.length} tip{myTips.length === 1 ? "" : "s"} from readers in this browser</span>}
        />
        <StatTile label="Next payout" icon={CalendarClock} value="Nov 30" sub={<span>Monthly, last business day</span>} />
      </section>

      <div className="mt-6 grid lg:grid-cols-5 gap-6">
        {/* Monthly chart */}
        <Reveal as="section" className="lg:col-span-2 panel p-5 sm:p-7">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="display text-[1.5rem]">Monthly payouts</h2>
            <SampleBadge label="Sample" />
          </div>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">Last six months</p>
          <div
            role="img"
            aria-label={`Monthly payouts: ${months.map((m) => `${fmtDate(m.date).split(",")[0]} ${money(m.amount)}`).join(", ")}`}
            className="mt-8 h-48 flex items-end gap-3"
          >
            {months.map((m, i) => (
              <div key={m.id} className="group flex-1 h-full flex flex-col justify-end items-center gap-2">
                <span className="meta opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">${Math.round(m.amount)}</span>
                <motion.div
                  key={String(mounted)}
                  className="w-full max-w-10 rounded-t-[4px] bg-[var(--accent)] group-hover:bg-[var(--accent-hover)] origin-bottom transition-colors"
                  style={{ height: `${(m.amount / maxMonth) * 78}%` }}
                  initial={mounted ? { scaleY: 0 } : false}
                  whileInView={{ scaleY: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: dur.slow, ease: ease.out, delay: i * 0.05 }}
                />
                <span className="meta">{new Date(m.date + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })}</span>
              </div>
            ))}
          </div>
        </Reveal>

        {/* History */}
        <Reveal as="section" index={1} className="lg:col-span-3 panel overflow-hidden">
          <div className="p-5 sm:p-7 pb-4 sm:pb-4 flex items-baseline justify-between">
            <h2 className="display text-[1.5rem]">Payout history</h2>
            <span className="meta">{payouts.length} payouts</span>
          </div>
          <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
            <AnimatePresence initial={false}>
              {payouts.map((p) => (
                <motion.li
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out } }}
                  className="px-5 sm:px-7 py-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold tabular-nums">{money(p.amount)}</span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-xs font-medium",
                          p.status === "Paid" ? "bg-[var(--accent-subtle)] text-[var(--accent)]" : "bg-[var(--warning-subtle)] text-[var(--warning)]"
                        )}
                      >
                        {p.status === "Paid" ? <CircleCheck className="w-3 h-3" /> : <Loader2 className="w-3 h-3 animate-spin" />}
                        {p.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--fg-muted)]">
                      {fmtDate(p.date)} · {p.readMinutes.toLocaleString("en-US")} member read minutes · {money(p.tips)} tips
                    </p>
                  </div>
                  <span className="meta shrink-0">{p.id}</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </Reveal>
      </div>

      {/* Tips */}
      <Reveal as="section" className="mt-6 panel p-5 sm:p-7">
        <h2 className="display text-[1.5rem]">Tips from readers</h2>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">Tips sent from story pages in this browser land here instantly.</p>
        {myTips.length === 0 ? (
          <div className="mt-6 flex items-center gap-3 p-4 rounded-[14px] bg-[var(--bg)] border border-dashed border-[var(--border-strong)] text-sm text-[var(--fg-muted)]">
            <Coffee className="w-4 h-4 shrink-0" />
            No tips yet. Open one of your stories and use the tip button to try it.
          </div>
        ) : (
          <ul className="mt-6 divide-y divide-[var(--border)]">
            {[...myTips].reverse().map((t, i) => (
              <li key={t.at + i} className="py-3 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4 text-[var(--accent)]" /> Tip from a reader
                </span>
                <span className="flex items-center gap-4">
                  <span className="meta">{formatRelativeDate(t.at)}</span>
                  <span className="font-semibold tabular-nums">{money(t.amount)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Reveal>

      {/* Payout dialog */}
      <StudioDialog
        open={payoutPhase !== null}
        onOpenChange={(o) => !o && setPayoutPhase(null)}
        dismissable={payoutPhase !== "processing"}
        title={payoutPhase === "done" ? "Payout on its way" : payoutPhase === "processing" ? "Sending payout…" : "Request a payout"}
        description={
          payoutPhase === "done"
            ? "Simulated in demo mode — in production this would arrive in 1–2 business days."
            : payoutPhase === "processing"
              ? "Talking to the bank. This takes a moment."
              : "Your whole available balance is sent to your connected bank account."
        }
      >
        <AnimatePresence mode="wait" initial={false}>
          {payoutPhase === "confirm" && (
            <motion.div key="confirm" exit={{ opacity: 0, transition: { duration: dur.fast } }}>
              <dl className="mt-6 divide-y divide-[var(--border)] rounded-[14px] border border-[var(--border)] text-sm">
                <div className="flex justify-between px-4 py-3">
                  <dt className="text-[var(--fg-muted)]">Amount</dt>
                  <dd className="font-semibold tabular-nums">{money(available)}</dd>
                </div>
                <div className="flex justify-between px-4 py-3">
                  <dt className="text-[var(--fg-muted)]">To</dt>
                  <dd className="font-medium">Bank account •••• 4242</dd>
                </div>
                <div className="flex justify-between px-4 py-3">
                  <dt className="text-[var(--fg-muted)]">Fee</dt>
                  <dd className="font-medium">None</dd>
                </div>
              </dl>
              <DialogActions>
                <Button variant="secondary" size="lg" onClick={() => setPayoutPhase(null)}>Cancel</Button>
                <Button variant="accent" size="lg" onClick={startPayout}>
                  <Banknote className="w-4 h-4" /> Send {money(available)}
                </Button>
              </DialogActions>
            </motion.div>
          )}
          {payoutPhase === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: dur.base } }}
              exit={{ opacity: 0, transition: { duration: dur.fast } }}
              className="mt-8 mb-2 flex flex-col items-center gap-4"
              role="status"
            >
              <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
              <div className="w-full h-1.5 rounded-full bg-[var(--surface)] overflow-hidden">
                <motion.div
                  className="h-full w-full bg-[var(--accent)] origin-left rounded-full"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 1.7, ease: ease.out }}
                />
              </div>
            </motion.div>
          )}
          {payoutPhase === "done" && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1, transition: { duration: dur.base, ease: ease.out } }}>
              <div className="mt-6 flex items-center gap-3 p-4 rounded-[14px] bg-[var(--accent-subtle)]">
                <motion.span
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1, transition: { type: "spring", stiffness: 420, damping: 22 } }}
                  className="grid place-items-center w-10 h-10 shrink-0 rounded-full bg-[var(--accent)] text-[var(--on-accent)]"
                >
                  <CircleCheck className="w-5 h-5" />
                </motion.span>
                <p className="text-sm">
                  <span className="font-semibold tabular-nums">{money(requested[0]?.amount ?? 0)}</span> is heading to •••• 4242.
                </p>
              </div>
              <DialogActions>
                <Button variant="primary" size="lg" onClick={() => setPayoutPhase(null)}>Done</Button>
              </DialogActions>
            </motion.div>
          )}
        </AnimatePresence>
      </StudioDialog>

      {/* Stripe explanation */}
      <StudioDialog
        open={stripeOpen}
        onOpenChange={setStripeOpen}
        title="Payouts run on Stripe"
        description="Writers connect a Stripe Express account to receive member revenue and tips directly to their bank."
      >
        <div className="mt-6 flex gap-3 p-4 rounded-[14px] bg-[var(--warning-subtle)] text-[var(--warning)] text-sm">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            This Prism instance is running in <span className="font-semibold">demo mode</span> without Stripe keys, so
            there&apos;s no account to connect. Balances and payouts here are simulated.
          </p>
        </div>
        <ul className="mt-5 space-y-2 text-sm text-[var(--fg-secondary)]">
          <li className="flex gap-2"><CircleCheck className="w-4 h-4 mt-0.5 shrink-0 text-[var(--accent)]" /> Monthly automatic payouts, no minimum after $10</li>
          <li className="flex gap-2"><CircleCheck className="w-4 h-4 mt-0.5 shrink-0 text-[var(--accent)]" /> Tax forms generated by Stripe each year</li>
          <li className="flex gap-2"><CircleCheck className="w-4 h-4 mt-0.5 shrink-0 text-[var(--accent)]" /> Bank details never touch Prism&apos;s servers</li>
        </ul>
        <DialogActions>
          <Button variant="primary" size="lg" onClick={() => setStripeOpen(false)}>Got it</Button>
        </DialogActions>
      </StudioDialog>
    </>
  )
}
