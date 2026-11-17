import type { Metadata } from "next"
import { PanelWorkspace } from "./PanelWorkspace"

export const metadata: Metadata = {
  title: "Review panel",
  robots: { index: false, follow: false },
}

export default function PanelPage() {
  return <PanelWorkspace />
}
