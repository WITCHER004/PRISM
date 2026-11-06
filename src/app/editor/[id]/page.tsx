"use client"

import { useParams } from "next/navigation"
import { StoryEditor } from "@/components/editor/StoryEditor"

export default function EditStoryPage() {
  const { id } = useParams<{ id: string }>()
  return <StoryEditor key={id} draftId={id} />
}
