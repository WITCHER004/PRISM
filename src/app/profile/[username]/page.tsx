import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { ProfileHub } from "@/components/profile/ProfileHub"
import { getUsersByHandle } from "@/lib/server/content"
import { truncateDescription } from "@/lib/seo"

interface Props {
  params: Promise<{ username: string }>
}

/** Accepts a handle or a uid */
async function findUser(key: string) {
  const k = decodeURIComponent(key).replace(/^@/, "")
  const users = await getUsersByHandle()
  return users.get(k.toLowerCase()) ?? [...users.values()].find((u) => u.id === k)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const user = await findUser((await params).username)
  if (!user) return { title: "Profile not found" }
  return {
    title: `${user.displayName} · Profile`,
    description: truncateDescription(user.bio),
    // The canonical public profile is /[username]
    alternates: { canonical: `/${user.username}` },
  }
}

export default async function PublicProfilePage({ params }: Props) {
  const user = await findUser((await params).username)
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
