import type { Metadata } from "next"
import { StoryEditor } from "@/components/editor/StoryEditor"

export const metadata: Metadata = {
  title: "New story",
}

export default function NewStoryPage() {
  return <StoryEditor />
}
