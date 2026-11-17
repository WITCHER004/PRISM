import type { Metadata } from "next"
import { AdminVerification } from "@/components/admin/AdminVerification"

export const metadata: Metadata = { title: "Article verification" }

export default function AdminVerificationPage() {
  return <AdminVerification />
}
