import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Story preview",
  robots: { index: false, follow: false },
}

export default function StoryLayout({ children }: { children: React.ReactNode }) {
  return children
}
