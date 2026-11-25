"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { checkKeyLimit } from "@/lib/server/rateLimit"
import { ActionError, getSessionDbUser, requireUser, runAction } from "@/lib/session"

// Database-edition interactions. Identity always comes from the session, never from arguments.

const Id = z.string().trim().min(1).max(128)

/** Most claps one reader can give one story, in total (audit F-23) */
const MAX_CLAPS_PER_USER = 50

/** Per-user, per-instance throttle for interaction actions */
function throttle(kind: string, userId: string, limit: number, windowMs = 60_000) {
  if (!checkKeyLimit(`action|${kind}|${userId}`, limit, windowMs).ok) throw new ActionError("You're going a bit fast. Try again in a minute.", 429)
}

export async function incrementClap(postId: string, count = 1) {
  return runAction(async () => {
    const user = await requireUser()
    throttle("clap", user.id, 30)
    const id = Id.parse(postId)
    const by = z.number().int().min(1).max(MAX_CLAPS_PER_USER).catch(1).parse(count)
    const result = await db.$transaction(async (tx) => {
      const post = await tx.post.findFirst({
        where: { id, status: "PUBLISHED" },
        select: { id: true, clapCount: true, slug: true, author: { select: { username: true } } },
      })
      if (!post) throw new ActionError("Story not found.", 404)
      const key = { userId_postId: { userId: user.id, postId: id } }
      const existing = await tx.clap.findUnique({ where: key, select: { count: true } })
      const add = Math.min(by, MAX_CLAPS_PER_USER - (existing?.count ?? 0))
      if (add <= 0) return { post, count: post.clapCount }
      if (existing) {
        // Guarded increment so concurrent calls can't push past the cap
        const { count: n } = await tx.clap.updateMany({
          where: { userId: user.id, postId: id, count: { lte: MAX_CLAPS_PER_USER - add } },
          data: { count: { increment: add } },
        })
        if (n === 0) return { post, count: post.clapCount }
      } else {
        await tx.clap.create({ data: { userId: user.id, postId: id, count: add } })
      }
      const updated = await tx.post.update({ where: { id }, data: { clapCount: { increment: add } }, select: { clapCount: true } })
      return { post, count: updated.clapCount }
    })
    revalidatePath(`/${result.post.author.username}/${result.post.slug}`)
    return { count: result.count }
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
    throttle("comment", user.id, 10)
    const d = parsed.data
    const post = await db.post.findFirst({ where: { id: d.postId, status: "PUBLISHED" }, select: { id: true } })
    if (!post) throw new ActionError("Story not found.", 404)
    if (d.parentId) {
      const parent = await db.comment.findUnique({ where: { id: d.parentId }, select: { postId: true } })
      if (!parent || parent.postId !== d.postId) throw new ActionError("That response couldn't be found.", 404)
    }
    const [comment] = await db.$transaction([
      db.comment.create({
        data: { postId: d.postId, authorId: user.id, body: d.body, parentId: d.parentId },
        include: { author: { select: { username: true, displayName: true, avatarUrl: true } } },
      }),
      db.post.update({ where: { id: d.postId }, data: { commentCount: { increment: 1 } } }),
    ])
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
