import type { Metadata } from "next"
import { EliteClient } from "./EliteClient"

export const metadata: Metadata = {
  title: "Elite for writers",
  description: "Prism Elite: earn per view, get reviewed by a 10-member peer panel, and display profile badges. Checkout is simulated in demo mode.",
  alternates: { canonical: "/elite" },
}

export default function ElitePage() {
  return <EliteClient />
}
