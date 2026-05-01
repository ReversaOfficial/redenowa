import { Heart, MessageCircle, Share2, Bookmark, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { postsStore, timeAgo, timeRemaining, type Post } from "@/lib/posts-store";

export function PostCard({ post }: { post: Post }) {
  return (
    <article className="border-b border-border bg-background pb-4">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <img
            src={post.authorAvatar}
            alt={post.authorName}
            width={40}
            height={40}
            loading="lazy"
            className="h-10 w-10 rounded-full object-cover"
          />
          <div className="leading-tight">
            <p className="text-sm font-semibold text-foreground">{post.authorName}</p>
            <p className="text-xs text-muted-foreground">
              @{post.authorHandle} · {timeAgo(post.createdAt)}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[10px] font-medium text-primary">
          <Clock className="h-3 w-3" strokeWidth={2.5} />
          {timeRemaining(post.createdAt)}
        </span>
      </header>

      {/* Media */}
      <div className="relative overflow-hidden bg-card">
        <img
          src={post.mediaUrl}
          alt={post.caption}
          width={768}
          height={960}
          loading="lazy"
          className="aspect-[4/5] w-full object-cover"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between px-4 pt-3">
        <div className="flex items-center gap-5">
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => postsStore.toggleLike(post.id)}
            className="flex items-center gap-1.5"
            aria-label="Curtir"
          >
            <Heart
              className={`h-6 w-6 transition-colors ${
                post.liked ? "fill-primary text-primary" : "text-foreground"
              }`}
              strokeWidth={post.liked ? 0 : 2}
            />
            <span className="text-sm font-medium text-foreground tabular-nums">
              {post.likes}
            </span>
          </motion.button>
          <button className="flex items-center gap-1.5" aria-label="Comentar">
            <MessageCircle className="h-6 w-6 text-foreground" strokeWidth={2} />
            <span className="text-sm font-medium text-foreground tabular-nums">
              {post.comments}
            </span>
          </button>
          <button aria-label="Compartilhar">
            <Share2 className="h-6 w-6 text-foreground" strokeWidth={2} />
          </button>
        </div>
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={() => postsStore.toggleSave(post.id)}
          aria-label="Salvar"
        >
          <Bookmark
            className={`h-6 w-6 ${
              post.saved ? "fill-foreground text-foreground" : "text-foreground"
            }`}
            strokeWidth={post.saved ? 0 : 2}
          />
        </motion.button>
      </div>

      {/* Caption */}
      {post.caption && (
        <p className="px-4 pt-2 text-sm leading-snug text-foreground">
          <span className="font-semibold">{post.authorHandle} </span>
          {post.caption}
        </p>
      )}
    </article>
  );
}
