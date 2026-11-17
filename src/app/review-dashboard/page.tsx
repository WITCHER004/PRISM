import { redirect } from "next/navigation"

// The old combined dashboard was split: panel members review at /panel on the main site, and staff
// work the verification queue inside the isolated /admin portal. Old links land on the panel.
export default async function ReviewDashboardPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  redirect(tab === "counters" ? "/panel?tab=counters" : "/panel")
}
