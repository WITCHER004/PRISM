import { NextResponse } from "next/server"
import { databaseConfigured } from "@/lib/server/api"
import { settlePayout } from "@/lib/server/monetization"
import {
  activateSubscription,
  deactivateSubscription,
  forgetEvent,
  markEventProcessed,
  paymentProvider,
  verifyWebhookSignature,
} from "@/lib/server/subscriptions"

// POST /api/elite/webhook — payment provider events.
// Normalized events handled:
//   subscription.activated  { userId, reference }   (Stripe checkout.session.completed with payment_status "paid",
//                                                     or checkout.session.async_payment_succeeded / Razorpay subscription.activated)
//   subscription.cancelled  { userId }              (customer.subscription.deleted / subscription.cancelled)
//   payout.paid | payout.failed { payoutId, reference }
// Stripe and Razorpay payloads are mapped onto these below. Mock events must be signed with
// x-prism-signature = hex(hmac_sha256(ELITE_WEBHOOK_SECRET, rawBody)) (see verifyWebhookSignature).

type Normalized =
  | { type: "subscription.activated"; userId: string; reference: string }
  | { type: "subscription.cancelled"; userId: string }
  | { type: "payout.paid" | "payout.failed"; payoutId: string; reference?: string }
  | null

function normalize(body: Record<string, any>): Normalized {
  const type: string = body.type ?? body.event ?? ""
  // Stripe
  if (type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded") {
    const s = body.data?.object ?? {}
    // A completed session can still be unpaid (delayed payment methods); those activate on async_payment_succeeded
    if (s.payment_status !== "paid") return null
    return typeof s.client_reference_id === "string" && typeof s.id === "string"
      ? { type: "subscription.activated", userId: s.client_reference_id, reference: s.id }
      : null
  }
  if (type === "customer.subscription.deleted") {
    const userId = body.data?.object?.metadata?.userId
    return userId ? { type: "subscription.cancelled", userId } : null
  }
  // Razorpay
  if (type === "subscription.activated" && body.payload?.subscription) {
    const s = body.payload.subscription.entity ?? {}
    return s.notes?.userId ? { type: "subscription.activated", userId: s.notes.userId, reference: s.id } : null
  }
  if (type === "subscription.cancelled" && body.payload?.subscription) {
    const userId = body.payload.subscription.entity?.notes?.userId
    return userId ? { type: "subscription.cancelled", userId } : null
  }
  // Already-normalized (mock / internal)
  if (type === "subscription.activated" && body.userId && body.reference) return { type, userId: body.userId, reference: body.reference }
  if (type === "subscription.cancelled" && body.userId) return { type, userId: body.userId }
  if ((type === "payout.paid" || type === "payout.failed") && body.payoutId) return { type, payoutId: body.payoutId, reference: body.reference }
  return null
}

export async function POST(request: Request) {
  if (!databaseConfigured()) return NextResponse.json({ error: "No database configured." }, { status: 503 })
  const raw = await request.text()
  const provider = paymentProvider()
  if (provider === "mock" && process.env.NODE_ENV === "production" && !process.env.ELITE_ALLOW_MOCK_WEBHOOK)
    return NextResponse.json({ error: "Mock webhooks are disabled in production." }, { status: 403 })
  if (!verifyWebhookSignature(provider, raw, request.headers)) return NextResponse.json({ error: "Bad signature." }, { status: 400 })

  let body: Record<string, any>
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 })
  }
  const event = normalize(body)
  if (!event) return NextResponse.json({ received: true, ignored: true })

  // Idempotency by provider event id: a retried or replayed delivery is acknowledged without re-running
  const rawId = provider === "razorpay" ? request.headers.get("x-razorpay-event-id") : body.id
  const eventId = typeof rawId === "string" && rawId ? `${provider}:${rawId.slice(0, 200)}` : null
  if (eventId && !markEventProcessed(eventId)) return NextResponse.json({ received: true, duplicate: true })

  try {
    switch (event.type) {
      case "subscription.activated":
        await activateSubscription(event.userId, provider, event.reference)
        break
      case "subscription.cancelled":
        await deactivateSubscription(event.userId)
        break
      case "payout.paid":
      case "payout.failed":
        await settlePayout(event.payoutId, event.type === "payout.paid" ? "PAID" : "FAILED", event.reference)
        break
    }
  } catch (err) {
    if (eventId) forgetEvent(eventId)
    throw err
  }
  return NextResponse.json({ received: true })
}
