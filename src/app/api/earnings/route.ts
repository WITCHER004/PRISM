import { apiRoute } from "@/lib/server/api"
import { getEarnings } from "@/lib/server/monetization"

// GET /api/earnings — Elite only: wallet, per-article revenue, 30-day series, payout history
export async function GET() {
  return apiRoute((user) => getEarnings(user))
}
