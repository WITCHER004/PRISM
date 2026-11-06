"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"

export async function incrementClap(postId: string, count = 1) {
  try {
    const post = await db.post.update({
      where: { id: postId },
      data: {
        clapCount: { increment: Math.min(count, 50) },
      },
      select: { id: true, clapCount: true, author: { select: { username: true } }, slug: true },
    })

    revalidatePath(`/${post.author.username}/${post.slug}`)
    return { success: true, count: post.clapCount }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function submitComment(postId: string, authorId: string, body: string, parentId?: string) {
  try {
    const comment = await db.comment.create({
      data: {
        postId,
        authorId,
        body,
        parentId,
      },
      include: {
        author: true,
      },
    })

    await db.post.update({
      where: { id: postId },
      data: { commentCount: { increment: 1 } },
    })

    return { success: true, comment }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function recordReadSession(postId: string, durationSec: number, scrollDepth: number, userId?: string) {
  try {
    await db.readSession.create({
      data: {
        postId,
        userId: userId ?? null,
        durationSec,
        scrollDepth,
      },
    })
    return { success: true }
  } catch {
    return { success: false }
  }
}

