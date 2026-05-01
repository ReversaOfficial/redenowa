import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ArrowLeft, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MobileShell } from "@/components/nowa/MobileShell";
import { TopBar } from "@/components/nowa/TopBar";
import { Avatar } from "@/components/nowa/PostCard";
import { AvatarCameraDialog } from "@/components/nowa/AvatarCameraDialog";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { uploadAvatarAndSave } from "@/lib/posts-api";

export const Route = createFileRoute("/_authenticated/profile/edit")({
  head: () => ({
    meta: [
      { title: "Editar perfil — NOWA" },
      { name: "description", content: "Edite seu nome e bio no NOWA." },
    ],
  }),
  component: EditProfilePage,
});

const BIO_MAX = 160;
const NAME_MAX = 40;

const schema = z.object({
  display_name: z
    .string()
    .trim()
    .min(2, "Nome muito curto")
    .max(NAME_MAX, `Máx. ${NAME_MAX} caracteres`),
  bio: z
    .string()
    .trim()
    .max(BIO_MAX, `Máx. ${BIO_MAX} caracteres`)
    .optional()
    .transform((v) => v ?? ""),
});

function EditProfilePage() {
  const { profile, user, refreshProfile } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [errors, setErrors] = useState<{ display_name?: string; bio?: string }>(
    {}
  );
  const [saving, setSaving] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  async function onAvatarCaptured(blob: Blob) {
    if (!user) return;
    // preview otimista
    const localUrl = URL.createObjectURL(blob);
    setAvatarPreview(localUrl);
    setUploadingAvatar(true);
    try {
      await uploadAvatarAndSave(user.id, blob);
      await refreshProfile();
      toast.success("Avatar atualizado");
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Falha ao salvar avatar";
      toast.error(msg);
      setAvatarPreview(null);
    } finally {
      setUploadingAvatar(false);
    }
  }

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setBio(profile.bio ?? "");
    }
  }, [profile]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse({ display_name: displayName, bio });
    if (!parsed.success) {
      const fe: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof typeof errors;
        if (!fe[k]) fe[k] = issue.message;
      }
      setErrors(fe);
      return;
    }
    setErrors({});
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: parsed.data.display_name,
        bio: parsed.data.bio || null,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar");
      return;
    }
    await refreshProfile();
    toast.success("Perfil atualizado");
    router.history.back();
  }

  const bioRemaining = BIO_MAX - bio.length;

  return (
    <MobileShell>
      <TopBar
        title="Editar perfil"
        left={
          <button
            type="button"
            onClick={() => router.history.back()}
            className="nowa-tap flex h-9 w-9 items-center justify-center rounded-full bg-card"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
        }
      />

      <form onSubmit={onSubmit} className="px-5 py-6 space-y-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            className="nowa-tap relative shrink-0"
            aria-label="Trocar avatar"
          >
            <Avatar
              src={avatarPreview ?? profile?.avatar_url ?? null}
              name={profile?.display_name ?? "?"}
              size={80}
            />
            <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background">
              {uploadingAvatar ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" strokeWidth={2.5} />
              )}
            </span>
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              @{profile?.handle ?? "..."}
            </p>
            <p className="text-xs text-muted-foreground">
              Toque na foto para capturar agora.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="display_name"
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
          >
            Nome
          </label>
          <input
            id="display_name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={NAME_MAX}
            className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none focus:border-primary"
            placeholder="Seu nome"
          />
          {errors.display_name && (
            <p className="text-xs text-destructive">{errors.display_name}</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="bio"
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
            >
              Bio
            </label>
            <span
              className={`text-[11px] tabular-nums ${
                bioRemaining < 0
                  ? "text-destructive"
                  : "text-muted-foreground"
              }`}
            >
              {bioRemaining}
            </span>
          </div>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
            rows={4}
            maxLength={BIO_MAX}
            className="w-full resize-none rounded-2xl border border-border bg-card px-4 py-3 text-base leading-snug text-foreground outline-none focus:border-primary"
            placeholder="Conte algo sobre você. Curto. Como o agora."
          />
          {errors.bio && (
            <p className="text-xs text-destructive">{errors.bio}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="nowa-tap flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </MobileShell>
  );
}
