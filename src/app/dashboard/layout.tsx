import type { Metadata } from "next"
import { StudioFrame } from "@/components/studio/StudioFrame"

export const metadata: Metadata = {
  title: { default: "Studio", template: "%s | Prism" },
  robots: { index: false, follow: false },
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <StudioFrame>{children}</StudioFrame>
}
