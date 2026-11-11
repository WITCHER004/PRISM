import { NextResponse } from "next/server"
import { ELITE_PRICE_USD } from "@/lib/elite/config"
import { apiRoute, databaseConfigured } from "@/lib/server/api"
import { createCheckout, paymentProvider } from "@/lib/server/subscriptions"

// POST /api/elite/checkout — starts an Elite upgrade.
// mock (default): activates immediately. stripe / razorpay: returns a session for the client,
// and /api/elite/webhook activates on payment.
export async function POST() {
  if (!databaseConfigured()) {
    // Demo mode: hand back a mock session; the browser store activates the subscription
    const reference = `mock_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    return NextResponse.json({ provider: "mock", reference, amount: ELITE_PRICE_USD, currency: "USD", status: "complete", demo: true })
  }
  return apiRoute((user) => createCheckout(user))
}

export async function GET() {
  return NextResponse.json({ provider: paymentProvider(), price: ELITE_PRICE_USD, currency: "USD" })
}
