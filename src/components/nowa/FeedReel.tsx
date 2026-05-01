import { useEffect, useRef, useState, useMemo, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "@tanstack/react-router";
import {
  Heart, MessageCircle, Share2, UserPlus, UserCheck, Clock, Loader2,
  Volume2, VolumeX, ShieldAlert, Flag, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Avatar } from "./PostCard";
import { CommentsPanel } from "./CommentsPanel";
import { MentionText } from "./MentionText";
import { ReportDialog } from "./ReportDialog";
import {
  fetchComments,
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

// ── Types ──
type AuthorGroup = {
  authorId: string;
  posts: Post[];
};

// ── Helpers ──
function groupByAuthor(posts: Post[]): AuthorGroup[] {
  const map = new Map<string, Post[]>();
  const order: string[] = [];
  for (const p of posts) {
    if (!map.has(p.author_id)) {
      map.set(p.author_id, []);
      order.push(p.author_id);
    }
    map.get(p.author_id)!.push(p);
  }
  return order.map((id) => ({ authorId: id, posts: map.get(id)! }));
}

const WINDOW = 2;

export function FeedReel({ posts }: { posts: Post[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeGroupIdx, setActiveGroupIdx] = useState(0);
  const { user } = useAuth();
  const qc = useQueryClient();

  const groups = useMemo(() => groupByAuthor(posts), [posts]);

  // Realtime sync
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`feed-sync:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "follows", filter: `follower_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["follow-state"] }),
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
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, qc]);

  // Intersection observer for active group
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const items = Array.from(el.querySelectorAll<HTMLElement>("[data-group-item]"));
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && e.intersectionRatio > 0.6) {
            const idx = Number((e.target as HTMLElement).dataset.groupIdx);
            if (!Number.isNaN(idx)) setActiveGroupIdx(idx);
          }
        });
      },
      { root: el, threshold: [0.6] }
    );
    items.forEach((i) => obs.observe(i));
    return () => obs.disconnect();
  }, [groups.length]);

  const scrollToGroup = useCallback((idx: number) => {
    const el = containerRef.current;
    if (!el) return;
    const target = el.querySelector<HTMLElement>(`[data-group-idx="${idx}"]`);
    target?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleGroupFinished = useCallback((gi: number) => {
    if (gi + 1 < groups.length) {
      scrollToGroup(gi + 1);
    } else {
      // Loop back to first group
      scrollToGroup(0);
    }
  }, [groups.length, scrollToGroup]);

  const windowStart = Math.max(0, activeGroupIdx - WINDOW);
  const windowEnd = Math.min(groups.length - 1, activeGroupIdx + WINDOW);

  return (
    <>
      {/* Branding overlay */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)] pb-2">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white drop-shadow-md">NOWA</h1>
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/60 drop-shadow-sm">
            Compartilhe seus momentos
          </p>
        </div>
      </div>

      <div
        ref={containerRef}
        className="h-[100dvh] w-full overflow-y-auto snap-y snap-mandatory bg-black"
        style={{ scrollSnapType: "y mandatory" }}
      >
        {groups.map((group, gi) => {
          const inWindow = gi >= windowStart && gi <= windowEnd;
          return (
            <div
              key={group.authorId}
              data-group-item
              data-group-idx={gi}
              className="relative h-[100dvh] w-full snap-start snap-always"
            >
              {inWindow ? (
                <GroupSlide
                  group={group}
                  active={gi === activeGroupIdx}
                  nearActive={Math.abs(gi - activeGroupIdx) <= 1}
                  onGroupFinished={() => handleGroupFinished(gi)}
                />
              ) : (
                <div className="h-full w-full bg-black" />
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  GroupSlide — handles horizontal navigation within an author's posts */
/* ------------------------------------------------------------------ */

function GroupSlide({
  group,
  active,
  nearActive,
  onGroupFinished,
}: {
  group: AuthorGroup;
  active: boolean;
  nearActive: boolean;
  onGroupFinished?: () => void;
}) {
  const [currentPostIdx, setCurrentPostIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const post = group.posts[Math.min(currentPostIdx, group.posts.length - 1)];
  const total = group.posts.length;

  // Auto-advance: images 5s, videos advance on ended (handled via onVideoEnded)
  useEffect(() => {
    if (!active) return;
    const isVideo = post.media_type === "video";
    if (!isVideo) {
      timerRef.current = setTimeout(() => {
        setCurrentPostIdx((i) => {
          if (i + 1 < total) return i + 1;
          // Last post in group finished → advance to next group
          onGroupFinished?.();
          return i;
        });
      }, 5000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [active, currentPostIdx, total, post.media_type, onGroupFinished]);

  // Reset to first post when group becomes active
  useEffect(() => {
    if (active) setCurrentPostIdx(0);
  }, [active]);

  const goNext = useCallback(() => {
    if (currentPostIdx + 1 < total) {
      setCurrentPostIdx((i) => i + 1);
    } else {
      onGroupFinished?.();
    }
  }, [currentPostIdx, total, onGroupFinished]);

  const goPrev = useCallback(() => {
    if (currentPostIdx > 0) {
      setCurrentPostIdx((i) => i - 1);
    }
  }, [currentPostIdx]);

  return (
    <div className="relative h-full w-full">
      {/* Progress bars — Stories style */}
      {total > 1 && (
        <div className="absolute inset-x-3 top-[calc(max(env(safe-area-inset-top),12px)+32px)] z-30 flex gap-1">
          {group.posts.map((p, i) => (
            <div
              key={p.id}
              className="h-[2.5px] flex-1 overflow-hidden rounded-full bg-white/30"
            >
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  i < currentPostIdx
                    ? "w-full bg-white"
                    : i === currentPostIdx
                      ? "w-full bg-white"
                      : "w-0 bg-white"
                }`}
              />
            </div>
          ))}
        </div>
      )}

      {/* Tap zones — left/right to navigate within author */}
      {total > 1 && (
        <>
          <button
            type="button"
            className="absolute left-0 top-0 z-20 h-full w-1/4"
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            aria-label="Post anterior"
          />
          <button
            type="button"
            className="absolute right-0 top-0 z-20 h-full w-1/4"
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            aria-label="Próximo post"
          />
        </>
      )}

      <ReelSlide
        post={post}
        active={active}
        nearActive={nearActive}
        onVideoEnded={goNext}
        hasMultiple={total > 1}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ReelSlide — individual post (unchanged logic, extracted)           */
/* ------------------------------------------------------------------ */

function slidePropsAreEqual(
  prev: { post: Post; active: boolean; nearActive: boolean; hasMultiple: boolean },
  next: { post: Post; active: boolean; nearActive: boolean; hasMultiple: boolean },
): boolean {
  if (prev.active !== next.active) return false;
  if (prev.nearActive !== next.nearActive) return false;
  if (prev.hasMultiple !== next.hasMultiple) return false;
  const a = prev.post;
  const b = next.post;
  return (
    a.id === b.id &&
    a.liked_by_me === b.liked_by_me &&
    a.likes_count === b.likes_count &&
    a.media_type === b.media_type &&
    a.media_url === b.media_url &&
    a.caption === b.caption &&
    a.created_at === b.created_at &&
    a.flagged === b.flagged &&
    a.close_friends_only === b.close_friends_only &&
    a.author_id === b.author_id &&
    a.author.handle === b.author.handle &&
    a.author.display_name === b.author.display_name &&
    a.author.avatar_url === b.author.avatar_url
  );
}

const ReelSlide = memo(function ReelSlide({
  post,
  active,
  nearActive,
  onVideoEnded,
  hasMultiple,
}: {
  post: Post;
  active: boolean;
  nearActive: boolean;
  onVideoEnded?: () => void;
  hasMultiple: boolean;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showHeart, setShowHeart] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const lastTapRef = useRef(0);
  const videoElRef = useRef<HTMLVideoElement>(null);

  const isVideo = post.media_type === "video";
  const isMine = user?.id === post.author_id;
  const postId = post.id;
  const authorId = post.author_id;
  const authorHandle = post.author.handle;
  const likedByMe = post.liked_by_me;
  const likesCount = post.likes_count;

  // Autoplay / pause video
  useEffect(() => {
    const el = videoElRef.current;
    if (!el || !isVideo) return;
    if (active) {
      el.currentTime = 0;
      el.play().catch(() => {});
    } else {
      el.pause();
      if (!nearActive) el.currentTime = 0;
    }
  }, [active, isVideo, nearActive, postId]);

  // Video ended → advance to next post in group
  useEffect(() => {
    const el = videoElRef.current;
    if (!el || !isVideo || !active) return;
    const handler = () => onVideoEnded?.();
    el.addEventListener("ended", handler);
    return () => el.removeEventListener("ended", handler);
  }, [isVideo, active, onVideoEnded]);

  // Comments count
  const { data: commentsCount = 0 } = useQuery({
    queryKey: ["comments-count", postId],
    queryFn: () => fetchCommentsCount(postId),
    enabled: nearActive,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!active) return;
    const channel = supabase
      .channel(`comments-count:${postId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments", filter: `post_id=eq.${postId}` },
        () => qc.invalidateQueries({ queryKey: ["comments-count", postId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [active, postId, qc]);

  // Like mutation
  const likeMutation = useMutation({
    mutationFn: () => toggleLike(postId, likedByMe),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["posts"] });
      const prev = qc.getQueriesData<Post[]>({ queryKey: ["posts"] });
      prev.forEach(([key, data]) => {
        if (!data) return;
        qc.setQueryData<Post[]>(
          key,
          data.map((p) =>
            p.id === postId
              ? { ...p, liked_by_me: !p.liked_by_me, likes_count: p.likes_count + (p.liked_by_me ? -1 : 1) }
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

  // Follow state
  const followKey = useMemo(
    () => ["follow-state", authorId, user?.id ?? null] as const,
    [authorId, user?.id],
  );
  const { data: follow } = useQuery({
    queryKey: followKey,
    queryFn: () => fetchFollowState(authorId, user?.id ?? null),
    enabled: !isMine && nearActive,
    staleTime: 60_000,
  });

  const followMutation = useMutation({
    mutationFn: () => toggleFollow(authorId, !!follow?.is_following),
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
        toast(`Você deixou de seguir @${authorHandle}`);
      } else {
        toast.success(`Seguindo @${authorHandle}`, {
          description: "Você verá mais posts dele no seu feed.",
        });
      }
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(followKey, ctx.prev);
      toast.error(
        ctx?.wasFollowing ? "Não foi possível deixar de seguir" : "Não foi possível seguir agora",
        { description: e instanceof Error ? e.message : "Tente novamente em instantes." }
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["follow-state", authorId] }),
  });

  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      if (!likedByMe) likeMutation.mutate();
      setShowHeart((c) => c + 1);
    }
    lastTapRef.current = now;
  }, [likedByMe, likeMutation]);

  const handleShare = useCallback(() => {
    const url = `${window.location.origin}/u/${authorHandle}`;
    if (navigator.share) {
      navigator.share({ title: `@${authorHandle} no NOWA`, url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url);
      toast.success("Link copiado");
    }
  }, [authorHandle]);

  const handleCloseComments = useCallback(() => setCommentsOpen(false), []);

  const mediaElement = useMemo(() => {
    if (isVideo) {
      return (
        <video
          ref={videoElRef}
          src={post.media_url}
          loop={false}
          muted={muted}
          playsInline
          preload={nearActive ? "auto" : "metadata"}
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
      );
    }
    return (
      <img
        src={post.media_url}
        alt={post.caption ?? ""}
        loading={nearActive ? "eager" : "lazy"}
        decoding={nearActive ? "sync" : "async"}
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
    );
  }, [isVideo, post.media_url, post.caption, nearActive, muted, hasMultiple]);

  const authorFooter = useMemo(() => (
    <div className="flex items-center gap-2.5">
      <Avatar src={post.author.avatar_url} name={post.author.display_name} size={40} />
      <div className="leading-tight">
        <p className="text-sm font-bold text-white drop-shadow">@{authorHandle}</p>
        <p className="text-[11px] text-white/80 drop-shadow">{post.author.display_name}</p>
      </div>
    </div>
  ), [post.author.avatar_url, post.author.display_name, authorHandle]);

  return (
    <div className="relative h-full w-full" onClick={handleTap}>
      {mediaElement}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />

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

      {post.close_friends_only && (
        <div className="absolute right-4 top-[max(env(safe-area-inset-top),16px)] z-10">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">
            <Heart className="h-3 w-3 fill-white" strokeWidth={0} />
            Melhores Amigos
          </span>
        </div>
      )}

      {post.flagged && isMine && (
        <div className="absolute inset-x-4 top-[calc(max(env(safe-area-inset-top),16px)+36px)] z-10">
          <div className="flex items-center gap-2 rounded-2xl bg-destructive/90 px-4 py-2.5 backdrop-blur">
            <ShieldAlert className="h-4 w-4 shrink-0 text-destructive-foreground" strokeWidth={2.5} />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-destructive-foreground">
                Post marcado como impróprio
              </p>
              <p className="mt-0.5 truncate text-[10px] text-destructive-foreground/80">
                {post.flagged_reason || "Este conteúdo viola as diretrizes da comunidade."}
              </p>
              <p className="mt-0.5 text-[10px] text-destructive-foreground/60">
                Só você pode ver este post.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* coluna de ações */}
      <div className="absolute bottom-32 right-3 z-10 flex flex-col items-center gap-5">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); likeMutation.mutate(); }}
          className="flex flex-col items-center gap-1"
          aria-label="Curtir"
        >
          <motion.div whileTap={{ scale: 0.85 }}>
            <Heart
              className={`h-8 w-8 drop-shadow-lg ${likedByMe ? "fill-primary text-primary" : "text-white"}`}
              strokeWidth={likedByMe ? 0 : 2}
            />
          </motion.div>
          <span className="text-xs font-semibold tabular-nums text-white drop-shadow">
            {likesCount}
          </span>
        </button>

        <button
          type="button"
          className="flex flex-col items-center gap-1"
          aria-label="Comentar"
          onClick={(e) => { e.stopPropagation(); setCommentsOpen(true); }}
        >
          <MessageCircle className="h-8 w-8 text-white drop-shadow-lg" strokeWidth={2} />
          <span className="text-xs font-semibold tabular-nums text-white drop-shadow">
            {commentsCount}
          </span>
        </button>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleShare(); }}
          className="flex flex-col items-center gap-1"
          aria-label="Compartilhar"
        >
          <Share2 className="h-8 w-8 text-white drop-shadow-lg" strokeWidth={2} />
        </button>

        {!isMine && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setReportOpen(true); }}
            className="flex flex-col items-center gap-1"
            aria-label="Denunciar"
          >
            <Flag className="h-7 w-7 text-white drop-shadow-lg" strokeWidth={2} />
          </button>
        )}

        {isVideo && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }}
            className="flex flex-col items-center gap-1"
            aria-label={muted ? "Ativar som" : "Silenciar"}
          >
            {muted ? (
              <VolumeX className="h-7 w-7 text-white drop-shadow-lg" strokeWidth={2} />
            ) : (
              <Volume2 className="h-7 w-7 text-white drop-shadow-lg" strokeWidth={2} />
            )}
          </button>
        )}
      </div>

      {/* rodapé com autor + caption + seguir */}
      <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-28">
        <div className="flex items-center gap-3">
          <Link
            to="/u/$handle"
            params={{ handle: authorHandle }}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2.5"
          >
            {authorFooter}
          </Link>

          {!isMine && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); followMutation.mutate(); }}
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
            <MentionText text={post.caption} className="[&_a]:text-white [&_a]:underline" />
          </p>
        )}
      </div>

      <CommentsPanel
        postId={postId}
        open={commentsOpen}
        onClose={handleCloseComments}
      />
      <ReportDialog
        postId={postId}
        open={reportOpen}
        onOpenChange={setReportOpen}
      />
    </div>
  );
}, slidePropsAreEqual);
