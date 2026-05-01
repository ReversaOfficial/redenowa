import { createFileRoute } from "@tanstack/react-router";
import { Lock, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { MobileShell } from "@/components/nowa/MobileShell";
import { TopBar } from "@/components/nowa/TopBar";
import { fetchUserPosts } from "@/lib/posts-api";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/archive")({
  head: () => ({
    meta: [
      { title: "Arquivo — NOWA" },
      {
        name: "description",
        content: "Seus momentos passados. Visíveis só para você.",
      },
    ],
  }),
  component: ArchivePage,
});

function ArchivePage() {
  const { user } = useAuth();
  const { data: archive, isLoading } = useQuery({
    queryKey: ["posts", "user-archive", user?.id],
    queryFn: () => fetchUserPosts(user!.id, false),
    enabled: !!user,
  });

  return (
    <MobileShell>
      <TopBar
        title="Arquivo"
        subtitle="só para você"
        right={
          <span className="inline-flex items-center gap-1 rounded-full bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            <Lock className="h-3 w-3" strokeWidth={2.5} />
            privado
          </span>
        }
      />

      <div className="px-5 py-4">
        <p className="text-sm text-muted-foreground">
          Posts que já passaram das 24h. Ninguém mais vê — apenas você.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && archive && archive.length === 0 && (
        <div className="px-6 py-20 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-card">
            <Lock className="h-7 w-7 text-muted-foreground" strokeWidth={2} />
          </div>
          <h2 className="text-base font-semibold text-foreground">
            Seu arquivo está vazio
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Quando seus posts passarem de 24h, eles ficam guardados aqui.
          </p>
        </div>
      )}

      {!isLoading && archive && archive.length > 0 && (
        <div className="grid grid-cols-3 gap-0.5">
          {archive.map((p) => (
            <div
              key={p.id}
              className="relative aspect-square overflow-hidden bg-card"
            >
              <img
                src={p.media_url}
                alt={p.caption ?? ""}
                loading="lazy"
                className="h-full w-full object-cover opacity-90"
              />
            </div>
          ))}
        </div>
      )}
    </MobileShell>
  );
}
