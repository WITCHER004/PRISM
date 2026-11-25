import type { Metadata } from "next"
import { SignupForm } from "@/app/auth/signup/SignupForm"

export const metadata: Metadata = {
  title: "Create your account",
  description: "Join Prism — a calm, independent sanctuary for thoughtful writing and reading.",
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function SignupPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const writer = sp?.writer === "true" || sp?.writer === "1"
  return <SignupForm initialWriter={writer} />
}

