"use server"

import { stripe } from "@/lib/stripe"
import { headers } from "next/headers"

export async function createTipSession(data: {
  authorId: string
  authorName: string
  authorUsername: string
  amountDollars: number
  message?: string
}) {
  try {
    const origin = (await headers()).get("origin") || "http://localhost:3000"

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
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function createSubscriptionCheckout(plan: "reader" | "patron" = "reader") {
  try {
    const origin = (await headers()).get("origin") || "http://localhost:3000"
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
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
