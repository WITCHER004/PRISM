import type { Metadata } from "next"
import { AdminShell } from "@/components/admin/AdminShell"

export const metadata: Metadata = {
  title: { template: "%s | Prism Admin", default: "Prism Admin" },
  robots: { index: false, follow: false },
}

// Its own layout: no site header or footer, and its own session. Nothing on the public site links here.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>
}
