import type { Metadata } from "next"
import { AdminApplications } from "@/components/admin/AdminApplications"

export const metadata: Metadata = { title: "Panel applications" }

export default function AdminApplicationsPage() {
  return <AdminApplications />
}
