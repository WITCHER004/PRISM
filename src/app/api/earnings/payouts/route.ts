import { apiRoute } from "@/lib/server/api"
import { requestPayout } from "@/lib/server/monetization"

// POST /api/earnings/payouts — Elite only: withdraw the available balance
export async function POST() {
  return apiRoute((user) => requestPayout(user))
}
