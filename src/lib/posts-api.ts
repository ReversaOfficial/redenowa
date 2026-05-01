import { supabase } from "@/integrations/supabase/client";
import { compressAvatar } from "@/lib/image-compress";
import { useSyncExternalStore } from "react";

const HOUR = 60 * 60 * 1000;

export type Post = {
  id: string;
  author_id: string;
  media_url: string;
  media_type: "image" | "video";
  caption: string | null;
  created_at: string; // ISO
  flagged: boolean;
  flagged_reason: string | null;
  close_friends_only: boolean;
  // joined
  author: {
    id: string;
    handle: string;
    display_name: string;
    avatar_url: string | null;
  };
  likes_count: number;
  liked_by_me: boolean;
};

export function timeRemaining(createdAt: string): string {
  const created = new Date(createdAt).getTime();
  const ms = created + 24 * HOUR - Date.now();
  if (ms <= 0) return "expirado";
  const h = Math.floor(ms / HOUR);
  const m = Math.floor((ms % HOUR) / (60 * 1000));
  if (h >= 1) return `${h}h restantes`;
  return `${m}min restantes`;
}

export function timeAgo(createdAt: string): string {
  const ms = Date.now() - new Date(createdAt).getTime();
  const m = Math.floor(ms / (60 * 1000));
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

type RawPost = {
  id: string;
  author_id: string;
  media_url: string;
  media_type: string;
  caption: string | null;
  created_at: string;
  flagged: boolean;
  flagged_reason: string | null;
  close_friends_only: boolean;
  profiles: {
    id: string;
    handle: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  likes: { user_id: string }[];
};

function shape(rows: RawPost[], myId: string | null): Post[] {
  return rows
    .filter((r) => r.profiles)
    .map((r) => ({
      id: r.id,
      author_id: r.author_id,
      media_url: r.media_url,
      media_type: (r.media_type as "image" | "video") ?? "image",
      caption: r.caption,
      created_at: r.created_at,
      flagged: r.flagged ?? false,
      flagged_reason: r.flagged_reason ?? null,
      close_friends_only: r.close_friends_only ?? false,
      author: r.profiles!,
      likes_count: r.likes.length,
      liked_by_me: myId ? r.likes.some((l) => l.user_id === myId) : false,
    }));
}

async function fetchBlockedIds(myId: string | null): Promise<Set<string>> {
  if (!myId) return new Set();
  const { data } = await supabase
    .from("blocks")
    .select("blocked_id")
    .eq("blocker_id", myId);
  return new Set((data ?? []).map((b) => b.blocked_id));
}

export async function fetchActivePosts(myId: string | null): Promise<Post[]> {
  const cutoff = new Date(Date.now() - 24 * HOUR).toISOString();
  const blocked = await fetchBlockedIds(myId);
  let q = supabase
    .from("posts")
    .select(
      "id, author_id, media_url, media_type, caption, created_at, flagged, flagged_reason, close_friends_only, profiles!posts_author_id_fkey(id, handle, display_name, avatar_url), likes(user_id)"
    )
    .gt("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(100);
  if (blocked.size > 0) {
    q = q.not("author_id", "in", `(${[...blocked].join(",")})`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return shape((data ?? []) as unknown as RawPost[], myId);
}

/**
 * Feed estilo TikTok:
 *  - mistura aleatória de posts ativos (descoberta) com posts de quem você segue
 *  - nenhum autor monopoliza: round-robin distribui 1 post por autor por ciclo
 *  - proporção alvo: ~1 seguido a cada 3 (resto = descoberta aleatória)
 */
export async function fetchFeedPosts(myId: string | null): Promise<Post[]> {
  const all = await fetchActivePosts(myId);
  if (all.length === 0) return all;

  let followingSet = new Set<string>();
  if (myId) {
    const { data: follows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", myId);
    followingSet = new Set((follows ?? []).map((f) => f.following_id));
  }

  // Round-robin por autor — máx 1 post por autor por "rodada"
  const byAuthor = new Map<string, Post[]>();
  for (const p of all) {
    const arr = byAuthor.get(p.author_id) ?? [];
    arr.push(p);
    byAuthor.set(p.author_id, arr);
  }
  // embaralha posts dentro de cada autor
  for (const arr of byAuthor.values()) shuffle(arr);

  const followedAuthors = shuffle(
    [...byAuthor.keys()].filter((id) => followingSet.has(id) && id !== myId)
  );
  const otherAuthors = shuffle(
    [...byAuthor.keys()].filter((id) => !followingSet.has(id))
  );

  const out: Post[] = [];
  let slot = 0;
  // Continua até esvaziar todos os baldes
  while (byAuthor.size > 0) {
    // a cada 3 slots, 1 prioriza "seguindo" (se houver)
    const useFollowed = slot % 3 === 0 && followedAuthors.length > 0;
    const pool = useFollowed ? followedAuthors : otherAuthors;
    const fallback = useFollowed ? otherAuthors : followedAuthors;
    const authorId = pool.shift() ?? fallback.shift();
    if (!authorId) break;
    const bucket = byAuthor.get(authorId);
    if (!bucket || bucket.length === 0) {
      byAuthor.delete(authorId);
      continue;
    }
    out.push(bucket.shift()!);
    if (bucket.length > 0) {
      // autor volta para o fim do seu pool para próxima rodada
      (followingSet.has(authorId) ? followedAuthors : otherAuthors).push(
        authorId
      );
    } else {
      byAuthor.delete(authorId);
    }
    slot++;
  }
  return out;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export type PublicProfile = {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  theme_bg: string | null;
  theme_ring: string | null;
  valid_reports_count: number;
  invalid_reports_count: number;
};

export async function fetchProfileByHandle(
  handle: string
): Promise<PublicProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, handle, display_name, avatar_url, bio, city, state, country, theme_bg, theme_ring, valid_reports_count, invalid_reports_count",
    )
    .eq("handle", handle)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type FollowState = {
  followers: number;
  following: number;
  is_following: boolean;
};

export async function fetchFollowState(
  targetId: string,
  viewerId: string | null
): Promise<FollowState> {
  const [{ count: followers }, { count: following }, mine] = await Promise.all([
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", targetId),
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", targetId),
    viewerId && viewerId !== targetId
      ? supabase
          .from("follows")
          .select("follower_id")
          .eq("follower_id", viewerId)
          .eq("following_id", targetId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return {
    followers: followers ?? 0,
    following: following ?? 0,
    is_following: !!(mine as { data: unknown }).data,
  };
}

export async function toggleFollow(
  targetId: string,
  currentlyFollowing: boolean
) {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("Not authenticated");
  if (uid === targetId) throw new Error("Cannot follow yourself");
  if (currentlyFollowing) {
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", uid)
      .eq("following_id", targetId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("follows")
      .insert({ follower_id: uid, following_id: targetId });
    if (error) throw error;
  }
}

export async function fetchUserPosts(
  userId: string,
  active: boolean
): Promise<Post[]> {
  const cutoff = new Date(Date.now() - 24 * HOUR).toISOString();
  let q = supabase
    .from("posts")
    .select(
      "id, author_id, media_url, media_type, caption, created_at, flagged, flagged_reason, close_friends_only, profiles!posts_author_id_fkey(id, handle, display_name, avatar_url), likes(user_id)"
    )
    .eq("author_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  q = active ? q.gt("created_at", cutoff) : q.lte("created_at", cutoff);
  const { data, error } = await q;
  if (error) throw error;
  return shape((data ?? []) as unknown as RawPost[], userId);
}

export async function toggleLike(postId: string, currentlyLiked: boolean) {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("Not authenticated");
  if (currentlyLiked) {
    const { error } = await supabase
      .from("likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", uid);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("likes")
      .insert({ post_id: postId, user_id: uid });
    if (error) throw error;
  }
}

export async function uploadMedia(
  userId: string,
  blob: Blob,
  ext: string
): Promise<string> {
  const filename = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("nowa-media")
    .upload(filename, blob, {
      contentType: blob.type,
      cacheControl: "31536000",
      upsert: false,
    });
  if (error) throw error;
  const { data } = supabase.storage.from("nowa-media").getPublicUrl(filename);
  return data.publicUrl;
}

export async function createPost(args: {
  authorId: string;
  mediaUrl: string;
  caption: string;
  mediaType?: "image" | "video";
  closeFriendsOnly?: boolean;
}): Promise<string> {
  const { data, error } = await supabase.from("posts").insert({
    author_id: args.authorId,
    media_url: args.mediaUrl,
    caption: args.caption || null,
    media_type: args.mediaType ?? "image",
    close_friends_only: args.closeFriendsOnly ?? false,
  }).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function uploadAvatarAndSave(
  userId: string,
  blob: Blob
): Promise<{ url: string; originalSize: number; finalSize: number }> {
  // Comprime/redimensiona client-side antes de subir (avatar 512x512 JPEG)
  const compressed = await compressAvatar(blob);
  const filename = `avatars/${userId}/${Date.now()}.jpg`;
  const { error: upErr } = await supabase.storage
    .from("nowa-media")
    .upload(filename, compressed.blob, {
      contentType: "image/jpeg",
      cacheControl: "31536000",
      upsert: false,
    });
  if (upErr) throw upErr;
  const { data } = supabase.storage.from("nowa-media").getPublicUrl(filename);
  const url = data.publicUrl;
  const { error: updErr } = await supabase
    .from("profiles")
    .update({ avatar_url: url })
    .eq("id", userId);
  if (updErr) throw updErr;
  return {
    url,
    originalSize: compressed.originalSize,
    finalSize: compressed.size,
  };
}

// Tiny tick store so countdowns refresh every minute
let tickListeners = new Set<() => void>();
let tickValue = 0;
if (typeof window !== "undefined") {
  setInterval(() => {
    tickValue++;
    tickListeners.forEach((l) => l());
  }, 60_000);
}
export function useMinuteTick() {
  return useSyncExternalStore(
    (cb) => {
      tickListeners.add(cb);
      return () => tickListeners.delete(cb);
    },
    () => tickValue,
    () => 0
  );
}

export type BlockState = { is_blocked: boolean };

export async function fetchBlockState(
  targetId: string,
  viewerId: string | null
): Promise<BlockState> {
  if (!viewerId || viewerId === targetId) return { is_blocked: false };
  const { data } = await supabase
    .from("blocks")
    .select("blocked_id")
    .eq("blocker_id", viewerId)
    .eq("blocked_id", targetId)
    .maybeSingle();
  return { is_blocked: !!data };
}

export async function toggleBlock(targetId: string, currentlyBlocked: boolean) {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("Not authenticated");
  if (uid === targetId) throw new Error("Cannot block yourself");
  if (currentlyBlocked) {
    const { error } = await supabase
      .from("blocks")
      .delete()
      .eq("blocker_id", uid)
      .eq("blocked_id", targetId);
    if (error) throw error;
  } else {
    // also unfollow in both directions to clean up
    await supabase
      .from("follows")
      .delete()
      .or(
        `and(follower_id.eq.${uid},following_id.eq.${targetId}),and(follower_id.eq.${targetId},following_id.eq.${uid})`
      );
    const { error } = await supabase
      .from("blocks")
      .insert({ blocker_id: uid, blocked_id: targetId });
    if (error) throw error;
  }
}

export type Comment = {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author: {
    id: string;
    handle: string;
    display_name: string;
    avatar_url: string | null;
  };
};

type RawComment = {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
  profiles: Comment["author"] | null;
};

export async function fetchComments(postId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from("comments")
    .select(
      "id, post_id, author_id, content, created_at, profiles!comments_author_id_fkey(id, handle, display_name, avatar_url)"
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw error;
  return ((data ?? []) as unknown as RawComment[])
    .filter((c) => c.profiles)
    .map((c) => ({
      id: c.id,
      post_id: c.post_id,
      author_id: c.author_id,
      content: c.content,
      created_at: c.created_at,
      author: c.profiles!,
    }));
}

export async function addComment(postId: string, content: string) {
  const trimmed = content.trim();
  if (trimmed.length < 1 || trimmed.length > 500) {
    throw new Error("Comentário deve ter entre 1 e 500 caracteres");
  }
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("comments")
    .insert({ post_id: postId, author_id: uid, content: trimmed })
    .select("id")
    .single();
  if (error) throw error;
  // Fire-and-forget mention notifications
  notifyMentions({ text: trimmed, actorId: uid, postId, commentId: data.id }).catch(() => {});
  return data.id as string;
}

// ── Mention detection & notification ──

const mentionRegex = /@([a-z0-9_]{2,20})/gi;

function extractMentions(text: string): string[] {
  const handles: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = mentionRegex.exec(text)) !== null) {
    handles.push(m[1].toLowerCase());
  }
  return [...new Set(handles)];
}

async function notifyMentions(opts: {
  text: string;
  actorId: string;
  postId: string;
  commentId?: string;
}) {
  const handles = extractMentions(opts.text);
  if (handles.length === 0) return;
  // Resolve handles to user ids
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, handle")
    .in("handle", handles);
  if (!profiles || profiles.length === 0) return;
  const rows = profiles
    .filter((p) => p.id !== opts.actorId)
    .map((p) => ({
      user_id: p.id,
      actor_id: opts.actorId,
      type: "mention" as const,
      post_id: opts.postId,
      comment_id: opts.commentId ?? null,
    }));
  if (rows.length > 0) {
    await supabase.from("notifications").insert(rows);
  }
}

// ── Notifications API ──

export type Notification = {
  id: string;
  user_id: string;
  actor_id: string;
  type: string;
  post_id: string | null;
  comment_id: string | null;
  read: boolean;
  created_at: string;
  actor: {
    handle: string;
    display_name: string;
    avatar_url: string | null;
  };
};

type RawNotification = Omit<Notification, "actor"> & {
  profiles: Notification["actor"] | null;
};

export async function fetchNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select(
      "id, user_id, actor_id, type, post_id, comment_id, read, created_at, profiles!notifications_actor_id_fkey(handle, display_name, avatar_url)"
    )
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return ((data ?? []) as unknown as RawNotification[])
    .filter((n) => n.profiles)
    .map((n) => ({ ...n, actor: n.profiles!, profiles: undefined } as unknown as Notification));
}

export async function fetchUnreadCount(): Promise<number> {
  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("read", false);
  return count ?? 0;
}

export async function markAllRead() {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("read", false);
  if (error) throw error;
}

export async function deleteComment(commentId: string) {
  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId);
  if (error) throw error;
}

export async function fetchCommentsCount(postId: string): Promise<number> {
  const { count } = await supabase
    .from("comments")
    .select("*", { count: "exact", head: true })
    .eq("post_id", postId);
  return count ?? 0;
}
