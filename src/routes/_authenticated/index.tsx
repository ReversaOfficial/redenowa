import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MobileShell } from "@/components/nowa/MobileShell";
import { FeedReel } from "@/components/nowa/FeedReel";
import { NotificationBell, NotificationsPanel } from "@/components/nowa/NotificationsPanel";
import { fetchFeedPosts, useMinuteTick } from "@/lib/posts-api";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "NOWA — O momento é agora." },
      {
        name: "description",
        content:
          "NOWA é a rede social do agora. Sem filtros, sem passado. Poste agora ou perca.",
      },
    ],
  }),
  component: FeedPage,
});

const POST_TTL_MS = 24 * 60 * 60 * 1000;

function FeedPage() {
  const { user } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);
  const tick = useMinuteTick();
  const qc = useQueryClient();
  const queryKey = ["posts", "feed", user?.id ?? null];

  const { data: posts, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchFeedPosts(user?.id ?? null),
    // Refetch agressivo para garantir feed sempre fresco (últimas 24h)
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 15_000,
  });

  // Refetch imediato ao voltar a aba ou reconectar (defensivo).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        qc.invalidateQueries({ queryKey });
      }
    };
    const onOnline = () => qc.invalidateQueries({ queryKey });
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, user?.id]);

  // Filtra posts expirados em tempo real entre refetches.
  // Reavaliado a cada minuto via `tick` (useMinuteTick).
  const fresh = useMemo(() => {
    if (!posts) return posts;
    const cutoff = Date.now() - POST_TTL_MS;
    return posts.filter((p) => new Date(p.created_at).getTime() > cutoff && !p.flagged);
    // tick é dependência intencional para reavaliar a cada minuto
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, tick]);

  // Quando posts expirarem localmente, dispara refetch para repor o feed.
  useEffect(() => {
    if (posts && fresh && posts.length !== fresh.length) {
      qc.invalidateQueries({ queryKey });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fresh?.length, posts?.length]);

  if (isLoading) {
    return (
      <MobileShell>
        <div className="flex h-[100dvh] items-center justify-center bg-black">
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        </div>
      </MobileShell>
    );
  }

  if (!fresh || fresh.length === 0) {
    return (
      <MobileShell>
        <div className="flex h-[100dvh] flex-col items-center justify-center bg-black px-6 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
            <Sparkles className="h-7 w-7 text-primary" strokeWidth={2.5} />
          </div>
          <h2 className="text-xl font-bold text-white">Tudo silencioso por aqui</h2>
          <p className="mt-2 text-sm text-white/70">
            Nenhum momento nas últimas 24 horas. Seja o primeiro.
          </p>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell fullBleed>
      <FeedReel posts={fresh} />
    </MobileShell>
  );
}
