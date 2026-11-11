"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Banknote, CircleCheck, Clock, Download, Eye, FlaskConical, Loader2, TrendingUp, Wallet } from "lucide-react"
import { useUIStore, toast } from "@/lib/store"
import { MOCK_POSTS } from "@/lib/data"
import { Button } from "@/components/ui/Button"
import { StudioDialog, DialogActions } from "@/components/studio/StudioDialog"
import { PageHead, StatTile, money, samplePostsFor, useWriter } from "@/components/studio/studio-ui"
import { EliteGate } from "@/components/elite/EliteGate"
import { UserBadges } from "@/components/elite/EliteBadges"
import { useWallet } from "@/components/elite/hooks"
import { DEMO_PAYOUT_SETTLE_MS, MIN_PAYOUT_USD, PAYOUT_RPM_USD, TOP_MONETIZED_VIEWS } from "@/lib/elite/config"
import { earningsByDay, earningsByPost } from "@/lib/elite/wallet"
import { DEV_TOOLS } from "@/lib/devtools"
import { cn, formatRelativeDate, numberWithCommas } from "@/lib/utils"

export default function EarningsPage() {
  return (
    <EliteGate
      feature="Earn from every unique reader"
      description={`Elite writers earn $${PAYOUT_RPM_USD.toFixed(2)} per 1,000 unique views of their published articles, with a per-article breakdown and payouts on request.`}
    >
      <EarningsDashboard />
    </EliteGate>
  )
}

const fmtShort = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })

function EarningsDashboard() {
  const { user } = useWriter()
  const me = user.username
  const views = useUIStore((s) => s.views)
  const payouts = useUIStore((s) => s.payouts)
  const drafts = useUIStore((s) => s.drafts)
  const requestPayout = useUIStore((s) => s.requestPayout)
  const settlePayouts = useUIStore((s) => s.settlePayouts)
  const devSimulateViews = useUIStore((s) => s.devSimulateViews)
  const wallet = useWallet(me)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  // Demo: requested payouts settle after a minute
  useEffect(() => {
    settlePayouts()
    const t = window.setInterval(settlePayouts, 5000)
    return () => window.clearInterval(t)
  }, [settlePayouts])

  const titles = useMemo(() => {
    const m = new Map<string, { title: string; href: string }>()
    for (const p of MOCK_POSTS) m.set(p.id, { title: p.title, href: `/${p.author.username}/${p.slug}` })
    for (const d of Object.values(drafts)) if (d.live) m.set(d.id, { title: d.live.title || "Untitled story", href: `/story/${d.id}` })
    return m
  }, [drafts])

  // Articles a dev simulation can send readers to: live stories by this writer plus their sample posts
  const myArticleIds = useMemo(
    () => [
      ...Object.values(drafts).filter((d) => d.authorUsername === me && d.live).map((d) => d.id),
      ...samplePostsFor(me).map((p) => p.id),
    ],
    [drafts, me]
  )

  const rows = useMemo(() => earningsByPost(me, views), [me, views])
  const days = useMemo(() => earningsByDay(me, views, 30), [me, views])
  const maxDay = Math.max(0.0001, ...days.map((d) => d.earnings))
  const myPayouts = payouts.filter((p) => p.username === me)
  const canWithdraw = wallet.availableBalance >= MIN_PAYOUT_USD

  const simulate = (n: number) => {
    const monetized = devSimulateViews(me, myArticleIds, n)
    toast(`Simulated ${n} unique readers · ${monetized} monetized`, { tone: "success" })
  }

  const exportCsv = () => {
    const lines = [
      ["article", "views", "monetized_views", "earnings_usd"],
      ...rows.map((r) => [titles.get(r.postId)?.title ?? r.postId, String(r.views), String(r.monetizedViews), r.earnings.toFixed(4)]),
    ]
    const csv = lines.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `prism-earnings-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <>
      <PageHead
        title="Earnings"
        lede={
          <>
            You earn <b className="text-[var(--fg)]">${PAYOUT_RPM_USD.toFixed(2)} per 1,000 unique views</b> of your published
            articles. Each reader counts once per article every 24 hours; your own reads don&apos;t count.
          </>
        }
        actions={
          <Button variant="secondary" size="lg" onClick={exportCsv} disabled={!rows.length}>
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        }
      />
      <UserBadges username={me} className="mt-5" />

      {/* Balance */}
      <section className="mt-8 panel p-6 sm:p-8" aria-label="Balance">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <p className="meta">Available balance</p>
            <p className="display mt-3 text-[3.25rem] sm:text-[4rem] tabular-nums leading-none">{money(wallet.availableBalance)}</p>
            <p className="mt-3 text-sm text-[var(--fg-muted)]">
              {wallet.pendingPayout > 0
                ? `${money(wallet.pendingPayout)} on its way to your bank.`
                : canWithdraw
                  ? "Ready to withdraw to your bank account •••• 4242."
                  : `Withdrawals unlock at ${money(MIN_PAYOUT_USD)}.`}
            </p>
          </div>
          <Button
            size="lg"
            className="bg-indigo-600 text-white hover:bg-indigo-700"
            onClick={() => setConfirm(true)}
            disabled={!canWithdraw}
          >
            <Banknote className="w-4 h-4" /> Request Payout
          </Button>
        </div>
      </section>

      <section aria-label="Totals" className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatTile label="Total views" icon={Eye} value={numberWithCommas(wallet.totalViews)} sub={<span>Unique, deduped per 24h</span>} />
        <StatTile
          label="Monetized views"
          icon={TrendingUp}
          value={numberWithCommas(wallet.monetizedViews)}
          sub={
            <span>
              {wallet.monetizedViews >= TOP_MONETIZED_VIEWS
                ? "Top Monetized Writer unlocked"
                : `${numberWithCommas(TOP_MONETIZED_VIEWS - wallet.monetizedViews)} to Top Monetized Writer`}
            </span>
          }
        />
        <StatTile label="Total earnings" icon={Wallet} value={money(wallet.totalEarnings)} sub={<span>Lifetime</span>} />
        <StatTile label="Pending payout" icon={Clock} value={money(wallet.pendingPayout)} sub={<span>Paid out {money(wallet.paidOut)}</span>} />
      </section>

      {DEV_TOOLS && (
        <section className="mt-4 flex flex-wrap items-center gap-2 rounded-[16px] border border-dashed border-slate-300 bg-white px-4 py-3">
          <FlaskConical className="w-4 h-4 text-slate-500" />
          <span className="text-sm text-slate-600 mr-2">Dev: simulate unique readers on your published articles</span>
          {[100, 500, 1000].map((n) => (
            <Button key={n} size="sm" variant="secondary" onClick={() => simulate(n)} disabled={!myArticleIds.length}>
              +{numberWithCommas(n)} views
            </Button>
          ))}
          {!myArticleIds.length && (
            <span className="text-xs text-slate-500">
              Publish an article first (<Link href="/editor/new" className="underline">write one</Link>).
            </span>
          )}
        </section>
      )}

      <div className="mt-6 grid lg:grid-cols-5 gap-6">
        {/* Daily earnings chart */}
        <section className="lg:col-span-3 panel p-5 sm:p-7" aria-labelledby="chart-title">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="chart-title" className="display text-[1.5rem]">
              Daily earnings
            </h2>
            <span className="meta">Last 30 days</span>
          </div>
          <div className="mt-6 flex gap-3">
            <div className="flex flex-col justify-between h-44 text-[11px] text-[var(--fg-muted)] tabular-nums text-right w-12 shrink-0">
              <span>{money(maxDay)}</span>
              <span>$0.00</span>
            </div>
            <div
              role="img"
              aria-label={`Daily earnings over the last 30 days. Highest day ${money(maxDay)}. Total ${money(days.reduce((a, d) => a + d.earnings, 0))}.`}
              className="flex-1 h-44 flex items-end gap-[3px] border-b border-l border-[var(--border)] pl-1"
            >
              {days.map((d) => (
                <div key={d.date} className="group relative flex-1 h-full flex items-end">
                  <div
                    className={cn("w-full rounded-t-[2px] transition-colors", d.earnings > 0 ? "bg-indigo-500 group-hover:bg-indigo-700" : "bg-slate-100")}
                    style={{ height: d.earnings > 0 ? `${Math.max(2, (d.earnings / maxDay) * 100)}%` : "2px" }}
                  />
                  <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] shadow-sm z-10">
                    {fmtShort(d.date)} · {money(d.earnings)} · {d.views} views
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-2 ml-16 flex justify-between text-[11px] text-[var(--fg-muted)]">
            <span>{fmtShort(days[0].date)}</span>
            <span>{fmtShort(days[days.length - 1].date)}</span>
          </div>
        </section>

        {/* Payout history */}
        <section className="lg:col-span-2 panel overflow-hidden" aria-labelledby="payouts-title">
          <div className="p-5 sm:p-7 pb-4 sm:pb-4 flex items-baseline justify-between">
            <h2 id="payouts-title" className="display text-[1.5rem]">
              Payout history
            </h2>
            <span className="meta">{myPayouts.length}</span>
          </div>
          {myPayouts.length === 0 ? (
            <p className="px-5 sm:px-7 pb-7 text-sm text-[var(--fg-muted)]">No payouts yet. Requests appear here with their status.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
              {myPayouts.map((p) => (
                <li key={p.id} className="px-5 sm:px-7 py-3.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium tabular-nums">{money(p.amount)}</p>
                    <p className="text-xs text-[var(--fg-muted)]">
                      {p.id} · {formatRelativeDate(p.paidAt ?? p.requestedAt)}
                    </p>
                  </div>
                  {p.status === "PAID" ? (
                    <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full border border-emerald-200 bg-emerald-50 text-xs font-medium text-emerald-700">
                      <CircleCheck className="w-3 h-3" /> Paid
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full border border-sky-200 bg-sky-50 text-xs font-medium text-sky-700">
                      <Loader2 className="w-3 h-3 animate-spin" /> Processing
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Per-article revenue */}
      <section className="mt-6 panel overflow-hidden" aria-labelledby="articles-title">
        <div className="p-5 sm:p-7 pb-4 sm:pb-4">
          <h2 id="articles-title" className="display text-[1.5rem]">
            Revenue by article
          </h2>
        </div>
        {rows.length === 0 ? (
          <p className="px-5 sm:px-7 pb-7 text-sm text-[var(--fg-muted)]">
            No views yet. Views of your published articles show up here as readers arrive.
          </p>
        ) : (
          <div className="overflow-x-auto border-t border-[var(--border)]">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-[var(--fg-muted)]">
                  <th className="px-5 sm:px-7 py-3 font-medium">Article</th>
                  <th className="px-3 py-3 font-medium text-right">Views</th>
                  <th className="px-3 py-3 font-medium text-right">Monetized</th>
                  <th className="px-5 sm:px-7 py-3 font-medium text-right">Earnings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {rows.map((r) => {
                  const t = titles.get(r.postId)
                  return (
                    <tr key={r.postId}>
                      <td className="px-5 sm:px-7 py-3.5 max-w-[320px]">
                        {t ? (
                          <Link href={t.href} className="font-medium hover:underline line-clamp-1">
                            {t.title}
                          </Link>
                        ) : (
                          <span className="text-[var(--fg-muted)]">{r.postId}</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-right tabular-nums">{numberWithCommas(r.views)}</td>
                      <td className="px-3 py-3.5 text-right tabular-nums">{numberWithCommas(r.monetizedViews)}</td>
                      <td className="px-5 sm:px-7 py-3.5 text-right tabular-nums font-medium">{money(r.earnings)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <StudioDialog
        open={confirm}
        onOpenChange={(o) => !busy && setConfirm(o)}
        title={`Withdraw ${money(Math.floor(wallet.availableBalance * 100) / 100)}?`}
        description={`It's sent to your bank account •••• 4242 and usually arrives in 1–2 business days. (Demo: it shows as paid after ${Math.round(DEMO_PAYOUT_SETTLE_MS / 1000)} seconds.)`}
      >
        <DialogActions>
          <Button variant="secondary" size="lg" onClick={() => setConfirm(false)}>
            Cancel
          </Button>
          <Button
            size="lg"
            className="bg-indigo-600 text-white hover:bg-indigo-700"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              const res = requestPayout()
              setBusy(false)
              setConfirm(false)
              if (!res.ok) return toast(res.error, { tone: "error" })
              toast(`Payout of ${money(res.amount ?? 0)} requested`, { tone: "success" })
            }}
          >
            Request Payout
          </Button>
        </DialogActions>
      </StudioDialog>
    </>
  )
}
