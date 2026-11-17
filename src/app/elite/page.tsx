import type { Metadata } from "next"
import { pageMetadata } from "@/lib/seo"
import { EliteClient } from "./EliteClient"

export const metadata: Metadata = pageMetadata({
  title: "Elite for writers: paid views and peer review",
  description: "Prism Elite: earn per view, get reviewed by a 10-member peer panel, and display profile badges. Checkout is simulated in demo mode.",
  path: "/elite",
  socialTitle: "Prism Elite for writers",
})

export default function ElitePage() {
  return <EliteClient />
}
