"use server"

import { z } from "zod"
import { db } from "@/lib/db"
import { checkKeyLimit } from "@/lib/server/rateLimit"
import { SITE_URL } from "@/lib/seo"
import { ActionError, requireUser } from "@/lib/session"
import { stripe, stripeConfigured } from "@/lib/stripe"

// Redirect targets come from the configured site URL, never from the request's Origin header
const origin = SITE_URL.origin

// authorName / authorUsername are accepted for compatibility but ignored: the author's name and handle
// always come from the database row for authorId (audit F-22).
const TipInput = z.object({
  authorId: z.string().min(1).max(128),
  authorName: z.string().max(200).optional(),
  authorUsername: z.string().max(200).optional(),
  amountDollars: z.number().finite().min(1).max(500),
  message: z.string().max(2000).optional(),
})

/** Plain single-line text, control characters removed, at most `max` characters */
const cleanText = (v: string | undefined, max: number) =>
  (v ?? "")
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)

const failed = (err: unknown) => {
  if (err instanceof ActionError) return { success: false as const, error: err.message }
  console.error("[payments]", err)
  return { success: false as const, error: "Payment couldn't be started. Try again." }
}

export async function createTipSession(data: {
  authorId: string
  authorName?: string
  authorUsername?: string
  amountDollars: number
  message?: string
}) {
  const parsed = TipInput.safeParse(data)
  if (!parsed.success) return { success: false as const, error: "Choose a tip between $1 and $500." }
  const input = parsed.data
  try {
    const user = await requireUser()
    // 5 checkout sessions per user per 10 minutes (per instance)
    if (!checkKeyLimit(`action|tip|${user.id}`, 5, 10 * 60_000).ok)
      return { success: false as const, error: "Too many tip attempts. Try again in a few minutes." }

    const author = await db.user.findUnique({ where: { id: input.authorId }, select: { id: true, username: true, displayName: true } })
    if (!author) return { success: false as const, error: "That writer couldn't be found." }
    if (author.id === user.id) return { success: false as const, error: "You can't tip yourself." }
    const authorName = cleanText(author.displayName || author.username, 80) || "a Prism writer"
    const message = cleanText(input.message, 300)
    const profileUrl = `${origin}/${encodeURIComponent(author.username)}`

    if (!stripeConfigured()) {
      // Simulated tips are a local-development convenience only
      if (process.env.NODE_ENV === "production") {
        console.error("[payments] tip refused: STRIPE_SECRET_KEY is not configured in production")
        return { success: false as const, error: "Tips are unavailable right now. Try again later." }
      }
      return { success: true as const, url: `${profileUrl}?tipped=${input.amountDollars}`, isSimulated: true }
    }

    const session = await stripe().checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Tip for ${authorName}`,
              description: "Thank you for supporting independent writing!",
            },
            unit_amount: Math.round(input.amountDollars * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      client_reference_id: user.id,
      // The supporter's note travels as metadata (Stripe caps values at 500 chars), not as product text
      metadata: { authorId: author.id, tipperId: user.id, ...(message ? { message } : {}) },
      success_url: `${profileUrl}?tipped=${input.amountDollars}`,
      cancel_url: profileUrl,
    })

    return { success: true as const, url: session.url }
  } catch (error) {
    return failed(error)
  }
}
