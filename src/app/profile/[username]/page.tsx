import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { ProfileHub } from "@/components/profile/ProfileHub"
import { MOCK_USERS } from "@/lib/data"
import { truncateDescription } from "@/lib/seo"

interface Props {
  params: Promise<{ username: string }>
}

/** Accepts a username or a user id */
function findUser(key: string) {
  const k = decodeURIComponent(key).replace(/^@/, "").toLowerCase()
  return MOCK_USERS.find((u) => u.username === k || u.id === k)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const user = findUser((await params).username)
  if (!user) return { title: "Profile not found" }
  return {
    title: `${user.displayName} · Profile`,
    description: truncateDescription(user.bio),
    // The canonical public profile is /[username]
    alternates: { canonical: `/${user.username}` },
  }
}

export default async function PublicProfilePage({ params }: Props) {
  const user = findUser((await params).username)
  if (!user) notFound()

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <SiteHeader />
      <main className="flex-1">
        <ProfileHub username={user.username} />
      </main>
      <SiteFooter />
    </div>
  )
}
