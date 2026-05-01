import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Grid3x3, Loader2 } from "lucide-react";
import { MobileShell } from "@/components/nowa/MobileShell";
import { TopBar } from "@/components/nowa/TopBar";
import { Avatar } from "@/components/nowa/PostCard";
import {
  fetchProfileByHandle,
  fetchUserPosts,
  timeRemaining,
  useMinuteTick,
} from "@/lib/posts-api";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/u/$handle")({
  head: ({ params }) => ({
    meta: [
      { title: `@${params.handle} — NOWA` },
      {
        name: "description",
        content: `Veja os posts ao vivo de @${params.handle} no NOWA. O momento é agora.`,
      },
      { property: "og:title", content: `@${params.handle} — NOWA` },
      {
        property: "og:description",
        content: `Posts ao vivo de @${params.handle}. Sem filtro. Sem passado.`,
      },
    ],
  }),
  component: PublicProfilePage,
});

function PublicProfilePage() {
  const { handle } = Route.useParams();
  const router = useRouter();
  const { user } = useAuth();
  useMinuteTick();

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ["profile-by-handle", handle],
    queryFn: () => fetchProfileByHandle(handle),
  });

  const { data: active, isLoading: loadingPosts } = useQuery({
    queryKey: ["posts", "user-active", profile?.id],
    queryFn: () => fetchUserPosts(profile!.id, true),
    enabled: !!profile?.id,
  });

  const isMe = user?.id && profile?.id === user.id;

  return (
    <MobileShell>
      <TopBar
        title={profile ? `@${profile.handle}` : "Perfil"}
        left={
          <button
            onClick={() => router.history.back()}
            className="nowa-tap flex h-9 w-9 items-center justify-center rounded-full bg-card"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
        }
      />

      {loadingProfile ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !profile ? (
        <div className="px-6 py-20 text-center">
          <p className="text-base font-semibold text-foreground">
            Perfil não encontrado.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            @{handle} não existe ou saiu do agora.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
          >
            Voltar ao feed
          </Link>
        </div>
      ) : (
        <>
          <section className="px-5 py-6">
            <div className="flex items-center gap-4">
              <Avatar
                src={profile.avatar_url}
                name={profile.display_name}
                size={80}
              />
              <div className="flex-1">
                <h2 className="text-lg font-bold text-foreground">
                  {profile.display_name}
                </h2>
                <p className="text-sm text-muted-foreground">
                  @{profile.handle}
                </p>
              </div>
              {isMe && (
                <Link
                  to="/profile"
                  className="rounded-full border border-border px-4 py-1.5 text-xs font-semibold text-foreground"
                >
                  Editar
                </Link>
              )}
            </div>

            {profile.bio ? (
              <p className="mt-4 text-sm leading-snug text-foreground">
                {profile.bio}
              </p>
            ) : (
              <p className="mt-4 text-sm italic text-muted-foreground">
                Sem bio. Só o agora.
              </p>
            )}

            <div className="mt-5 flex items-center gap-2 rounded-2xl bg-card px-4 py-3">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <span className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                {active?.length ?? 0} ao vivo agora
              </span>
            </div>
          </section>

          <div className="border-t border-border">
            <div className="flex items-center gap-2 border-b-2 border-foreground px-5 py-3">
              <Grid3x3 className="h-4 w-4" strokeWidth={2.5} />
              <span className="text-sm font-semibold">Posts ativos</span>
            </div>

            {loadingPosts ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !active || active.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="text-base font-semibold text-foreground">
                  Nada ao vivo agora.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Quem viu, viu.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-0.5 p-0.5">
                {active.map((p) => (
                  <div
                    key={p.id}
                    className="relative aspect-square overflow-hidden bg-card"
                  >
                    <img
                      src={p.media_url}
                      alt={p.caption ?? ""}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute bottom-1 left-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white">
                      {timeRemaining(p.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </MobileShell>
  );
}
