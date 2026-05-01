import { createFileRoute } from "@tanstack/react-router";
import { Settings, Grid3x3 } from "lucide-react";
import { MobileShell } from "@/components/nowa/MobileShell";
import { TopBar } from "@/components/nowa/TopBar";
import { ME, useMyPosts, useMyArchive, timeRemaining } from "@/lib/posts-store";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Perfil — NOWA" },
      { name: "description", content: "Seu perfil no NOWA." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const active = useMyPosts();
  const archive = useMyArchive();

  return (
    <MobileShell>
      <TopBar
        title="Perfil"
        right={
          <button
            className="nowa-tap flex h-9 w-9 items-center justify-center rounded-full bg-card"
            aria-label="Configurações"
          >
            <Settings className="h-5 w-5 text-foreground" />
          </button>
        }
      />

      <section className="px-5 py-6">
        <div className="flex items-center gap-4">
          <img
            src={ME.avatar}
            alt={ME.name}
            width={80}
            height={80}
            className="h-20 w-20 rounded-full object-cover ring-2 ring-border"
          />
          <div className="flex-1">
            <h2 className="text-lg font-bold text-foreground">{ME.name}</h2>
            <p className="text-sm text-muted-foreground">@{ME.handle}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-card p-4">
          <Stat label="ao vivo" value={active.length} accent />
          <Stat label="arquivo" value={archive.length} />
          <Stat label="seguidores" value={128} />
        </div>

        <p className="mt-4 text-sm leading-snug text-foreground">
          Capturando o agora, todos os dias.{" "}
          <span className="text-muted-foreground">— sem filtro, sem passado.</span>
        </p>
      </section>

      <div className="border-t border-border">
        <div className="flex items-center gap-2 border-b-2 border-foreground px-5 py-3">
          <Grid3x3 className="h-4 w-4" strokeWidth={2.5} />
          <span className="text-sm font-semibold">Ao vivo agora</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {active.length} posts
          </span>
        </div>

        {active.length === 0 ? (
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
              <div key={p.id} className="relative aspect-square overflow-hidden bg-card">
                <img
                  src={p.mediaUrl}
                  alt={p.caption}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                <span className="absolute bottom-1 left-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white">
                  {timeRemaining(p.createdAt)}
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
