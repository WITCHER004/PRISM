import type { Metadata } from "next"
import type { Plan } from "@/lib/store"
import { pageMetadata } from "@/lib/seo"
import { MembershipClient } from "./MembershipClient"

export const metadata: Metadata = pageMetadata({
  title: "Membership plans for readers",
  description: "Explore Prism's demo membership plans for readers who want to support independent writers. Checkout is simulated and no payment is taken.",
  path: "/membership",
  socialTitle: "Prism membership",
})

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function MembershipPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const plan: Plan | null = sp.plan === "reader" || sp.plan === "patron" ? sp.plan : null
  return <MembershipClient requestedPlan={plan} />
}
