import type { Metadata } from "next"
import type { Plan } from "@/lib/store"
import { MembershipClient } from "./MembershipClient"

export const metadata: Metadata = {
  title: "Membership",
  description: "Fund the writers you actually read. Free, Reader and Patron plans.",
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function MembershipPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const plan: Plan | null = sp.plan === "reader" || sp.plan === "patron" ? sp.plan : null
  return <MembershipClient requestedPlan={plan} />
}
