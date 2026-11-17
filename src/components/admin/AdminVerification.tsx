"use client"

import { useUIStore } from "@/lib/store"
import { AdminHeader } from "./AdminShell"
import { VerificationWorkspace } from "./VerificationQueue"

export function AdminVerification() {
  const actor = useUIStore((s) => s.adminSession)
  return (
    <>
      <AdminHeader eyebrow="Phase 2" title="Article verification" />
      <div className="px-5 sm:px-8 py-6">
        <p className="max-w-3xl text-sm text-[var(--fg-muted)] leading-relaxed">
          Free and Elite articles that passed the automated check (at most 20% AI) wait here for an employee. Publish Free articles,
          send Elite ones on to the 10-member panel, or reject with notes. Override a panel or rule on appeals from the other tabs.
        </p>
        <div className="mt-6">{actor && <VerificationWorkspace actor={actor} />}</div>
      </div>
    </>
  )
}
