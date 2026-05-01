import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export interface VideoPost {
  id: string;
  author_id: string;
  media_url: string;
  media_type: string;
  caption: string | null;
  created_at: string;
  author: {
    handle: string;
    avatar_url: string | null;
    display_name: string;
  };
  likes_count: number;
  liked_by_me: boolean;
  comments_count: number;
}

const PAGE_SIZE = 10;

function getTodayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 1, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function fetchFeedPosts({
  pageParam = 0,
  userId,
}: {
  pageParam: number;
  userId: string | null;
}): Promise<{ videos: VideoPost[]; nextCursor: number | null }> {
  const from = pageParam * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { start, end } = getTodayRange();

  const { data, error } = await supabase
    .from("posts")
    .select(`
      id,
      author_id,
      media_url,
      media_type,
      caption,
      created_at,
      flagged,
      profiles!posts_author_id_fkey (
        id,
        handle,
        avatar_url,
        display_name
      ),
      likes (
        user_id
      )
    `)
    .eq("flagged", false)
    .gte("created_at", start)
    .lte("created_at", end)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;

  const videos: VideoPost[] = (data ?? []).map((row: any) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const likesArr: any[] = row.likes ?? [];
    return {
      id: row.id,
      author_id: row.author_id,
      media_url: row.media_url,
      media_type: row.media_type,
      caption: row.caption,
      created_at: row.created_at,
      author: {
        handle: profile?.handle ?? "usuario",
        avatar_url: profile?.avatar_url ?? null,
        display_name: profile?.display_name ?? profile?.handle ?? "Usuário",
      },
      likes_count: likesArr.length,
      liked_by_me: userId ? likesArr.some((l: any) => l.user_id === userId) : false,
      comments_count: 0,
    };
  });

  const nextCursor = videos.length === PAGE_SIZE ? pageParam + 1 : null;
  return { videos, nextCursor };
}

export function useVideoFeed() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  return useInfiniteQuery({
    queryKey: ["video-feed", userId],
    queryFn: ({ pageParam }) => fetchFeedPosts({ pageParam, userId }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
  });
}
