import { PAYOUT_PER_VIEW_USD, VIEW_DEDUPE_WINDOW_MS } from "./config"

// View-based monetization: dedupe, pricing and the writer wallet, as pure functions.

export interface ViewEvent {
  id: string
  postId: string
  /** Username of the article's author */
  author: string
  /** Signed-in reader's username, or an anonymous browser/IP fingerprint */
  viewerKey: string
  at: string
  /** Counted toward earnings (author was Elite at view time, reader wasn't the author) */
  monetized: boolean
  amount: number
}

export type PayoutStatus = "PENDING" | "PAID"

export interface PayoutRecord {
  id: string
  username: string
  amount: number
  status: PayoutStatus
  requestedAt: string
  paidAt?: string
}

export interface Wallet {
  totalViews: number
  monetizedViews: number
  totalEarnings: number
  availableBalance: number
  pendingPayout: number
  paidOut: number
}

/** True when this reader already viewed this article inside the dedupe window */
export function isDuplicateView(
  events: readonly Pick<ViewEvent, "postId" | "viewerKey" | "at">[],
  postId: string,
  viewerKey: string,
  now = Date.now()
) {
  const since = now - VIEW_DEDUPE_WINDOW_MS
  return events.some((e) => e.postId === postId && e.viewerKey === viewerKey && Date.parse(e.at) > since)
}

/** Whether a valid view earns money, and how much */
export function priceView(authorIsElite: boolean, viewerIsAuthor: boolean) {
  const monetized = authorIsElite && !viewerIsAuthor
  return { monetized, amount: monetized ? PAYOUT_PER_VIEW_USD : 0 }
}

export const roundMoney = (n: number) => Math.round(n * 10000) / 10000

export function computeWallet(username: string, events: readonly ViewEvent[], payouts: readonly PayoutRecord[]): Wallet {
  let totalViews = 0
  let monetizedViews = 0
  let totalEarnings = 0
  for (const e of events) {
    if (e.author !== username) continue
    totalViews++
    if (e.monetized) {
      monetizedViews++
      totalEarnings += e.amount
    }
  }
  const mine = payouts.filter((p) => p.username === username)
  const pendingPayout = mine.filter((p) => p.status === "PENDING").reduce((a, p) => a + p.amount, 0)
  const paidOut = mine.filter((p) => p.status === "PAID").reduce((a, p) => a + p.amount, 0)
  return {
    totalViews,
    monetizedViews,
    totalEarnings: roundMoney(totalEarnings),
    availableBalance: Math.max(0, roundMoney(totalEarnings - pendingPayout - paidOut)),
    pendingPayout: roundMoney(pendingPayout),
    paidOut: roundMoney(paidOut),
  }
}

export interface PostEarnings {
  postId: string
  views: number
  monetizedViews: number
  earnings: number
}

export function earningsByPost(username: string, events: readonly ViewEvent[]): PostEarnings[] {
  const by = new Map<string, PostEarnings>()
  for (const e of events) {
    if (e.author !== username) continue
    const row = by.get(e.postId) ?? { postId: e.postId, views: 0, monetizedViews: 0, earnings: 0 }
    row.views++
    if (e.monetized) {
      row.monetizedViews++
      row.earnings = roundMoney(row.earnings + e.amount)
    }
    by.set(e.postId, row)
  }
  return [...by.values()].sort((a, b) => b.earnings - a.earnings || b.views - a.views)
}

/** Earnings per UTC day for the last `days` days, oldest first */
export function earningsByDay(username: string, events: readonly ViewEvent[], days = 30, now = Date.now()) {
  const dayMs = 24 * 60 * 60 * 1000
  const start = Math.floor(now / dayMs) - (days - 1)
  const rows = Array.from({ length: days }, (_, i) => ({
    date: new Date((start + i) * dayMs).toISOString().slice(0, 10),
    earnings: 0,
    views: 0,
  }))
  for (const e of events) {
    if (e.author !== username) continue
    const idx = Math.floor(Date.parse(e.at) / dayMs) - start
    if (idx < 0 || idx >= days) continue
    rows[idx].views++
    if (e.monetized) rows[idx].earnings = roundMoney(rows[idx].earnings + e.amount)
  }
  return rows
}
