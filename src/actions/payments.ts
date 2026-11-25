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
