"use server"

import { z } from "zod"
import { stripe } from "@/lib/stripe"
import { SITE_URL } from "@/lib/seo"

// Redirect targets come from the configured site URL, never from the request's Origin header
const origin = SITE_URL.origin

const TipInput = z.object({
  authorId: z.string().min(1).max(128),
  authorName: z.string().trim().min(1).max(100),
  authorUsername: z.string().regex(/^[a-z0-9_]{1,40}$/),
  amountDollars: z.number().finite().min(1).max(500),
  message: z.string().trim().max(300).optional(),
})

const failed = (err: unknown) => {
  console.error("[payments]", err)
  return { success: false as const, error: "Payment couldn't be started. Try again." }
}

export async function createTipSession(data: {
  authorId: string
  authorName: string
  authorUsername: string
  amountDollars: number
  message?: string
}) {
  const parsed = TipInput.safeParse(data)
  if (!parsed.success) return { success: false as const, error: "Choose a tip between $1 and $500." }
  data = parsed.data
  try {
    // If Stripe key is demo/placeholder, return a simulated success URL
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes("placeholder")) {
      return {
        success: true,
        url: `${origin}/${data.authorUsername}?tipped=${data.amountDollars}`,
        isSimulated: true,
      }
    }

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Tip for ${data.authorName}`,
              description: data.message || "Thank you for supporting independent writing!",
            },
            unit_amount: Math.round(data.amountDollars * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/${data.authorUsername}?tipped=${data.amountDollars}`,
      cancel_url: `${origin}/${data.authorUsername}`,
    })

    return { success: true, url: session.url }
  } catch (error) {
    return failed(error)
  }
}

export async function createSubscriptionCheckout(plan: "reader" | "patron" = "reader") {
  if (plan !== "reader" && plan !== "patron") return { success: false as const, error: "Unknown plan." }
  try {
    const priceAmount = plan === "reader" ? 800 : 2000

    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes("placeholder")) {
      return {
        success: true,
        url: `${origin}/dashboard?membership=active`,
        isSimulated: true,
      }
    }

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: plan === "reader" ? "Prism Reader Pass ($8/mo)" : "Prism Patron ($20/mo)",
              description: "Unlimited reading with 70% direct read-time payout distribution to writers.",
            },
            unit_amount: priceAmount,
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/dashboard?subscription=success`,
      cancel_url: `${origin}/membership`,
    })

    return { success: true, url: session.url }
  } catch (error) {
    return failed(error)
  }
}
