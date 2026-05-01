import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { MobileShell } from "@/components/nowa/MobileShell";
import { FeedReel } from "@/components/nowa/FeedReel";
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

function FeedPage() {
  const { user } = useAuth();
  useMinuteTick();
  const { data: posts, isLoading } = useQuery({
    queryKey: ["posts", "feed", user?.id ?? null],
    queryFn: () => fetchFeedPosts(user?.id ?? null),
    refetchInterval: 60_000,
    // staleTime alto evita re-embaralhar enquanto o usuário rola
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <MobileShell>
        <div className="flex h-[100dvh] items-center justify-center bg-black">
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        </div>
      </MobileShell>
    );
  }

  if (!posts || posts.length === 0) {
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
    <MobileShell>
      <FeedReel posts={posts} />
    </MobileShell>
  );
}
