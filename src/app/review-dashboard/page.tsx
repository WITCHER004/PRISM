import type { Metadata } from "next"
import { ReviewDashboard } from "./ReviewDashboard"

export const metadata: Metadata = {
  title: "Review queue",
  robots: { index: false, follow: false },
}

export default function ReviewDashboardPage() {
  return <ReviewDashboard />
}
