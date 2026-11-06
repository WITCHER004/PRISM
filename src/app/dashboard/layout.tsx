import type { Metadata } from "next"
import { StudioFrame } from "@/components/studio/StudioFrame"

export const metadata: Metadata = {
  title: "Studio",
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <StudioFrame>{children}</StudioFrame>
}
