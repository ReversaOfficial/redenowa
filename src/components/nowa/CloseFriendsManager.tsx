import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Search, UserPlus, UserMinus, Heart, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "./PostCard";

type CloseFriend = {
  id: string;
  friend_id: string;
  profile: {
    id: string;
    handle: string;
    display_name: string;
    avatar_url: string | null;
  };
};

type SearchResult = {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
};

async function fetchCloseFriends(userId: string): Promise<CloseFriend[]> {
  const { data, error } = await supabase
    .from("close_friends")
    .select("id, friend_id, profiles!close_friends_friend_id_fkey(id, handle, display_name, avatar_url)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    // Fallback: try without foreign key hint
    const { data: data2, error: error2 } = await supabase
      .from("close_friends")
      .select("id, friend_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error2) throw error2;

    // Fetch profiles separately
    const friendIds = (data2 ?? []).map((cf: any) => cf.friend_id);
    if (friendIds.length === 0) return [];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, handle, display_name, avatar_url")
      .in("id", friendIds);

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    return (data2 ?? [])
      .filter((cf: any) => profileMap.has(cf.friend_id))
      .map((cf: any) => ({
        id: cf.id,
        friend_id: cf.friend_id,
        profile: profileMap.get(cf.friend_id)!,
      }));
  }

  return (data ?? []).map((cf: any) => ({
    id: cf.id,
    friend_id: cf.friend_id,
    profile: cf.profiles,
  }));
}

async function searchProfiles(query: string, excludeIds: string[]): Promise<SearchResult[]> {
  if (query.length < 2) return [];
  const clean = query.replace(/^@/, "").toLowerCase();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, handle, display_name, avatar_url")
    .ilike("handle", `%${clean}%`)
    .not("id", "in", `(${excludeIds.join(",")})`)
    .limit(10);
  if (error) throw error;
  return data ?? [];
}

export function CloseFriendsManager({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: friends = [], isLoading } = useQuery({
    queryKey: ["close-friends", user?.id],
    queryFn: () => fetchCloseFriends(user!.id),
    enabled: !!user && open,
  });

  const friendIds = friends.map((f) => f.friend_id);
  const allExcludeIds = [...friendIds, user?.id ?? ""];

  const { data: results = [] } = useQuery({
    queryKey: ["search-profiles", search, allExcludeIds.join(",")],
    queryFn: () => searchProfiles(search, allExcludeIds),
    enabled: search.length >= 2 && open,
    staleTime: 10_000,
  });

  const addMutation = useMutation({
    mutationFn: async (friendId: string) => {
      const { error } = await supabase
        .from("close_friends")
        .insert({ user_id: user!.id, friend_id: friendId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["close-friends"] });
      setSearch("");
      toast.success("Adicionado aos melhores amigos");
    },
    onError: () => toast.error("Não foi possível adicionar"),
  });

  const removeMutation = useMutation({
    mutationFn: async (friendId: string) => {
      const { error } = await supabase
        .from("close_friends")
        .delete()
        .eq("user_id", user!.id)
        .eq("friend_id", friendId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["close-friends"] });
      toast.success("Removido dos melhores amigos");
    },
    onError: () => toast.error("Não foi possível remover"),
  });

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 350 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl bg-background pb-[max(env(safe-area-inset-bottom),16px)]"
            style={{ maxHeight: "85dvh" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Heart className="h-5 w-5 fill-emerald-500 text-emerald-500" />
                <h2 className="text-base font-bold text-foreground">Melhores Amigos</h2>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-card"
              >
                <X className="h-4 w-4 text-foreground" />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 py-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por @usuário..."
                  className="w-full rounded-xl border border-border bg-card pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="overflow-y-auto px-4" style={{ maxHeight: "55dvh" }}>
              {/* Search results */}
              {search.length >= 2 && results.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Adicionar
                  </p>
                  {results.map((r) => (
                    <div key={r.id} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <Avatar src={r.avatar_url} name={r.display_name} size={36} />
                        <div>
                          <p className="text-sm font-semibold text-foreground">{r.display_name}</p>
                          <p className="text-xs text-muted-foreground">@{r.handle}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => addMutation.mutate(r.id)}
                        disabled={addMutation.isPending}
                        className="flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Adicionar
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Current close friends */}
              <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Seus melhores amigos ({friends.length})
              </p>

              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : friends.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum melhor amigo ainda. Busque pelo @ para adicionar.
                </p>
              ) : (
                friends.map((f) => (
                  <div key={f.id} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <Avatar src={f.profile.avatar_url} name={f.profile.display_name} size={36} />
                      <div>
                        <p className="text-sm font-semibold text-foreground">{f.profile.display_name}</p>
                        <p className="text-xs text-muted-foreground">@{f.profile.handle}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeMutation.mutate(f.friend_id)}
                      disabled={removeMutation.isPending}
                      className="flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground"
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                      Remover
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
