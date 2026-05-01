import { createFileRoute, Link } from "@tanstack/react-router";
import { LogOut, Grid3x3, Loader2, Pencil, Clock, Lock, Heart } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { MobileShell } from "@/components/nowa/MobileShell";
import { TopBar } from "@/components/nowa/TopBar";
import { Avatar } from "@/components/nowa/PostCard";
import { ReportBadges } from "@/components/nowa/ReportBadges";
import { fetchUserPosts, timeRemaining, useMinuteTick } from "@/lib/posts-api";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { readableTextOn, withAlpha } from "@/lib/color";
import { CloseFriendsManager } from "@/components/nowa/CloseFriendsManager";

const HOUR_MS = 60 * 60 * 1000;

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Perfil — NOWA" },
      { name: "description", content: "Seu perfil no NOWA — só o agora." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, user, signOut } = useAuth();
  const qc = useQueryClient();
  // re-render every minute so countdowns update
  useMinuteTick();

  const activeKey = ["posts", "user-active", user?.id] as const;
  const { data: active, isLoading } = useQuery({
    queryKey: activeKey,
    queryFn: () => fetchUserPosts(user!.id, true),
    enabled: !!user,
    // 24h cutoff is time-based; never trust cached data for long
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  // Realtime: when the user creates or removes a post, refresh immediately.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`profile-posts:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "posts",
          filter: `author_id=eq.${user.id}`,
        },
        () => qc.invalidateQueries({ queryKey: activeKey }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);

  // Schedule precise refetches at each post's 24h boundary so items disappear
  // exactly when they expire (covers idle tabs and "virar o dia").
  useEffect(() => {
    if (!active || active.length === 0) return;
    const now = Date.now();
    const timers = active
          .map((p) => {
        const expireAt = new Date(p.created_at).getTime() + 24 * HOUR_MS;
        const ms = expireAt - now + 500; // small grace
        if (ms <= 0 || ms > 25 * HOUR_MS) return null;
        return window.setTimeout(() => {
          // expire: remove from "live" feed and refresh the private archive
          qc.invalidateQueries({ queryKey: activeKey });
          qc.invalidateQueries({ queryKey: ["posts", "user-archive", user?.id] });
          qc.invalidateQueries({ queryKey: ["posts", "feed"] });
        }, ms);
      })
      .filter((t): t is number => t !== null);
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [active, qc]);

  // When the tab becomes visible again, recheck — handles overnight idling.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        qc.invalidateQueries({ queryKey: activeKey });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [qc]);

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

      <section
        className="px-5 py-6"
        style={
          profile?.theme_bg
            ? { background: profile.theme_bg }
            : undefined
        }
      >
        <div className="flex items-center gap-4">
          <Avatar
            src={profile?.avatar_url ?? null}
            name={profile?.display_name ?? "?"}
            size={80}
            ringColor={profile?.theme_ring ?? null}
            ringWidth={4}
          />
          <div className="flex-1">
            <h2
              className="text-lg font-bold"
              style={{
                color: profile?.theme_bg
                  ? readableTextOn(profile.theme_bg)
                  : undefined,
              }}
            >
              {profile?.display_name ?? "..."}
            </h2>
            <p
              className="text-sm"
              style={{
                color: profile?.theme_bg
                  ? withAlpha(readableTextOn(profile.theme_bg), 0.7)
                  : undefined,
              }}
            >
              @{profile?.handle ?? "..."}
              {profile?.city || profile?.state || profile?.country ? (
                <span className="ml-1">
                  · {[profile.city, profile.state, profile.country].filter(Boolean).join(", ")}
                </span>
              ) : null}
            </p>
          </div>
        </div>

        {profile?.bio && (
          <p
            className="mt-4 text-sm leading-snug"
            style={{
              color: profile?.theme_bg
                ? readableTextOn(profile.theme_bg)
                : undefined,
            }}
          >
            {profile.bio}
          </p>
        )}

        {profile && (
          <ReportBadges
            validCount={profile.valid_reports_count}
            invalidCount={profile.invalid_reports_count}
          />
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/profile/edit"
            className="nowa-tap inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar perfil
          </Link>
          <Link
            to="/archive"
            className="nowa-tap inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground"
          >
            <Lock className="h-3.5 w-3.5" />
            Arquivo privado
          </Link>
        </div>
      </section>

      <div className="border-t border-border">
        <div className="flex items-center gap-2 border-b-2 border-foreground px-5 py-3">
          <Grid3x3 className="h-4 w-4" strokeWidth={2.5} />
          <span className="text-sm font-semibold">Ao vivo agora</span>
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            últimas 24h
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !active || active.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-base font-semibold text-foreground">
              Nada ao vivo agora.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Poste agora ou o momento passa.
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
