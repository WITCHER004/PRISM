import Link from "next/link"
import { PenLine } from "lucide-react"
import { cn } from "@/lib/utils"

// Friendly stop for signed-out visitors: explains what's behind the door and links to sign in,
// returning here afterwards.
export function SignInGate({ redirectTo, className }: { redirectTo: string; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden panel p-8 sm:p-12 text-center max-w-xl mx-auto", className)}>
      <div aria-hidden className="absolute inset-x-0 top-0 h-1 spectrum-bg" />
      <span className="mx-auto grid place-items-center w-14 h-14 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)]">
        <PenLine className="w-6 h-6" />
      </span>
      <p className="meta mt-6">Studio</p>
      <h1 className="display mt-3 text-[2rem] sm:text-[2.5rem]">Sign in to write</h1>
      <p className="mt-3 text-[var(--fg-muted)] leading-relaxed">
        Your drafts, stats and subscribers live in your Studio. Sign in and we&apos;ll bring you right back here.
      </p>
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-2">
        <Link
          href={`/auth/login?redirectTo=${encodeURIComponent(redirectTo)}`}
          className="inline-flex items-center justify-center h-11 px-6 rounded-full text-sm font-medium bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--fg-secondary)] transition-colors w-full sm:w-auto"
        >
          Sign in
        </Link>
        <Link
          href="/"
          className="inline-flex items-center justify-center h-11 px-6 rounded-full text-sm font-medium border border-[var(--border-strong)] hover:border-[var(--fg)] transition-colors w-full sm:w-auto"
        >
          Keep reading
        </Link>
      </div>
    </div>
  )
}
