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
