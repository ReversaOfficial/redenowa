import { Heart, MessageCircle, Share2, Bookmark } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  toggleLike,
  timeAgo,
  type Post,
} from "@/lib/posts-api";
import { ExpiryCountdown } from "./ExpiryCountdown";

export function PostCard({ post }: { post: Post }) {
  const qc = useQueryClient();

  const likeMutation = useMutation({
    mutationFn: () => toggleLike(post.id, post.liked_by_me),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["posts"] });
      const prev = qc.getQueriesData<Post[]>({ queryKey: ["posts"] });
      prev.forEach(([key, data]) => {
        if (!data) return;
        qc.setQueryData<Post[]>(
          key,
          data.map((p) =>
            p.id === post.id
              ? {
                  ...p,
                  liked_by_me: !p.liked_by_me,
                  likes_count: p.likes_count + (p.liked_by_me ? -1 : 1),
                }
              : p
          )
        );
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      ctx?.prev.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error("Não foi possível curtir");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
  });

  return (
    <article className="border-b border-border bg-background pb-4">
      <header className="flex items-center justify-between px-4 py-3">
        <Link
          to="/u/$handle"
          params={{ handle: post.author.handle }}
          className="flex items-center gap-3"
        >
          <Avatar
            src={post.author.avatar_url}
            name={post.author.display_name}
          />
          <div className="leading-tight">
            <p className="text-sm font-semibold text-foreground">
              {post.author.display_name}
            </p>
            <p className="text-xs text-muted-foreground">
              @{post.author.handle} · {timeAgo(post.created_at)}
            </p>
          </div>
        </Link>
        <ExpiryCountdown createdAt={post.created_at} />
      </header>

      <div className="relative overflow-hidden bg-card">
        <img
          src={post.media_url}
          alt={post.caption ?? ""}
          loading="lazy"
          className="aspect-[4/5] w-full object-cover"
        />
      </div>

      <div className="flex items-center justify-between px-4 pt-3">
        <div className="flex items-center gap-5">
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => likeMutation.mutate()}
            className="flex items-center gap-1.5"
            aria-label="Curtir"
          >
            <Heart
              className={`h-6 w-6 transition-colors ${
                post.liked_by_me ? "fill-primary text-primary" : "text-foreground"
              }`}
              strokeWidth={post.liked_by_me ? 0 : 2}
            />
            <span className="text-sm font-medium text-foreground tabular-nums">
              {post.likes_count}
            </span>
          </motion.button>
          <button className="flex items-center gap-1.5" aria-label="Comentar">
            <MessageCircle className="h-6 w-6 text-foreground" strokeWidth={2} />
          </button>
          <button
            aria-label="Compartilhar"
            onClick={() => {
              const url = window.location.origin;
              if (navigator.share) {
                navigator.share({ title: "NOWA", url }).catch(() => {});
              } else {
                navigator.clipboard?.writeText(url);
                toast.success("Link copiado");
              }
            }}
          >
            <Share2 className="h-6 w-6 text-foreground" strokeWidth={2} />
          </button>
        </div>
        <button aria-label="Salvar">
          <Bookmark className="h-6 w-6 text-foreground" strokeWidth={2} />
        </button>
      </div>

      {post.caption && (
        <p className="px-4 pt-2 text-sm leading-snug text-foreground">
          <Link
            to="/u/$handle"
            params={{ handle: post.author.handle }}
            className="font-semibold"
          >
            {post.author.handle}
          </Link>{" "}
          {post.caption}
        </p>
      )}
    </article>
  );
}

export function Avatar({
  src,
  name,
  size = 40,
  ringColor,
  ringWidth = 3,
}: {
  src: string | null;
  name: string;
  size?: number;
  ringColor?: string | null;
  ringWidth?: number;
}) {
  const ringStyle = ringColor
    ? {
        padding: ringWidth,
        background: ringColor,
        borderRadius: 9999,
        display: "inline-flex",
      }
    : undefined;

  const inner =
    src ? (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        loading="lazy"
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    ) : (
      <div
        className="flex items-center justify-center rounded-full bg-primary text-primary-foreground"
        style={{ width: size, height: size, fontSize: size / 2.4 }}
      >
        <span className="font-semibold">
          {(name?.[0] ?? "?").toUpperCase()}
        </span>
      </div>
    );

  if (!ringColor) return inner;
  return <span style={ringStyle}>{inner}</span>;
}
