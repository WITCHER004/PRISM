import type { Metadata } from "next"
import { StudioFrame } from "@/components/studio/StudioFrame"

export const metadata: Metadata = {
  title: "Studio",
  robots: { index: false, follow: false },
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <StudioFrame>{children}</StudioFrame>
}
