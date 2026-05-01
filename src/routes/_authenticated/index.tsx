import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { MobileShell } from "@/components/nowa/MobileShell";
import { TopBar } from "@/components/nowa/TopBar";
import { PostCard } from "@/components/nowa/PostCard";
import { fetchActivePosts, useMinuteTick } from "@/lib/posts-api";
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
    queryKey: ["posts", "active", user?.id ?? null],
    queryFn: () => fetchActivePosts(user?.id ?? null),
    refetchInterval: 60_000,
  });

  return (
    <MobileShell>
      <TopBar
        subtitle="O momento é agora"
        title={
          <span className="flex items-baseline gap-2">
            <span>NOWA</span>
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
          </span>
        }
        right={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />
            ao vivo
          </span>
        }
      />

      <div className="px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          últimas 24h · {posts?.length ?? 0} posts
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      <AnimatePresence mode="popLayout">
        {!isLoading && posts && posts.length === 0 ? (
          <EmptyFeed />
        ) : (
          posts?.map((post, i) => (
            <motion.div
              key={post.id}
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.3) }}
            >
              <PostCard post={post} />
            </motion.div>
          ))
        )}
      </AnimatePresence>

      {!isLoading && posts && posts.length > 0 && (
        <footer className="px-6 py-12 text-center">
          <p className="text-base font-semibold text-foreground">
            Você chegou ao fim.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Quem viu, viu. Volte amanhã para um novo dia.
          </p>
        </footer>
      )}
    </MobileShell>
  );
}

function EmptyFeed() {
  return (
    <div className="px-6 py-24 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent">
        <Sparkles className="h-7 w-7 text-primary" strokeWidth={2.5} />
      </div>
      <h2 className="text-xl font-bold text-foreground">Tudo silencioso por aqui</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Nenhum momento nas últimas 24 horas. Seja o primeiro.
      </p>
    </div>
  );
}
