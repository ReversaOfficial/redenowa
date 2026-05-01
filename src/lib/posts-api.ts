import { supabase } from "@/integrations/supabase/client";
import { useSyncExternalStore } from "react";

const HOUR = 60 * 60 * 1000;

export type Post = {
  id: string;
  author_id: string;
  media_url: string;
  media_type: "image" | "video";
  caption: string | null;
  created_at: string; // ISO
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
      author: r.profiles!,
      likes_count: r.likes.length,
      liked_by_me: myId ? r.likes.some((l) => l.user_id === myId) : false,
    }));
}

export async function fetchActivePosts(myId: string | null): Promise<Post[]> {
  const cutoff = new Date(Date.now() - 24 * HOUR).toISOString();
  const { data, error } = await supabase
    .from("posts")
    .select(
      "id, author_id, media_url, media_type, caption, created_at, profiles!posts_author_id_fkey(id, handle, display_name, avatar_url), likes(user_id)"
    )
    .gt("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(100);
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
};

export async function fetchProfileByHandle(
  handle: string
): Promise<PublicProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, handle, display_name, avatar_url, bio")
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
      "id, author_id, media_url, media_type, caption, created_at, profiles!posts_author_id_fkey(id, handle, display_name, avatar_url), likes(user_id)"
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
}) {
  const { error } = await supabase.from("posts").insert({
    author_id: args.authorId,
    media_url: args.mediaUrl,
    caption: args.caption || null,
    media_type: "image",
  });
  if (error) throw error;
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
