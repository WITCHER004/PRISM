"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { ActionError, getSessionDbUser, requireUser, runAction } from "@/lib/session"

// Database-edition interactions. Identity always comes from the session, never from arguments.

const Id = z.string().trim().min(1).max(128)

export async function incrementClap(postId: string, count = 1) {
  return runAction(async () => {
    await requireUser()
    const id = Id.parse(postId)
    const by = z.number().int().min(1).max(50).catch(1).parse(count)
    const post = await db.post.update({
      where: { id },
      data: { clapCount: { increment: by } },
      select: { id: true, clapCount: true, author: { select: { username: true } }, slug: true },
    })
    revalidatePath(`/${post.author.username}/${post.slug}`)
    return { count: post.clapCount }
  })
}

const CommentInput = z.object({
  postId: Id,
  body: z.string().trim().min(1, "Write something first.").max(1000, "Keep responses under 1,000 characters."),
  parentId: Id.optional(),
})

export async function submitComment(postId: string, body: string, parentId?: string) {
  return runAction(async () => {
    const user = await requireUser()
    const parsed = CommentInput.safeParse({ postId, body, parentId })
    if (!parsed.success) throw new ActionError(parsed.error.issues[0]?.message ?? "Invalid response.")
    const d = parsed.data
    const comment = await db.comment.create({
      data: { postId: d.postId, authorId: user.id, body: d.body, parentId: d.parentId },
      include: { author: { select: { username: true, displayName: true, avatarUrl: true } } },
    })
    await db.post.update({ where: { id: d.postId }, data: { commentCount: { increment: 1 } } })
    return comment
  })
}

const ReadSession = z.object({
  postId: Id,
  durationSec: z.number().int().min(0).max(6 * 60 * 60),
  scrollDepth: z.number().finite().min(0).max(100).default(0),
})

/** Records a read. The reader is whoever is signed in (or anonymous), never a client-supplied id. */
export async function recordReadSession(input: z.input<typeof ReadSession>) {
  const parsed = ReadSession.safeParse(input)
  if (!parsed.success) return { success: false as const }
  try {
    const user = await getSessionDbUser()
    await db.readSession.create({
      data: { postId: parsed.data.postId, userId: user?.id ?? null, durationSec: parsed.data.durationSec, scrollDepth: parsed.data.scrollDepth },
    })
    return { success: true as const }
  } catch {
    return { success: false as const }
  }
}
