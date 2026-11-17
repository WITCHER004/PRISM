import type { Metadata } from "next"
import { AdminUsers } from "@/components/admin/AdminUsers"

export const metadata: Metadata = { title: "Users & tiers" }

export default function AdminUsersPage() {
  return <AdminUsers />
}
