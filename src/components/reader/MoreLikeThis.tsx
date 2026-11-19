import { Sparkles } from "lucide-react"
import type { Post } from "@/lib/data"
import { recommend } from "@/lib/recommend"
import { PostCard } from "@/components/posts/PostCard"
import { Reveal } from "@/components/motion/Reveal"

/**
 * Three published articles ranked by topic, shared concepts, author and engagement, each with why it
 * was picked. `pool` is the live published set (Firestore), on the server or the client.
 */
export function MoreLikeThis({
  current,
  pool,
  className,
}: {
  current: Pick<Post, "id" | "title" | "subtitle" | "tags" | "author">
  pool: Post[]
  className?: string
}) {
  const picks = recommend(current, pool, 3)
  if (!picks.length) return null

  return (
    <section aria-labelledby="more-like-this" className={className}>
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <p className="meta inline-flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-[var(--gold)]" /> Picked for this story
          </p>
          <h2 id="more-like-this" className="display mt-2 text-[1.75rem] sm:text-[2.25rem]">
            More like this
          </h2>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {picks.map(({ post, reason }, i) => (
          <Reveal key={post.id} index={i} className="flex flex-col gap-2">
            <span className="self-start inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border border-[var(--border)] bg-[var(--panel)] text-[11.5px] font-medium text-[var(--fg-muted)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)]" aria-hidden />
              {reason}
            </span>
            <PostCard post={post} variant="tile" className="h-full" />
          </Reveal>
        ))}
      </div>
    </section>
  )
}
