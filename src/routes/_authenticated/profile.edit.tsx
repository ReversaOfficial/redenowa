import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { ArrowLeft, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MobileShell } from "@/components/nowa/MobileShell";
import { TopBar } from "@/components/nowa/TopBar";
import { Avatar } from "@/components/nowa/PostCard";
import { AvatarCameraDialog } from "@/components/nowa/AvatarCameraDialog";
import {
  ColorPicker,
  PRESET_BGS,
  PRESET_RINGS,
} from "@/components/nowa/ColorPicker";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { uploadAvatarAndSave } from "@/lib/posts-api";
import { readableTextOn, withAlpha } from "@/lib/color";

export const Route = createFileRoute("/_authenticated/profile/edit")({
  head: () => ({
    meta: [
      { title: "Editar perfil — NOWA" },
      { name: "description", content: "Edite seu nome, bio e cores no NOWA." },
    ],
  }),
  component: EditProfilePage,
});

const BIO_MAX = 160;
const NAME_MAX = 40;
const LOC_MAX = 60;

const DEFAULT_BG = "#0F0F12";
const DEFAULT_RING = "#FF2E63";

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
  city: z
    .string()
    .trim()
    .max(LOC_MAX, `Máx. ${LOC_MAX} caracteres`)
    .optional()
    .transform((v) => v ?? ""),
  state: z
    .string()
    .trim()
    .max(LOC_MAX, `Máx. ${LOC_MAX} caracteres`)
    .optional()
    .transform((v) => v ?? ""),
  country: z
    .string()
    .trim()
    .max(LOC_MAX, `Máx. ${LOC_MAX} caracteres`)
    .optional()
    .transform((v) => v ?? ""),
});

function EditProfilePage() {
  const { profile, user, refreshProfile } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [bg, setBg] = useState(DEFAULT_BG);
  const [ring, setRing] = useState(DEFAULT_RING);
  const [errors, setErrors] = useState<{ display_name?: string; bio?: string }>(
    {},
  );
  const [saving, setSaving] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  async function onAvatarCaptured(blob: Blob) {
    if (!user) return;
    const localUrl = URL.createObjectURL(blob);
    setAvatarPreview(localUrl);
    setUploadingAvatar(true);
    try {
      const result = await uploadAvatarAndSave(user.id, blob);
      await refreshProfile();
      const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;
      const saved = Math.max(
        0,
        Math.round((1 - result.finalSize / result.originalSize) * 100),
      );
      toast.success("Avatar atualizado", {
        description:
          saved > 0
            ? `Otimizado: ${kb(result.originalSize)} → ${kb(result.finalSize)} (-${saved}%)`
            : `Tamanho final: ${kb(result.finalSize)}`,
      });
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
      setCity(profile.city ?? "");
      setCountry(profile.country ?? "");
      if (profile.theme_bg) setBg(profile.theme_bg);
      if (profile.theme_ring) setRing(profile.theme_ring);
    }
  }, [profile]);

  const previewTextColor = useMemo(() => readableTextOn(bg), [bg]);
  const previewMutedColor = useMemo(
    () => withAlpha(previewTextColor, 0.65),
    [previewTextColor],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse({
      display_name: displayName,
      bio,
      city,
      country,
    });
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
        city: parsed.data.city || null,
        country: parsed.data.country || null,
        theme_bg: bg,
        theme_ring: ring,
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
        {/* Avatar + handle */}
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
              ringColor={ring}
              ringWidth={4}
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

        {/* Nome */}
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

        {/* Cidade / País */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label
              htmlFor="city"
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
            >
              Cidade
            </label>
            <input
              id="city"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              maxLength={LOC_MAX}
              autoComplete="address-level2"
              className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none focus:border-primary"
              placeholder="São Paulo"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="country"
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
            >
              País
            </label>
            <input
              id="country"
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              maxLength={LOC_MAX}
              autoComplete="country-name"
              className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none focus:border-primary"
              placeholder="Brasil"
            />
          </div>
        </div>

        {/* Bio */}
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

        {/* Tema do perfil */}
        <div className="space-y-4 rounded-2xl border border-border bg-card/40 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              Tema do perfil
            </h3>
            <button
              type="button"
              onClick={() => {
                setBg(DEFAULT_BG);
                setRing(DEFAULT_RING);
              }}
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
            >
              Restaurar padrão
            </button>
          </div>

          {/* Preview ao vivo */}
          <section
            aria-label="Pré-visualização"
            className="relative overflow-hidden rounded-2xl border border-border"
            style={{ background: bg, color: previewTextColor }}
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-20"
              aria-hidden
              style={{
                background: `radial-gradient(60% 100% at 50% 0%, ${withAlpha(ring, 0.35)}, transparent 70%)`,
              }}
            />
            <div className="relative flex flex-col items-center px-6 py-6 text-center">
              <Avatar
                src={avatarPreview ?? profile?.avatar_url ?? null}
                name={displayName || "?"}
                size={72}
                ringColor={ring}
                ringWidth={4}
              />
              <h2
                className="mt-3 text-base font-bold leading-tight"
                style={{ color: previewTextColor }}
              >
                {displayName || "Seu nome"}
              </h2>
              <p
                className="mt-0.5 text-xs"
                style={{ color: previewMutedColor }}
              >
                @{profile?.handle ?? "voce"}
              </p>
              {(city || country) && (
                <p
                  className="mt-1 text-xs"
                  style={{ color: previewMutedColor }}
                >
                  {[city, country].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          </section>

          <ColorPicker
            label="Cor de fundo do perfil"
            value={bg}
            onChange={setBg}
            presets={PRESET_BGS}
          />
          <ColorPicker
            label="Cor da moldura do avatar"
            value={ring}
            onChange={setRing}
            presets={PRESET_RINGS}
          />
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

      <AvatarCameraDialog
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={onAvatarCaptured}
      />
    </MobileShell>
  );
}
