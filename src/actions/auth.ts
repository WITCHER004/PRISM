"use server"

import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { SITE_URL } from "@/lib/seo"
import { headers } from "next/headers"
import { clientIp } from "@/lib/server/rateLimit"
import { fingerprint, sharedRateLimit } from "@/lib/server/sharedRateLimit"

// Auth callbacks always return to our own site, whatever Origin header the request carried
const callbackUrl = new URL("/auth/callback", SITE_URL).toString()

export async function signInWithEmail(formData: FormData) {
  const email = z.email().max(254).safeParse(String(formData.get("email") ?? "").trim())
  if (!email.success) return { success: false, error: "Enter a valid email address." }
  // Magic links send email: 5 per IP and 3 per address per hour
  const ip = clientIp(await headers())
  const [byIp, byEmail] = await Promise.all([
    sharedRateLimit(`auth|magic|ip|${fingerprint(ip)}`, 5, 60 * 60_000),
    sharedRateLimit(`auth|magic|email|${fingerprint(email.data)}`, 3, 60 * 60_000),
  ])
  if (!byIp.ok || !byEmail.ok) return { success: false, error: "Too many sign-in links requested. Try again later." }
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: {
      emailRedirectTo: callbackUrl,
    },
  })

  if (error) {
    console.error("[auth]", error)
    return { success: false, error: "Sign-in couldn't be started. Try again." }
  }

  return { success: true, message: "Check your email for the magic sign-in link!" }
}

export async function signInWithOAuth(provider: "google" | "github") {
  if (provider !== "google" && provider !== "github") return { success: false, error: "Unknown sign-in provider." }
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: callbackUrl,
    },
  })

  if (error) {
    console.error("[auth]", error)
    return { success: false, error: "Sign-in couldn't be started. Try again." }
  }

  if (data.url) {
    redirect(data.url)
  }

  return { success: true }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/")
}

export async function getCurrentUser() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user
  } catch {
    return null
  }
}

