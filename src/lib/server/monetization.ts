import { createHash } from "node:crypto"
import { db } from "@/lib/db"
import { MIN_PAYOUT_USD, VIEW_DEDUPE_WINDOW_MS } from "@/lib/elite/config"
import { isEliteActive } from "@/lib/elite/subscription"
import { priceView } from "@/lib/elite/wallet"
import { ActionError, requireElite } from "@/lib/session"
import type { SessionUser } from "./api"
import { awardBadges } from "./badges"

/** Signed-in readers dedupe by user id; signed-out readers by a salted hash of IP + user agent */
export function viewFingerprint(request: Request, user: SessionUser | null) {
  if (user) return `u:${user.id}`
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || request.headers.get("x-real-ip") || "0.0.0.0"
  const ua = request.headers.get("user-agent") ?? ""
  const salt = process.env.VIEW_FINGERPRINT_SALT ?? "prism"
  return "f:" + createHash("sha256").update(`${salt}|${ip}|${ua}`).digest("hex").slice(0, 32)
}

/**
 * Logs a view of a published article once per reader per 24h, and credits the author's
 * wallet when they are on an active Elite plan.
 */
export async function recordArticleView(postId: string, viewer: SessionUser | null, fingerprint: string) {
  const post = await db.post.findUnique({
    where: { id: postId },
    select: { id: true, status: true, authorId: true, author: { select: { tier: true, subscriptionStatus: true, expiresAt: true } } },
  })
  if (!post || post.status !== "PUBLISHED") throw new ActionError("Article not found.", 404)

  const since = new Date(Date.now() - VIEW_DEDUPE_WINDOW_MS)
  const dup = await db.articleView.findFirst({ where: { postId, fingerprint, createdAt: { gt: since } }, select: { id: true } })
  if (dup) return { counted: false, monetized: false }

  const { monetized, amount } = priceView(isEliteActive(post.author), viewer?.id === post.authorId)
  await db.$transaction([
    db.articleView.create({ data: { postId, viewerId: viewer?.id ?? null, fingerprint, monetized, amount } }),
    db.post.update({
      where: { id: postId },
      data: { viewCount: { increment: 1 }, ...(monetized ? { monetizedViewCount: { increment: 1 }, earnings: { increment: amount } } : {}) },
    }),
    db.writerWallet.upsert({
      where: { userId: post.authorId },
      create: {
        userId: post.authorId,
        totalViews: 1,
        monetizedViews: monetized ? 1 : 0,
        totalEarnings: amount,
        availableBalance: amount,
      },
      update: {
        totalViews: { increment: 1 },
        ...(monetized
          ? { monetizedViews: { increment: 1 }, totalEarnings: { increment: amount }, availableBalance: { increment: amount } }
          : {}),
      },
    }),
  ])
  if (monetized) await awardBadges(post.authorId)
  return { counted: true, monetized }
}

const num = (d: { toNumber(): number } | number | null | undefined) => (d == null ? 0 : typeof d === "number" ? d : d.toNumber())

/** Elite earnings dashboard data */
export async function getEarnings(user: SessionUser) {
  requireElite(user)
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const [wallet, posts, recent, payouts] = await Promise.all([
    db.writerWallet.findUnique({ where: { userId: user.id } }),
    db.post.findMany({
      where: { authorId: user.id, status: "PUBLISHED" },
      select: { id: true, title: true, slug: true, viewCount: true, monetizedViewCount: true, earnings: true },
      orderBy: { earnings: "desc" },
    }),
    db.articleView.findMany({
      where: { post: { authorId: user.id }, createdAt: { gte: since } },
      select: { createdAt: true, monetized: true, amount: true },
    }),
    db.payout.findMany({ where: { userId: user.id }, orderBy: { requestedAt: "desc" }, take: 50 }),
  ])
  const daily = new Map<string, { views: number; earnings: number }>()
  for (const v of recent) {
    const k = v.createdAt.toISOString().slice(0, 10)
    const row = daily.get(k) ?? { views: 0, earnings: 0 }
    row.views++
    if (v.monetized) row.earnings += num(v.amount)
    daily.set(k, row)
  }
  return {
    wallet: {
      totalViews: wallet?.totalViews ?? 0,
      monetizedViews: wallet?.monetizedViews ?? 0,
      totalEarnings: num(wallet?.totalEarnings),
      availableBalance: num(wallet?.availableBalance),
      pendingPayout: num(wallet?.pendingPayout),
    },
    articles: posts.map((p) => ({ ...p, earnings: num(p.earnings) })),
    daily: [...daily.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, r]) => ({ date, ...r })),
    payouts: payouts.map((p) => ({ ...p, amount: num(p.amount) })),
  }
}

/** Moves the available balance (rounded down to cents) into a pending payout */
export async function requestPayout(user: SessionUser) {
  requireElite(user)
  return db.$transaction(async (tx) => {
    const wallet = await tx.writerWallet.findUnique({ where: { userId: user.id } })
    const amount = Math.floor(num(wallet?.availableBalance) * 100) / 100
    if (!wallet || amount < MIN_PAYOUT_USD)
      throw new ActionError(`You can withdraw once your balance reaches $${MIN_PAYOUT_USD.toFixed(2)}.`, 422)
    // Guarded decrement so concurrent requests can't overdraw
    const { count } = await tx.writerWallet.updateMany({
      where: { userId: user.id, availableBalance: { gte: amount } },
      data: { availableBalance: { decrement: amount }, pendingPayout: { increment: amount } },
    })
    if (count === 0) throw new ActionError("Your balance changed. Refresh and try again.", 409)
    // Provider transfer (Stripe Connect / RazorpayX) is created here; the webhook marks it PAID
    return tx.payout.create({ data: { userId: user.id, amount, status: "PENDING", provider: process.env.PAYOUT_PROVIDER ?? "mock" } })
  })
}

/** Payout provider webhook: settle a pending payout */
export async function settlePayout(payoutId: string, status: "PAID" | "FAILED", providerRef?: string) {
  return db.$transaction(async (tx) => {
    const payout = await tx.payout.findUnique({ where: { id: payoutId } })
    if (!payout || payout.status !== "PENDING") return null
    await tx.payout.update({ where: { id: payoutId }, data: { status, providerRef, paidAt: status === "PAID" ? new Date() : null } })
    await tx.writerWallet.update({
      where: { userId: payout.userId },
      data:
        status === "PAID"
          ? { pendingPayout: { decrement: payout.amount } }
          : { pendingPayout: { decrement: payout.amount }, availableBalance: { increment: payout.amount } },
    })
    return payout.id
  })
}
