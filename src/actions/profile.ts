"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { ActionError, requireUser, runAction } from "@/lib/session"
import { normalizeHandle, SOCIALS, type SocialKey } from "@/lib/social"

// Profile hub edits (database edition): bio, display name, social handles and avatar URL.

const handle = (key: SocialKey) =>
  z
    .string()
    .max(200)
    .transform((v) => normalizeHandle(key, v))
    .refine((v) => !v || SOCIALS[key].pattern.test(v), SOCIALS[key].hint)

const ProfileInput = z.object({
  displayName: z.string().trim().min(1, "Your name can't be empty.").max(50),
  bio: z.string().trim().max(200),
  websiteUrl: z.union([z.literal(""), z.url("That doesn't look like a web address.")]),
  linkedinHandle: handle("linkedinHandle"),
  instagramHandle: handle("instagramHandle"),
  twitterHandle: handle("twitterHandle"),
  githubHandle: handle("githubHandle"),
  // A public storage URL or an inline image from /api/profile/avatar
  avatarUrl: z
    .string()
    .max(3_000_000)
    .refine((v) => !v || /^https:\/\//.test(v) || /^data:image\/(jpeg|png|webp);base64,/.test(v), "Unsupported avatar.")
    .optional(),
})

export async function updateProfile(input: z.input<typeof ProfileInput>) {
  return runAction(async () => {
    const user = await requireUser()
    const parsed = ProfileInput.safeParse(input)
    if (!parsed.success) throw new ActionError(parsed.error.issues[0]?.message ?? "Invalid profile.")
    const d = parsed.data
    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        displayName: d.displayName,
        bio: d.bio || null,
        websiteUrl: d.websiteUrl || null,
        linkedinHandle: d.linkedinHandle || null,
        instagramHandle: d.instagramHandle || null,
        twitterHandle: d.twitterHandle || null,
        githubHandle: d.githubHandle || null,
        ...(d.avatarUrl !== undefined ? { avatarUrl: d.avatarUrl || null } : {}),
      },
    })
    revalidatePath(`/${updated.username}`)
    revalidatePath(`/profile/${updated.username}`)
    return { username: updated.username }
  })
}
