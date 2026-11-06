import type { Metadata } from "next"
import type { Plan } from "@/lib/store"
import { SignupForm } from "./SignupForm"

export const metadata: Metadata = {
  title: "Create your account",
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function SignupPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const writer = sp.writer === "true" || sp.writer === "1"
  const plan: Plan | null = sp.plan === "reader" || sp.plan === "patron" ? sp.plan : null
  return <SignupForm initialWriter={writer} initialPlan={plan} />
}
