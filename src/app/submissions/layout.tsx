import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Submission",
  robots: { index: false, follow: false },
}

export default function SubmissionsLayout({ children }: { children: React.ReactNode }) {
  return children
}
