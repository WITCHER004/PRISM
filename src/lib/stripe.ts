import "server-only"
import Stripe from "stripe"

/** True when a real Stripe secret key is configured (not empty, not a placeholder) */
export function stripeConfigured() {
  const key = process.env.STRIPE_SECRET_KEY
  return Boolean(key && !key.includes("placeholder"))
}

let client: Stripe | null = null

/**
 * The Stripe client, created on first use. Throws when STRIPE_SECRET_KEY is missing or a placeholder,
 * rather than silently talking to Stripe with a fake key.
 */
export function stripe(): Stripe {
  if (client) return client
  if (!stripeConfigured()) throw new Error("STRIPE_SECRET_KEY is not configured. Add it to the server environment to use Stripe.")
  client = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2024-11-20.acacia" as any,
    typescript: true,
  })
  return client
}
