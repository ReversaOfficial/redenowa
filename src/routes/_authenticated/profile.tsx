import { createFileRoute, Link } from "@tanstack/react-router";
import { LogOut, Grid3x3, Loader2, Pencil } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { MobileShell } from "@/components/nowa/MobileShell";
import { TopBar } from "@/components/nowa/TopBar";
import { Avatar } from "@/components/nowa/PostCard";
import { fetchUserPosts, timeRemaining, useMinuteTick } from "@/lib/posts-api";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Perfil — NOWA" },
      { name: "description", content: "Seu perfil no NOWA." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, user, signOut } = useAuth();
  useMinuteTick();

  const { data: active } = useQuery({
    queryKey: ["posts", "user-active", user?.id],
    queryFn: () => fetchUserPosts(user!.id, true),
    enabled: !!user,
  });
  const { data: archive } = useQuery({
    queryKey: ["posts", "user-archive", user?.id],
    queryFn: () => fetchUserPosts(user!.id, false),
    enabled: !!user,
  });

  return (
    <MobileShell>
      <TopBar
        title="Perfil"
        right={
          <button
            onClick={() => signOut()}
            className="nowa-tap flex h-9 w-9 items-center justify-center rounded-full bg-card"
            aria-label="Sair"
          >
            <LogOut className="h-5 w-5 text-foreground" />
          </button>
        }
      />

      <section className="px-5 py-6">
        <div className="flex items-center gap-4">
          <Avatar
            src={profile?.avatar_url ?? null}
            name={profile?.display_name ?? "?"}
            size={80}
          />
          <div className="flex-1">
            <h2 className="text-lg font-bold text-foreground">
              {profile?.display_name ?? "..."}
            </h2>
            <p className="text-sm text-muted-foreground">
              @{profile?.handle ?? "..."}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-card p-4">
          <Stat label="ao vivo" value={active?.length ?? 0} accent />
          <Stat label="arquivo" value={archive?.length ?? 0} />
          <Stat label="seguidores" value={0} />
        </div>

        {profile?.bio && (
          <p className="mt-4 text-sm leading-snug text-foreground">{profile.bio}</p>
        )}

        <Link
          to="/profile/edit"
          className="nowa-tap mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
          Editar perfil
        </Link>
      </section>

      <div className="border-t border-border">
        <div className="flex items-center gap-2 border-b-2 border-foreground px-5 py-3">
          <Grid3x3 className="h-4 w-4" strokeWidth={2.5} />
          <span className="text-sm font-semibold">Ao vivo agora</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {active?.length ?? 0} posts
          </span>
        </div>

        {active === undefined ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : active.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-base font-semibold text-foreground">
              Nada ao vivo agora.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Poste agora ou perca.
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
    </MobileShell>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="text-center">
      <p
        className={`text-xl font-bold tabular-nums ${
          accent ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
