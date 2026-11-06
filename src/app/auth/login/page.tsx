import type { Metadata } from "next"
import { LoginForm } from "./LoginForm"

export const metadata: Metadata = {
  title: "Sign in",
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const redirectTo = typeof sp.redirectTo === "string" ? sp.redirectTo : undefined
  return <LoginForm redirectTo={redirectTo} />
}
