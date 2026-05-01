import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { Heart, MessageCircle, Share2, UserPlus, UserCheck, Clock, Loader2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Avatar } from "./PostCard";
import { CommentsPanel } from "./CommentsPanel";
import {
  fetchCommentsCount,
  fetchFollowState,
  toggleFollow,
  toggleLike,
  timeRemaining,
  type FollowState,
  type Post,
} from "@/lib/posts-api";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

export function FeedReel({ posts }: { posts: Post[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const { user } = useAuth();
  const qc = useQueryClient();

  // Realtime: when the current user follows/unfollows anyone, refresh all
  // cached follow states so feed buttons stay in sync across slides.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`feed-sync:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "follows", filter: `follower_id=eq.${user.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["follow-state"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "blocks", filter: `blocker_id=eq.${user.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["feed"] });
          qc.invalidateQueries({ queryKey: ["posts"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);

  // Track which slide is centered for active state
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const items = Array.from(el.querySelectorAll<HTMLElement>("[data-reel-item]"));
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && e.intersectionRatio > 0.6) {
            const idx = Number((e.target as HTMLElement).dataset.idx);
            if (!Number.isNaN(idx)) setActiveIndex(idx);
          }
        });
      },
      { root: el, threshold: [0.6] }
    );
    items.forEach((i) => obs.observe(i));
    return () => obs.disconnect();
  }, [posts.length]);

  return (
    <div
      ref={containerRef}
      className="h-[100dvh] w-full overflow-y-auto snap-y snap-mandatory bg-black"
      style={{ scrollSnapType: "y mandatory" }}
    >
      {posts.map((post, i) => (
        <div
          key={post.id}
          data-reel-item
          data-idx={i}
          className="relative h-[100dvh] w-full snap-start snap-always"
        >
          <ReelSlide post={post} active={i === activeIndex} />
        </div>
      ))}
    </div>
  );
}

function ReelSlide({ post, active }: { post: Post; active: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showHeart, setShowHeart] = useState(0);
  const lastTapRef = useRef(0);

  const isMine = user?.id === post.author_id;

  // Like mutation (optimistic across all post queries)
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
    onSettled: () => qc.invalidateQueries({ queryKey: ["posts"] }),
  });

  // Follow state for this slide's author
  const followKey = ["follow-state", post.author_id, user?.id ?? null] as const;
  const { data: follow } = useQuery({
    queryKey: followKey,
    queryFn: () => fetchFollowState(post.author_id, user?.id ?? null),
    enabled: !isMine && active, // só carrega quando o slide entra em foco
    staleTime: 60_000,
  });

  const followMutation = useMutation({
    mutationFn: () => toggleFollow(post.author_id, !!follow?.is_following),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: followKey });
      const prev = qc.getQueryData<FollowState>(followKey);
      const wasFollowing = !!prev?.is_following;
      if (prev) {
        qc.setQueryData<FollowState>(followKey, {
          ...prev,
          is_following: !prev.is_following,
          followers: prev.followers + (prev.is_following ? -1 : 1),
        });
      }
      return { prev, wasFollowing };
    },
    onSuccess: (_d, _v, ctx) => {
      if (ctx?.wasFollowing) {
        toast(`Você deixou de seguir @${post.author.handle}`);
      } else {
        toast.success(`Seguindo @${post.author.handle}`, {
          description: "Você verá mais posts dele no seu feed.",
        });
      }
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(followKey, ctx.prev);
      toast.error(
        ctx?.wasFollowing
          ? "Não foi possível deixar de seguir"
          : "Não foi possível seguir agora",
        { description: e instanceof Error ? e.message : "Tente novamente em instantes." }
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["follow-state", post.author_id] });
    },
  });

  function handleTap() {
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      // duplo toque = curtir
      if (!post.liked_by_me) likeMutation.mutate();
      setShowHeart((c) => c + 1);
    }
    lastTapRef.current = now;
  }

  function handleShare() {
    const url = `${window.location.origin}/u/${post.author.handle}`;
    if (navigator.share) {
      navigator.share({ title: `@${post.author.handle} no NOWA`, url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url);
      toast.success("Link copiado");
    }
  }

  return (
    <div className="relative h-full w-full" onClick={handleTap}>
      <img
        src={post.media_url}
        alt={post.caption ?? ""}
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
      {/* gradiente para legibilidade */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />

      {/* duplo-toque heart */}
      <AnimatePresence>
        {showHeart > 0 && (
          <motion.div
            key={showHeart}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 1 }}
            exit={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            onAnimationComplete={() => setShowHeart(0)}
          >
            <Heart className="h-32 w-32 fill-white text-white drop-shadow-2xl" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* badge tempo restante */}
      <div className="absolute left-4 top-[max(env(safe-area-inset-top),16px)] z-10">
        <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
          <Clock className="h-3 w-3" strokeWidth={2.5} />
          {timeRemaining(post.created_at)}
        </span>
      </div>

      {/* coluna de ações à direita */}
      <div className="absolute bottom-32 right-3 z-10 flex flex-col items-center gap-5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            likeMutation.mutate();
          }}
          className="flex flex-col items-center gap-1"
          aria-label="Curtir"
        >
          <motion.div whileTap={{ scale: 0.85 }}>
            <Heart
              className={`h-8 w-8 drop-shadow-lg ${
                post.liked_by_me ? "fill-primary text-primary" : "text-white"
              }`}
              strokeWidth={post.liked_by_me ? 0 : 2}
            />
          </motion.div>
          <span className="text-xs font-semibold tabular-nums text-white drop-shadow">
            {post.likes_count}
          </span>
        </button>

        <button
          type="button"
          className="flex flex-col items-center gap-1"
          aria-label="Comentar"
          onClick={(e) => e.stopPropagation()}
        >
          <MessageCircle className="h-8 w-8 text-white drop-shadow-lg" strokeWidth={2} />
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleShare();
          }}
          className="flex flex-col items-center gap-1"
          aria-label="Compartilhar"
        >
          <Share2 className="h-8 w-8 text-white drop-shadow-lg" strokeWidth={2} />
        </button>
      </div>

      {/* rodapé com autor + caption + seguir */}
      <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-28">
        <div className="flex items-center gap-3">
          <Link
            to="/u/$handle"
            params={{ handle: post.author.handle }}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2.5"
          >
            <Avatar
              src={post.author.avatar_url}
              name={post.author.display_name}
              size={40}
            />
            <div className="leading-tight">
              <p className="text-sm font-bold text-white drop-shadow">
                @{post.author.handle}
              </p>
              <p className="text-[11px] text-white/80 drop-shadow">
                {post.author.display_name}
              </p>
            </div>
          </Link>

          {!isMine && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                followMutation.mutate();
              }}
              disabled={followMutation.isPending || !follow}
              aria-busy={followMutation.isPending}
              className={`nowa-tap ml-auto inline-flex min-w-[88px] items-center justify-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all disabled:opacity-70 ${
                follow?.is_following
                  ? "bg-white/15 text-white backdrop-blur"
                  : "bg-primary text-primary-foreground"
              } ${followMutation.isPending ? "scale-95" : ""}`}
            >
              {followMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.5} />
              ) : follow?.is_following ? (
                <>
                  <UserCheck className="h-3.5 w-3.5" strokeWidth={2.5} />
                  Seguindo
                </>
              ) : (
                <>
                  <UserPlus className="h-3.5 w-3.5" strokeWidth={2.5} />
                  Seguir
                </>
              )}
            </button>
          )}
        </div>

        {post.caption && (
          <p className="mt-3 line-clamp-3 text-sm leading-snug text-white drop-shadow">
            {post.caption}
          </p>
        )}
      </div>
    </div>
  );
}
